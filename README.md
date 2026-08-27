# Sal da Terra – Grupo VIP de Ofertas

Landing page estática hospedada na Netlify.

## Deploy (Netlify)
- Site publicado como estático a partir da raiz (`index.html`).
- Domínio: `gruposaldaterrawpp.netlify.app`.
- Qualquer push na branch principal reimplanta o site automaticamente.

## CAPI (Meta Conversions API)
O Worker em `capi-worker/` encaminha eventos de conversão server-side para a Meta,
complementando o Pixel (`780007211675556`) já carregado na página.

### Deploy do Worker
```
cd capi-worker
wrangler login
wrangler secret put META_ACCESS_TOKEN   # cole o token gerado no Events Manager
wrangler deploy
```

### Uso no front-end
```js
fetch("https://<seu-worker>.workers.dev/event", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    event_name: "Lead",
    event_source_url: location.href,
    user_data: { fbp: getCookie("_fbp"), fbc: getCookie("_fbc") },
  }),
});
```
