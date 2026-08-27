// Cloudflare Worker: encaminha eventos para a Meta Conversions API (CAPI)
// Endpoint: POST /event  { event_name, event_id?, event_source_url, user_data: { em?, ph?, fbp?, fbc? }, custom_data? }

const GRAPH_VERSION = "v20.0";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type",
    },
  });
}

async function sha256(value) {
  const data = new TextEncoder().encode(value.trim().toLowerCase());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hashBuffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return jsonResponse({}, 204);
    if (request.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

    const url = new URL(request.url);
    if (url.pathname !== "/event") return jsonResponse({ error: "not_found" }, 404);

    let payload;
    try {
      payload = await request.json();
    } catch {
      return jsonResponse({ error: "invalid_json" }, 400);
    }

    const { event_name, event_id, event_source_url, user_data = {}, custom_data = {} } = payload;
    if (!event_name) return jsonResponse({ error: "missing_event_name" }, 400);

    const ip = request.headers.get("cf-connecting-ip") || undefined;
    const userAgent = request.headers.get("user-agent") || undefined;

    const hashedUserData = {
      client_ip_address: ip,
      client_user_agent: userAgent,
      fbp: user_data.fbp,
      fbc: user_data.fbc,
    };
    if (user_data.em) hashedUserData.em = [await sha256(user_data.em)];
    if (user_data.ph) hashedUserData.ph = [await sha256(user_data.ph.replace(/\D/g, ""))];

    const eventPayload = {
      data: [
        {
          event_name,
          event_time: Math.floor(Date.now() / 1000),
          event_id,
          event_source_url,
          action_source: "website",
          user_data: hashedUserData,
          custom_data,
        },
      ],
    };

    const endpoint = `https://graph.facebook.com/${GRAPH_VERSION}/${env.PIXEL_ID}/events?access_token=${env.META_ACCESS_TOKEN}`;

    const metaResponse = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(eventPayload),
    });

    const result = await metaResponse.json();
    return jsonResponse(result, metaResponse.status);
  },
};
