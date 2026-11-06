/*
 * Passo curto de contato (Nome + WhatsApp) antes de abrir o WhatsApp.
 * Usado pela LP principal e por /contatodelivery.
 *
 * Uso:
 *   PassoContato.abrir({
 *     titulo: "Quase lá!",
 *     botao: "Continuar no WhatsApp",
 *     onConfirmar: function(dados){ ... dados.nome, dados.telefone ... }
 *   });
 */
(function(){
  var POLITICA_URL = "https://cadeolead.com.br/privacidade/pk_820a6ee0226e4abe9d8681e521916447";
  var STORE_KEY = "sdt_contato";
  var montado = false, el = {}, opcoesAtuais = null, ultimoFoco = null;

  function lerSalvo(){ try{ return JSON.parse(sessionStorage.getItem(STORE_KEY) || "null") || {}; }catch(e){ return {}; } }
  function salvar(d){ try{ sessionStorage.setItem(STORE_KEY, JSON.stringify(d)); }catch(e){} }

  function mascaraTelefone(v){
    var d = (v || "").replace(/\D/g, "").slice(0, 11);
    if (d.length <= 2) return d.length ? "(" + d : "";
    if (d.length <= 6) return "(" + d.slice(0,2) + ") " + d.slice(2);
    if (d.length <= 10) return "(" + d.slice(0,2) + ") " + d.slice(2,6) + "-" + d.slice(6);
    return "(" + d.slice(0,2) + ") " + d.slice(2,7) + "-" + d.slice(7);
  }

  var CSS = ""
  + ".pc-fundo{position:fixed;inset:0;z-index:9999;background:rgba(20,32,22,.55);display:flex;align-items:flex-end;justify-content:center;opacity:0;pointer-events:none;transition:opacity .2s;}"
  + ".pc-fundo.aberto{opacity:1;pointer-events:auto;}"
  + ".pc-caixa{background:#fff;width:100%;max-width:430px;border-radius:22px 22px 0 0;padding:26px 20px calc(22px + env(safe-area-inset-bottom));position:relative;transform:translateY(30px);transition:transform .25s;font-family:'Nunito Sans',sans-serif;color:#23291f;text-align:left;max-height:92vh;overflow:auto;}"
  + ".pc-fundo.aberto .pc-caixa{transform:none;}"
  + ".pc-caixa::before{content:'';position:absolute;top:0;left:0;right:0;height:5px;border-radius:22px 22px 0 0;background:linear-gradient(90deg,#1f3d28,#c9a14a,#a8512f);}"
  + "@media(min-width:560px){.pc-fundo{align-items:center;padding:16px;}.pc-caixa{border-radius:22px;}.pc-caixa::before{border-radius:22px 22px 0 0;}}"
  + ".pc-fechar{position:absolute;top:12px;right:12px;width:36px;height:36px;border:none;background:#f3efe4;border-radius:50%;font-size:20px;line-height:1;cursor:pointer;color:#4b5346;}"
  + ".pc-titulo{font-family:'Fraunces',serif;font-weight:700;font-size:24px;color:#1f3d28;line-height:1.15;margin:0 40px 6px 0;}"
  + ".pc-desc{font-size:14.5px;color:#6b7363;margin:0 0 18px;}"
  + ".pc-campo{margin-bottom:14px;}"
  + ".pc-campo label{display:block;font-size:13.5px;font-weight:800;color:#1f3d28;margin-bottom:6px;}"
  + ".pc-campo input{width:100%;box-sizing:border-box;font:inherit;font-size:16px;color:#23291f;background:#fbf8f1;border:1.5px solid rgba(31,61,40,.16);border-radius:12px;padding:14px;}"
  + ".pc-campo input:focus{outline:none;border-color:#3c6b41;background:#fff;box-shadow:0 0 0 4px rgba(60,107,65,.14);}"
  + ".pc-campo.erro input{border-color:#a8512f;box-shadow:0 0 0 4px rgba(168,81,47,.12);}"
  + ".pc-erro{display:none;font-size:12.5px;color:#a8512f;font-weight:700;margin-top:5px;}"
  + ".pc-campo.erro .pc-erro{display:block;}"
  + ".pc-btn{display:block;width:100%;border:none;border-radius:14px;padding:17px 20px;margin-top:6px;cursor:pointer;font-family:inherit;font-weight:800;font-size:17px;color:#fff;background:linear-gradient(135deg,#25c063,#1fa855);box-shadow:0 12px 26px -8px rgba(31,168,85,.6);}"
  + ".pc-btn:active{transform:scale(.97);}"
  + ".pc-btn[disabled]{opacity:.75;cursor:wait;}"
  + ".pc-aviso{font-size:12.5px;color:#6b7363;margin:12px 0 0;text-align:center;line-height:1.45;}"
  + ".pc-aviso a{color:#3c6b41;font-weight:700;}";

  function montar(){
    if (montado) return;
    montado = true;
    var st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);

    var fundo = document.createElement("div");
    fundo.className = "pc-fundo";
    fundo.innerHTML = ''
      + '<form class="pc-caixa" role="dialog" aria-modal="true" aria-labelledby="pcTitulo" novalidate>'
      +   '<button type="button" class="pc-fechar" aria-label="Fechar">×</button>'
      +   '<h2 class="pc-titulo" id="pcTitulo"></h2>'
      +   '<p class="pc-desc" id="pcDesc"></p>'
      +   '<div class="pc-campo" id="pcCampoNome">'
      +     '<label for="pcNome">Seu nome</label>'
      +     '<input id="pcNome" type="text" autocomplete="name" placeholder="Ex.: Maria" maxlength="60" required>'
      +     '<span class="pc-erro">Digite seu nome para continuar.</span>'
      +   '</div>'
      +   '<div class="pc-campo" id="pcCampoTel">'
      +     '<label for="pcTel">WhatsApp com DDD</label>'
      +     '<input id="pcTel" type="tel" inputmode="numeric" autocomplete="tel-national" placeholder="(11) 91234-5678" maxlength="15" required>'
      +     '<span class="pc-erro">Digite um WhatsApp válido com DDD.</span>'
      +   '</div>'
      +   '<button type="submit" class="pc-btn" id="pcBtn"></button>'
      +   '<p class="pc-aviso">Ao continuar, você concorda em ser contatado pelo WhatsApp. Veja a <a href="' + POLITICA_URL + '" target="_blank" rel="noopener">Política de privacidade</a>.</p>'
      + '</form>';
    document.body.appendChild(fundo);

    el.fundo = fundo;
    el.form = fundo.querySelector("form");
    el.titulo = fundo.querySelector("#pcTitulo");
    el.desc = fundo.querySelector("#pcDesc");
    el.nome = fundo.querySelector("#pcNome");
    el.tel = fundo.querySelector("#pcTel");
    el.btn = fundo.querySelector("#pcBtn");

    el.tel.addEventListener("input", function(){
      el.tel.value = mascaraTelefone(el.tel.value);
      if (el.tel.value.replace(/\D/g,"").length >= 10) el.tel.parentNode.classList.remove("erro");
    });
    el.nome.addEventListener("input", function(){
      if (el.nome.value.trim().length >= 2) el.nome.parentNode.classList.remove("erro");
    });

    fundo.querySelector(".pc-fechar").addEventListener("click", fechar);
    fundo.addEventListener("click", function(e){ if (e.target === fundo) fechar(); });
    document.addEventListener("keydown", function(e){ if (e.key === "Escape" && fundo.classList.contains("aberto")) fechar(); });

    el.form.addEventListener("submit", function(e){
      e.preventDefault();
      var nome = el.nome.value.replace(/\s+/g, " ").trim();
      var digitos = el.tel.value.replace(/\D/g, "");
      var nomeOk = nome.length >= 2;
      var telOk = digitos.length === 10 || digitos.length === 11;
      el.nome.parentNode.classList.toggle("erro", !nomeOk);
      el.tel.parentNode.classList.toggle("erro", !telOk);
      if (!nomeOk) { el.nome.focus(); return; }
      if (!telOk) { el.tel.focus(); return; }

      salvar({ nome: nome, telefone: el.tel.value });
      el.btn.disabled = true;
      el.btn.textContent = "Abrindo o WhatsApp…";
      var cb = opcoesAtuais && opcoesAtuais.onConfirmar;
      setTimeout(function(){ el.btn.disabled = false; el.btn.textContent = (opcoesAtuais && opcoesAtuais.botao) || "Continuar no WhatsApp"; }, 3000);
      if (cb) cb({ nome: nome, telefone: el.tel.value });
    });
  }

  function abrir(opcoes){
    montar();
    opcoesAtuais = opcoes || {};
    el.titulo.textContent = opcoesAtuais.titulo || "Falta pouco!";
    el.desc.textContent = opcoesAtuais.descricao || "Informe seu nome e WhatsApp para continuar.";
    el.btn.textContent = opcoesAtuais.botao || "Continuar no WhatsApp";
    el.btn.disabled = false;
    var salvo = lerSalvo();
    if (salvo.nome && !el.nome.value) el.nome.value = salvo.nome;
    if (salvo.telefone && !el.tel.value) el.tel.value = salvo.telefone;
    ultimoFoco = document.activeElement;
    el.fundo.classList.add("aberto");
    setTimeout(function(){ (el.nome.value ? el.tel : el.nome).focus(); }, 60);
  }

  function fechar(){
    if (!montado) return;
    el.fundo.classList.remove("aberto");
    if (ultimoFoco && ultimoFoco.focus) ultimoFoco.focus();
  }

  window.PassoContato = { abrir: abrir, fechar: fechar, mascaraTelefone: mascaraTelefone };
})();
