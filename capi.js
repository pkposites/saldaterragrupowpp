/*
 * Envio de eventos para a Meta Conversions API pela função do Netlify (/api/capi).
 *
 * - Respeita o consentimento do Cadê o Lead (localStorage "lh_consent"):
 *     aceito    -> envia na hora
 *     sem resposta -> guarda e envia quando a pessoa aceitar
 *     recusado  -> não envia (o Cadê o Lead faz a medição mínima sem cookies)
 * - Usa o mesmo event_id do Pixel para a Meta deduplicar.
 * - Envia o PageView da página com o ID definido em window.SDT_PV_ID (no snippet do Pixel).
 *
 * Uso:
 *   SDTCapi.send("Lead", { eventId, customData: {...}, userData: { ph, fn } });
 */
(function(){
  var ENDPOINT = "/api/capi";
  var fila = [];
  var vigiando = false;

  function consentimento(){
    try { return window.localStorage.getItem("lh_consent"); } catch(e){ return null; }
  }
  function getCookie(name){
    var m = document.cookie.match("(^|;)\\s*" + name + "\\s*=\\s*([^;]+)");
    return m ? decodeURIComponent(m[2]) : undefined;
  }
  function fbc(){
    var c = getCookie("_fbc");
    if (c) return c;
    try {
      var id = new URLSearchParams(location.search).get("fbclid");
      if (id) return "fb.1." + Date.now() + "." + id;
    } catch(e){}
    return undefined;
  }

  function enviarAgora(ev){
    var userData = Object.assign({ fbp: getCookie("_fbp"), fbc: fbc() }, ev.userData || {});
    var body = JSON.stringify({
      event_name: ev.name,
      event_id: ev.eventId,
      event_source_url: location.href,
      user_data: userData,
      custom_data: ev.customData || {}
    });
    try {
      fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: body, keepalive: true }).catch(function(){});
    } catch(e){
      try { navigator.sendBeacon && navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "application/json" })); } catch(_){}
    }
  }

  function processarFila(){
    var c = consentimento();
    if (c === "denied") { fila = []; return true; }
    if (c !== "granted") return false;
    // pequena espera para o Pixel (liberado pelo aceite) gravar o cookie _fbp
    var pendentes = fila; fila = [];
    setTimeout(function(){ pendentes.forEach(enviarAgora); }, 800);
    return true;
  }

  function vigiarConsentimento(){
    if (vigiando) return;
    vigiando = true;
    var inicio = Date.now();
    var t = setInterval(function(){
      if (processarFila() || Date.now() - inicio > 30 * 60 * 1000) { clearInterval(t); vigiando = false; }
    }, 1000);
  }

  function send(name, opts){
    opts = opts || {};
    var ev = { name: name, eventId: opts.eventId, customData: opts.customData, userData: opts.userData };
    var c = consentimento();
    if (c === "denied") return;
    if (c === "granted") return enviarAgora(ev);
    fila.push(ev);
    vigiarConsentimento();
  }

  window.SDTCapi = { send: send };

  // PageView do servidor com o mesmo ID do Pixel
  if (window.SDT_PV_ID) send("PageView", { eventId: window.SDT_PV_ID });
})();
