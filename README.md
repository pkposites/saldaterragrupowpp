# Sal da Terra – Grupo VIP de Ofertas

Landing page estática hospedada na Netlify.

## Deploy (Netlify)
- Site publicado como estático a partir da raiz (`index.html`).
- Domínio: `gruposaldaterrawpp.netlify.app`.
- Qualquer push na branch principal reimplanta o site automaticamente.

## CAPI (Meta Conversions API)
A CAPI roda numa função do Netlify (`netlify/functions/capi.mjs`, rota `/api/capi`),
no mesmo domínio das páginas. As páginas enviam pelo `capi.js`:
- `PageView` com o mesmo `eventID` do Pixel (`window.SDT_PV_ID`) e `Lead` no clique,
  com nome e telefone (o hash SHA-256 é feito na função).
- Só envia depois do aceite de cookies do Cadê o Lead (`localStorage.lh_consent`);
  sem aceite, a medição mínima fica com o servidor do Cadê o Lead.

Variáveis no Netlify (Site configuration > Environment variables):
- `META_ACCESS_TOKEN` (obrigatória, secreta): token do Events Manager.
- `META_PIXEL_ID` (opcional, padrão `780007211675556`).
- `META_TEST_EVENT_CODE` (opcional): para ver os eventos em "Testar eventos".

O antigo Worker da Cloudflare (`capi-worker/`) não é mais usado pelas páginas.

## Cadê o Lead
Todas as páginas carregam `https://cadeolead.com.br/tracker.js` logo após o Pixel (com
`fbq('consent', 'revoke')` antes do `init`; o tracker libera o Pixel após o aceite do banner).
Antes de abrir o WhatsApp, cada botão pede nome + WhatsApp (`passo-contato.js`, ou o próprio
formulário em `/atacado`), chama `LeadHub.identify`/`LeadHub.set` e abre `LeadHub.whatsappUrl(url)`.
