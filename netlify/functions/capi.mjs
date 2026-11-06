// Netlify Function: Meta Conversions API (CAPI)
// POST /api/capi  { event_name, event_id, event_source_url, user_data?, custom_data? }
//
// Variáveis de ambiente (Netlify > Site configuration > Environment variables):
//   META_ACCESS_TOKEN     (obrigatória, secreta) token gerado no Events Manager
//   META_PIXEL_ID         (opcional) padrão: 780007211675556
//   META_TEST_EVENT_CODE  (opcional) código de teste do Events Manager

const GRAPH_VERSION = "v21.0";
const DEFAULT_PIXEL_ID = "780007211675556";
const EVENTOS_PERMITIDOS = new Set(["PageView", "Lead", "Contact", "ViewContent"]);

const HEADERS = {
  "content-type": "application/json",
  "cache-control": "no-store",
};

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: HEADERS });

async function sha256(valor) {
  const data = new TextEncoder().encode(valor);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Normalizações exigidas pela Meta antes do hash
const norm = {
  em: (v) => v.trim().toLowerCase(),
  fn: (v) => v.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/g, ""),
  ph: (v) => {
    let d = v.replace(/\D/g, "");
    if (d.length === 10 || d.length === 11) d = "55" + d; // DDD + número → com DDI do Brasil
    return d;
  },
  external_id: (v) => v.trim(),
};

function str(v, max = 500) {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;
}

export default async (request, context) => {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const token = process.env.META_ACCESS_TOKEN;
  if (!token) return json({ error: "missing_META_ACCESS_TOKEN" }, 500);
  const pixelId = process.env.META_PIXEL_ID || DEFAULT_PIXEL_ID;

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const eventName = str(payload.event_name, 50);
  if (!eventName || !EVENTOS_PERMITIDOS.has(eventName)) return json({ error: "invalid_event_name" }, 400);

  // Só aceita eventos de páginas deste site
  const siteHost = new URL(request.url).host;
  let sourceUrl = str(payload.event_source_url, 1000);
  try {
    if (!sourceUrl || new URL(sourceUrl).host !== siteHost) sourceUrl = undefined;
  } catch {
    sourceUrl = undefined;
  }
  if (!sourceUrl) return json({ error: "invalid_event_source_url" }, 400);

  const ud = payload.user_data && typeof payload.user_data === "object" ? payload.user_data : {};
  const userData = {
    client_ip_address: context.ip || request.headers.get("x-nf-client-connection-ip") || undefined,
    client_user_agent: request.headers.get("user-agent") || undefined,
    fbp: str(ud.fbp, 200),
    fbc: str(ud.fbc, 500),
  };
  for (const campo of ["em", "ph", "fn", "external_id"]) {
    const v = str(ud[campo], 200);
    if (!v) continue;
    const n = norm[campo](v);
    if (n) userData[campo] = [await sha256(n)];
  }

  const customData = {};
  if (payload.custom_data && typeof payload.custom_data === "object") {
    for (const [k, v] of Object.entries(payload.custom_data).slice(0, 25)) {
      if (typeof v === "string" || typeof v === "number") customData[k.slice(0, 50)] = typeof v === "string" ? v.slice(0, 200) : v;
    }
  }

  const body = {
    data: [
      {
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: str(payload.event_id, 100),
        event_source_url: sourceUrl,
        action_source: "website",
        user_data: userData,
        custom_data: customData,
      },
    ],
  };
  if (process.env.META_TEST_EVENT_CODE) body.test_event_code = process.env.META_TEST_EVENT_CODE;

  const resp = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${pixelId}/events?access_token=${encodeURIComponent(token)}`,
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }
  );
  const result = await resp.json().catch(() => ({}));
  if (!resp.ok) console.error("CAPI erro", resp.status, JSON.stringify(result));
  return json(resp.ok ? { ok: true, events_received: result.events_received } : { ok: false, error: result.error?.message }, resp.ok ? 200 : 502);
};

export const config = { path: "/api/capi" };
