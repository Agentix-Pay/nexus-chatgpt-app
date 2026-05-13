/**
 * ChatGPT Apps SDK widget HTML — iframe-hosted inline UI components.
 *
 * Per OpenAI Apps SDK spec (https://developers.openai.com/apps-sdk/build/mcp-server):
 *   - Each widget is registered as an MCP resource at `ui://widget/<name>.html`
 *   - ChatGPT loads the resource into an iframe inside the chat
 *   - When a tool returns, ChatGPT posts `ui/notifications/tool-result` to the
 *     iframe via postMessage; the widget's JS renders the structured data
 *   - The resource's `_meta.ui` declares the public domain + CSP allowlist
 *
 * Each widget here is one self-contained HTML page (inline CSS + inline JS,
 * no external assets) so OpenAI's review process can verify the contents.
 *
 * The render logic mirrors what we built in `src/components/render.ts` —
 * same data shapes, same brand language. Server-side render.ts is kept as
 * a fallback for non-iframe MCP hosts (Claude Desktop today, etc.).
 */

const WIDGET_DOMAIN = 'https://agentix-nexus-app.fly.dev';

export const WIDGET_NAMES = [
  'merchant-list',
  'category-grid',
  'product-grid',
  'product-detail',
  'order-summary',
  'payment-sheet',
  'checkout-link',
  'order-confirmation',
  'order-status',
] as const;

export type WidgetName = (typeof WIDGET_NAMES)[number];

/** Map a tool's outputUI value to its widget URI. */
export function widgetUri(outputUI: string): string {
  // Three browsing tools (list_merchants, list_categories, search_products) all
  // render through the same widget so navigation between merchants → categories
  // → products happens in-place. The widget detects which data shape arrived
  // and renders the right view.
  const map: Record<string, WidgetName> = {
    MerchantList: 'merchant-list',
    CategoryGrid: 'merchant-list',   // ← shares the merchant-list widget
    ProductGrid: 'merchant-list',    // ← shares the merchant-list widget
    ProductDetailCard: 'product-detail',
    OrderSummary: 'order-summary',
    PaymentSheet: 'payment-sheet',
    CheckoutLinkCard: 'checkout-link',
    OrderConfirmation: 'order-confirmation',
    OrderStatusCard: 'order-status',
  };
  const name = map[outputUI] ?? 'merchant-list';
  return `ui://widget/${name}.html`;
}

/** Per-widget _meta.ui block for resource registration (CSP, domain, etc.). */
export function widgetMeta(): Record<string, unknown> {
  return {
    ui: {
      domain: WIDGET_DOMAIN,
      csp: {
        connectDomains: ['https://agentix-nexus.fly.dev'],
        // Image-host allowlist for product/category thumbnails. loremflickr.com
        // is the mock merchant's placeholder source; cdn.shopify.com and Unsplash
        // cover the common real-merchant CDNs we'll point at when MockAdapter is
        // swapped for Shopify/Woo. *.oaistatic.com stays for any OpenAI-served
        // assets the host injects.
        resourceDomains: [
          'https://*.oaistatic.com',
          'https://loremflickr.com',
          'https://*.loremflickr.com',
          'https://cdn.shopify.com',
          'https://images.unsplash.com',
        ],
      },
    },
  };
}

const SHARED_CSS = `
:root{color-scheme:light;}
*{box-sizing:border-box;}
html,body{margin:0;padding:0;background:#fff;}
body{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",system-ui,sans-serif;color:#0F172A;font-size:14px;line-height:1.5;font-feature-settings:"ss01","cv11";font-variant-numeric:tabular-nums;}
.nx-card{background:#fff;padding:20px;max-width:none;margin:0;border-radius:0;box-shadow:none;}
.nx-eyebrow{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.4px;color:#475569;margin:0 0 6px;}
.nx-title{font-size:18px;font-weight:600;margin:0 0 10px;}
.nx-row{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid #E2E8F0;}
.nx-row:last-child{border-bottom:none;}
.nx-meta{font-size:12px;color:#64748B;margin-top:2px;}
.nx-amount{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:500;}
.nx-totals{margin-top:8px;padding-top:14px;border-top:2px solid #0F172A;}
.nx-totals-row{display:flex;justify-content:space-between;padding:4px 0;font-size:13px;color:#475569;}
.nx-grand{margin-top:6px;padding-top:10px;border-top:1px solid #E2E8F0;display:flex;justify-content:space-between;align-items:baseline;}
.nx-grand-label{font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.4px;color:#0F172A;}
.nx-grand-amount{font-size:26px;font-weight:700;background:linear-gradient(135deg,#67E8F9,#818CF8 50%,#C084FC);-webkit-background-clip:text;background-clip:text;color:transparent;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;}
.nx-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:13px 18px;border-radius:10px;background:#0F172A;color:#fff;font-size:15px;font-weight:600;text-decoration:none;margin-top:14px;border:0;cursor:pointer;font-family:inherit;}
.nx-button-gradient{background:linear-gradient(135deg,#67E8F9,#818CF8 50%,#C084FC);}
.nx-button:hover{filter:brightness(1.05);}
.nx-pill{display:inline-block;padding:3px 8px;border-radius:999px;background:#F1F5F9;color:#475569;font-size:11px;font-weight:500;}
.nx-pill-success{background:#D1FAE5;color:#065F46;}
.nx-pill-warn{background:#FEF3C7;color:#713F12;}
.nx-banner{margin-top:12px;padding:10px 12px;border-radius:8px;background:#FEF3C7;border:1px solid #FDE68A;color:#713F12;font-size:12px;}
.nx-tile{display:flex;gap:12px;align-items:flex-start;padding:12px;border-radius:10px;border:1px solid #E2E8F0;background:#fff;margin-bottom:8px;transition:border-color .15s,box-shadow .15s,transform .1s;}
.nx-cat-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-top:6px;}
.nx-cat{position:relative;overflow:hidden;border-radius:12px;border:1px solid #E2E8F0;background:#fff;cursor:pointer;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none;transition:transform .12s,box-shadow .15s,border-color .15s;aspect-ratio:1;}
.nx-cat *{pointer-events:none;}
.nx-cat-img{position:absolute;inset:0;background-size:cover;background-position:center;transition:transform .4s;}
.nx-cat-overlay{position:absolute;inset:0;background:linear-gradient(180deg,rgba(2,6,23,0) 30%,rgba(2,6,23,.78) 100%);}
.nx-cat-text{position:absolute;left:10px;right:10px;bottom:10px;color:#fff;}
.nx-cat-name{font-size:14px;font-weight:600;line-height:1.2;margin:0 0 2px;text-shadow:0 1px 2px rgba(0,0,0,.2);}
.nx-cat-count{font-size:11px;font-weight:500;opacity:.85;}
.nx-cat:hover{border-color:#818CF8;box-shadow:0 1px 2px rgba(15,23,42,.06),0 8px 22px rgba(129,140,248,.18);}
.nx-cat:hover .nx-cat-img{transform:scale(1.04);}
.nx-cat:active{transform:scale(.98);}
.nx-cat:focus-visible{outline:none;border-color:#818CF8;box-shadow:0 0 0 3px rgba(129,140,248,.30);}
.nx-prod-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin-top:8px;}
.nx-prod{position:relative;overflow:hidden;border-radius:10px;border:1px solid #E2E8F0;background:#fff;cursor:pointer;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none;transition:border-color .15s,box-shadow .15s,transform .1s;display:flex;flex-direction:column;}
.nx-prod *{pointer-events:none;}
.nx-prod-img{aspect-ratio:1;background:linear-gradient(135deg,#E0F2FE,#EDE9FE);background-size:cover;background-position:center;}
.nx-prod-body{padding:10px 12px 12px;display:flex;flex-direction:column;gap:2px;}
.nx-prod-title{font-size:13px;font-weight:600;color:#0F172A;line-height:1.3;margin:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
.nx-prod-price{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;font-weight:600;color:#0F172A;margin-top:4px;}
.nx-prod-stock{font-size:10px;font-weight:500;color:#059669;margin-top:2px;}
.nx-prod-stock-out{color:#B91C1C;}
.nx-prod:hover{border-color:#818CF8;box-shadow:0 1px 2px rgba(15,23,42,.06),0 6px 16px rgba(129,140,248,.14);}
.nx-prod:active{transform:scale(.99);}
.nx-prod:focus-visible{outline:none;border-color:#818CF8;box-shadow:0 0 0 3px rgba(129,140,248,.30);}
.nx-breadcrumb{display:flex;align-items:center;gap:6px;font-size:12px;color:#64748B;margin-bottom:8px;}
.nx-breadcrumb-link{color:#818CF8;cursor:pointer;font-weight:500;text-decoration:none;}
.nx-breadcrumb-link:hover{color:#6366F1;}
.nx-tile-clickable{cursor:pointer;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none;}
.nx-tile-clickable *{pointer-events:none;}
.nx-tile-clickable:hover{border-color:#818CF8;box-shadow:0 1px 2px rgba(15,23,42,.06),0 6px 18px rgba(129,140,248,.10);}
.nx-tile-clickable:active{transform:scale(.995);}
.nx-tile-clickable:focus-visible{outline:none;border-color:#818CF8;box-shadow:0 0 0 3px rgba(129,140,248,.30);}
.nx-tile-img{width:56px;height:56px;border-radius:8px;background:linear-gradient(135deg,#E0F2FE,#EDE9FE);flex-shrink:0;background-size:cover;background-position:center;}
.nx-tile-body{flex:1;min-width:0;}
.nx-tile-title{font-weight:600;color:#0F172A;font-size:14px;margin:0;}
.nx-tile-meta{font-size:12px;color:#64748B;margin:2px 0 0;}
.nx-tile-price{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:500;font-size:14px;color:#0F172A;flex-shrink:0;}
.nx-empty{padding:24px;text-align:center;color:#64748B;font-size:13px;}
.nx-check{width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#34D399,#10B981);display:flex;align-items:center;justify-content:center;color:#fff;font-size:24px;margin:0 auto 12px;font-weight:700;}
.nx-error{padding:12px;border-radius:8px;background:#FEE2E2;border:1px solid #FECACA;color:#991B1B;font-size:13px;}
.nx-payment-options{margin:8px 0 14px;display:flex;flex-direction:column;gap:6px;}
.nx-payment-option{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-radius:8px;border:1px solid #E2E8F0;background:#fff;}
.nx-actions{display:flex;flex-direction:column;gap:8px;}
.nx-btn{display:flex;align-items:center;justify-content:space-between;width:100%;padding:13px 16px;border-radius:10px;font-size:14px;font-weight:600;font-family:inherit;cursor:pointer;border:0;transition:transform .1s,box-shadow .15s,filter .15s;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none;}
.nx-btn *{pointer-events:none;}
.nx-btn-meta{font-size:11px;font-weight:500;opacity:.7;letter-spacing:.2px;}
.nx-btn-primary{background:linear-gradient(135deg,#67E8F9,#818CF8 50%,#C084FC);color:#0B0F2A;box-shadow:0 1px 2px rgba(15,23,42,.10),0 8px 22px rgba(129,140,248,.25);}
.nx-btn-primary:hover{filter:brightness(1.04);box-shadow:0 1px 2px rgba(15,23,42,.10),0 12px 30px rgba(129,140,248,.32);}
.nx-btn-primary:active{transform:scale(.99);}
.nx-btn-secondary{background:#fff;color:#0F172A;border:1px solid #E2E8F0;}
.nx-btn-secondary:hover{border-color:#818CF8;background:#F8FAFC;}
.nx-btn-secondary:active{transform:scale(.99);}
.nx-btn:focus-visible{outline:none;box-shadow:0 0 0 3px rgba(129,140,248,.30);}
.nx-btn-chatgpt-pay{background:#000;color:#fff;}
.nx-btn-chatgpt-pay:hover{background:#1A1A1A;box-shadow:0 1px 2px rgba(0,0,0,.2),0 8px 22px rgba(0,0,0,.18);}
.nx-pay-toast{margin-bottom:10px;padding:10px 12px;border-radius:8px;font-size:12px;line-height:1.5;}
.nx-pay-toast-ok{background:#ECFDF5;border:1px solid #A7F3D0;color:#065F46;}
.nx-pay-toast-err{background:#FFFBEB;border:1px solid #FDE68A;color:#92400E;}
`;

/**
 * Boilerplate that wires the iframe to the host's data feed.
 *
 * OpenAI Apps SDK injects a `window.openai` global with `toolOutput` set from
 * page load and fires an `openai:set_globals` event whenever it changes. We
 * read that synchronously, retry on tick(s) for race conditions, and ALSO
 * listen for raw postMessage as a fallback for non-OpenAI MCP hosts (Claude
 * Desktop, MCP Inspector). On the first 1.5s with no data, we show debug info
 * so we can diagnose live.
 */
const POSTMSG_LISTENER = `
const root = document.getElementById('root');
let __rendered = false;
let __lastData = null;
function fmt(c){if(c==null)return '$—';return '$'+(Number(c)/100).toFixed(2);}
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
// Call another tool from inside the widget. Tries every plausible API surface
// the host might expose. Falls through to a follow-up prompt, then postMessage,
// then a visible debug overlay if everything failed.
// Strategy: sendFollowUpMessage creates a new turn (which is what we want for
// navigation between widget types). Per host limitation, the prompt routes
// through the agent — so prompts must be UNAMBIGUOUS, naming the exact tool.
function callTool(name,args,fallbackPrompt){
  const o=window.openai;
  if(!o)return;
  if(typeof o.sendFollowUpMessage==='function'&&fallbackPrompt){
    try{o.sendFollowUpMessage({prompt:fallbackPrompt});return;}catch(e){}
  }
  // Only fall through to callTool if we have a tool name and no follow-up worked
  if(name&&typeof o.callTool==='function'){
    try{o.callTool(name,args||{});}catch(e){}
  }
}
// (API inspector removed — debug surfaced what we needed, see git history.)
function __showCallDebug(info){/* dev-only no-op now that clicks work */void info;}
window.callTool=callTool; // expose for any inline handlers
// Delegated click/key handler. Tiles set data-call-tool, data-args (JSON), and
// data-prompt. We listen once on the root and route to callTool. This avoids
// inline onclick attributes that some iframe sandboxes/CSPs filter out.
function __onActivate(e){
  // Native ChatGPT-Pay button — call window.openai.requestCheckout directly
  const payBtn=e.target&&e.target.closest&&e.target.closest('[data-action="chatgpt-pay"]');
  if(payBtn){
    e.preventDefault();
    payBtn.style.opacity='0.6';
    setTimeout(()=>{payBtn.style.opacity='';},250);
    __chatgptPay();
    return;
  }
  const t=e.target&&e.target.closest&&e.target.closest('[data-call-tool],[data-prompt-only]');
  if(!t)return;
  e.preventDefault();
  const tool=t.getAttribute('data-call-tool');
  const promptText=t.getAttribute('data-prompt')||'';
  let args={};
  try{args=JSON.parse(t.getAttribute('data-args')||'{}');}catch(err){}
  callTool(tool||null,args,promptText);
  // Visual feedback so user knows click registered
  t.style.opacity='0.6';
  setTimeout(()=>{t.style.opacity='';},250);
}
// Trigger OpenAI's native checkout sheet. Prototype — gracefully shows what
// happened (sheet opened / not enabled / errored) so we know whether
// Instant Checkout is enabled for this App in dev mode.
function __chatgptPay(){
  const ctx=window.__nx_pay_ctx;
  if(!ctx){__payToast('err','No item context available');return;}
  const o=window.openai;
  if(!o||typeof o.requestCheckout!=='function'){
    __payToast('err','requestCheckout is not available on this host (try a newer ChatGPT build).');
    return;
  }
  // Build the checkout request. Schema is OpenAI-defined; we send a generous
  // shape and they'll ignore unknown fields. Adjust once docs are confirmed.
  const payload={
    merchant:{id:ctx.merchantId,name:ctx.merchantName},
    items:[{
      id:ctx.productId,
      sku:ctx.sku,
      name:ctx.productTitle,
      quantity:1,
      unitPriceCents:ctx.priceCents,
      currency:ctx.currency||'USD',
    }],
    totalCents:ctx.priceCents,
    currency:ctx.currency||'USD',
    captureMethod:'automatic',
  };
  __payToast('info','Opening ChatGPT pay sheet…');
  try{
    const r=o.requestCheckout(payload);
    if(r&&typeof r.then==='function'){
      r.then((result)=>{
        __payToast('ok','Payment confirmed — token: '+(result&&(result.paymentToken||result.token||result.id)||'(no token returned)'));
      }).catch((err)=>{
        const m=String(err&&err.message||err);
        __payToast('err','Pay sheet error: '+m);
      });
    }else{
      __payToast('ok','requestCheckout invoked (sync return — '+JSON.stringify(r)+')');
    }
  }catch(err){
    __payToast('err','requestCheckout threw: '+String(err&&err.message||err));
  }
}
function __payToast(kind,msg){
  let host=document.querySelector('.nx-actions');
  if(!host){host=document.body;}
  let el=document.getElementById('__nx_pay_toast');
  if(!el){
    el=document.createElement('div');
    el.id='__nx_pay_toast';
    el.className='nx-pay-toast';
    host.parentNode.insertBefore(el,host);
  }
  el.className='nx-pay-toast '+(kind==='ok'?'nx-pay-toast-ok':kind==='err'?'nx-pay-toast-err':'nx-pay-toast-ok');
  el.textContent=msg;
}
document.addEventListener('click',__onActivate,true);
document.addEventListener('keydown',function(e){
  if(e.key!=='Enter'&&e.key!==' ')return;
  const t=e.target;
  if(!t||!t.closest||!t.closest('[data-call-tool],[data-prompt-only]'))return;
  __onActivate(e);
},true);
function safeRender(data){
  if(!data||(typeof data==='object'&&Object.keys(data).length===0))return false;
  // Server-reported error data: render a uniform error card instead of letting
  // the widget render empty placeholders against a missing payload.
  if(data&&typeof data==='object'&&data.error&&typeof data.error==='object'){
    const msg=data.error.message||data.error.code||'Something went wrong. Please try again.';
    root.innerHTML='<div class="nx-card"><p class="nx-eyebrow">Couldn&rsquo;t complete that</p><div class="nx-error">'+escapeHtml(String(msg))+'</div></div>';
    __rendered=true;return true;
  }
  try{render(data);__rendered=true;return true;}
  catch(err){root.innerHTML='<div class="nx-card"><div class="nx-error">Render error: '+escapeHtml(err.message)+'</div></div>';return true;}
}
function readOpenAI(){
  try{
    const o=window.openai;
    if(!o)return false;
    const d=o.toolOutput||o.tool_output||o.structuredContent||(o.toolResponse&&o.toolResponse.structuredContent)||null;
    return d?safeRender(d):false;
  }catch(e){return false;}
}
// Synchronous attempt + retries for race conditions
readOpenAI();
[0,50,200,500,1000].forEach(ms=>setTimeout(()=>{if(!__rendered)readOpenAI();},ms));
// OpenAI Apps SDK event for live updates
window.addEventListener('openai:set_globals',()=>readOpenAI(),{passive:true});
window.addEventListener('openai:tool_response',(e)=>{const d=(e&&e.detail)||{};safeRender(d.structuredContent||d.toolOutput||d);},{passive:true});
// Fallback: raw postMessage protocol for non-OpenAI hosts
window.addEventListener('message',(e)=>{
  const m=e.data;if(!m||typeof m!=='object')return;
  // Match a range of plausible message shapes
  let payload=null;
  if(m.jsonrpc==='2.0'&&m.method&&/tool[_-]?(result|response|output)/i.test(m.method)){
    payload=(m.params&&(m.params.structuredContent||m.params.toolOutput||m.params.data||m.params))||null;
  } else if(m.type&&/tool[_-]?(result|response|output)|set[_-]?globals/i.test(m.type)){
    payload=m.payload||m.data||m.toolOutput||m.structuredContent||null;
  } else if(m.toolOutput||m.structuredContent){
    payload=m.toolOutput||m.structuredContent;
  }
  if(payload)safeRender(payload);
},{passive:true});
// Signal ready (harmless if ignored)
try{window.parent&&window.parent.postMessage({jsonrpc:'2.0',method:'ui/ready'},'*');}catch(e){}
// Debug overlay — gated behind ?debug=1 so the inspector doesn't flash on slow data.
// If nothing arrived in 1.5s AND debug is on, dump what we can see.
if(/[?&]debug=1\b/.test(location.search||'')){
  setTimeout(()=>{
    if(__rendered)return;
    const dbg={
      hasWindowOpenAI: !!window.openai,
      openaiKeys: window.openai?Object.keys(window.openai):[],
      toolOutputType: window.openai&&typeof window.openai.toolOutput,
      href: location.href,
    };
    root.innerHTML='<div class="nx-card"><p class="nx-eyebrow">Widget debug</p><pre style="margin:0;font-size:11px;font-family:ui-monospace,monospace;color:#475569;white-space:pre-wrap;">'+escapeHtml(JSON.stringify(dbg,null,2))+'</pre></div>';
  },1500);
}
`;

interface WidgetSpec {
  emptyHtml: string;
  renderJs: string; // body of render(data) — has access to root, fmt(), escapeHtml()
}

const WIDGETS: Record<WidgetName, WidgetSpec> = {
  // ── MerchantList (multi-state: merchants / categories / products) ──────
  // The same widget instance can show 3 different shopping views by detecting
  // the shape of the data passed in. This sidesteps the OpenAI Apps SDK
  // limitation where openai.callTool sometimes silently no-ops, and avoids
  // routing through the agent (which often misroutes requests). All buttons
  // here use sendFollowUpMessage with HIGHLY explicit prompts that include the
  // tool name and exact args.
  'merchant-list': {
    emptyHtml: `<div class="nx-card"><div class="nx-empty">Loading…</div></div>`,
    renderJs: `
      // Multi-state widget — detects which shopping view to render
      // ── Products view (highest priority) ─────────────────────────────
      if (Array.isArray(data.products) && data.products.length >= 0 && data.merchantId) {
        renderProducts(data);
        return;
      }
      // ── Categories view ──────────────────────────────────────────────
      if (Array.isArray(data.categories) && data.categories.length >= 0 && data.merchantId) {
        renderCategories(data);
        return;
      }
      // ── Merchant list (default) ──────────────────────────────────────
      renderMerchants(data);
      return;

      function renderMerchants(data) {
        const merchants = data.merchants || [];
        if (!merchants.length) {
          root.innerHTML = '<div class="nx-card"><div class="nx-empty">No stores available right now.</div></div>';
          return;
        }
        const tiles = merchants.map(m => {
          const id = m.id || '';
          const name = m.displayName || '';
          const args = JSON.stringify({merchantId:id}).replace(/"/g,'&quot;');
          // Mentioning "categories" explicitly is load-bearing — without it the
          // GPT routes "Browse <name>" back to list_merchants instead of
          // list_categories. The tool description lists this exact trigger phrase.
          const prompt = escapeHtml('Show me categories at ' + name);
          return \`
            <div class="nx-tile nx-tile-clickable" role="button" tabindex="0"
                 data-call-tool="list_categories"
                 data-args="\${args}"
                 data-prompt="\${prompt}">
              <div class="nx-tile-img"></div>
              <div class="nx-tile-body">
                <p class="nx-tile-title">\${escapeHtml(name)}</p>
                <p class="nx-tile-meta">\${escapeHtml(m.domain || '')}\${m.platform ? ' · <span class="nx-pill">' + escapeHtml(m.platform) + '</span>' : ''}</p>
              </div>
              <div class="nx-tile-meta" style="align-self:center;color:#818CF8;font-weight:500;">Browse →</div>
            </div>\`;
        }).join('');
        root.innerHTML = '<div class="nx-card"><p class="nx-eyebrow">Available stores</p><h3 class="nx-title">' + merchants.length + ' ' + (merchants.length===1?'store':'stores') + '</h3>' + tiles + '</div>';
      }

      function renderCategories(data) {
        const cats = data.categories || [];
        const merchantId = data.merchantId || '';
        if (!cats.length) {
          root.innerHTML = '<div class="nx-card"><div class="nx-empty">No categories available.</div></div>';
          return;
        }
        const tiles = cats.map(c => {
          const safeName = escapeHtml(c.name || '');
          const argsObj = {merchantId, category: c.name, limit: 24};
          const args = JSON.stringify(argsObj).replace(/"/g,'&quot;');
          const prompt = escapeHtml('Show me ' + (c.name || '') + ' products');
          const bg = c.sampleImage ? "background-image:url('" + c.sampleImage + "');" : '';
          return \`
            <div class="nx-cat" role="button" tabindex="0"
                 data-call-tool="search_products"
                 data-args="\${args}"
                 data-prompt="\${prompt}">
              <div class="nx-cat-img" style="\${bg}"></div>
              <div class="nx-cat-overlay"></div>
              <div class="nx-cat-text">
                <p class="nx-cat-name">\${safeName}</p>
                <p class="nx-cat-count">\${c.productCount || 0} \${c.productCount === 1 ? 'item' : 'items'}</p>
              </div>
            </div>\`;
        }).join('');
        root.innerHTML = '<div class="nx-card">' +
          '<p class="nx-eyebrow">Browse</p>' +
          '<h3 class="nx-title">Shop by category</h3>' +
          '<div class="nx-cat-grid">' + tiles + '</div>' +
        '</div>';
      }

      function renderProducts(data) {
        const products = data.products || [];
        const merchantId = data.merchantId || '';
        const filterCategory = data.category || '';
        if (!products.length) {
          root.innerHTML = '<div class="nx-card"><p class="nx-eyebrow">Browse</p><div class="nx-empty">No products in this category.</div></div>';
          return;
        }
        const tiles = products.map(p => {
          const imgUrl = p.images && p.images[0] ? p.images[0] : '';
          const stock = (p.inventoryQuantity != null && p.inventoryQuantity > 0);
          const stockClass = stock ? 'nx-prod-stock' : 'nx-prod-stock nx-prod-stock-out';
          const stockText = stock ? '● In stock' : '○ Out of stock';
          const pid = p.id || '';
          const ptitle = p.title || '';
          const args = JSON.stringify({merchantId,productId:pid}).replace(/"/g,'&quot;');
          const prompt = escapeHtml('Tell me about ' + ptitle);
          const handoffArgs = JSON.stringify({merchantId, items:[{productId:pid, quantity:1}]}).replace(/"/g,'&quot;');
          const addPrompt = escapeHtml('Add 1 ' + ptitle + ' to my cart');
          const buyPrompt = escapeHtml('Generate a secure browser checkout link for 1 ' + ptitle);
          const bg = imgUrl ? "background-image:url('" + imgUrl + "');" : '';
          return \`
            <div class="nx-prod" role="button" tabindex="0"
                 data-call-tool="get_product" data-args="\${args}" data-prompt="\${prompt}">
              <div class="nx-prod-img" style="\${bg}"></div>
              <div class="nx-prod-body">
                <p class="nx-prod-title">\${escapeHtml(ptitle)}</p>
                <div class="nx-prod-price">\${fmt(p.priceCents)}</div>
                <div class="\${stockClass}">\${stockText}</div>
                <div style="display:flex;gap:4px;margin-top:8px;">
                  <button style="flex:1;padding:6px 4px;font-size:10px;font-weight:600;border-radius:6px;border:1px solid #E2E8F0;background:#fff;color:#475569;cursor:pointer;pointer-events:auto;font-family:inherit;"
                          data-prompt-only="1" data-prompt="\${addPrompt}" title="Add to cart">＋ Add</button>
                  <button style="flex:1;padding:6px 4px;font-size:10px;font-weight:600;border-radius:6px;border:1px solid #E2E8F0;background:#fff;color:#475569;cursor:pointer;pointer-events:auto;font-family:inherit;"
                          data-call-tool="get_product" data-args="\${args}" data-prompt="\${prompt}" title="View details">Details</button>
                  <button style="flex:1;padding:6px 4px;font-size:10px;font-weight:700;border-radius:6px;border:0;background:linear-gradient(135deg,#67E8F9,#818CF8 50%,#C084FC);color:#0B0F2A;cursor:pointer;pointer-events:auto;font-family:inherit;"
                          data-call-tool="create_handoff" data-args="\${handoffArgs}" data-prompt="\${buyPrompt}" title="Checkout">↗ Buy</button>
                </div>
              </div>
            </div>\`;
        }).join('');
        const titleText = filterCategory || 'All products';
        const eyebrowText = filterCategory ? 'Category' : 'Products';
        // Chip strip — categories derived from current product set
        const cats = Array.from(new Set(products.flatMap(p => (p.categories||[])))).slice(0, 8);
        const chipStrip = cats.length ? (
          '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;">' +
            (filterCategory ? (
              '<button data-call-tool="list_categories" data-args="' + JSON.stringify({merchantId}).replace(/"/g,'&quot;') + '" data-prompt="Show all categories" style="padding:5px 10px;border-radius:999px;border:1px solid #E2E8F0;background:#F8FAFC;color:#475569;font-size:12px;font-weight:500;cursor:pointer;font-family:inherit;">← All categories</button>'
            ) : '') +
            cats.map(c => {
              const safeC = escapeHtml(c).replace(/"/g,'&quot;');
              const cArgs = JSON.stringify({merchantId,category:c,limit:24}).replace(/"/g,'&quot;');
              const cPrompt = 'Show me ' + safeC + ' products';
              const active = filterCategory === c;
              const style = active
                ? 'padding:5px 10px;border-radius:999px;border:1px solid #818CF8;background:#EEF2FF;color:#3730A3;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;'
                : 'padding:5px 10px;border-radius:999px;border:1px solid #E2E8F0;background:#fff;color:#475569;font-size:12px;font-weight:500;cursor:pointer;font-family:inherit;';
              return '<button data-call-tool="search_products" data-args="' + cArgs + '" data-prompt="' + cPrompt + '" style="' + style + '">' + safeC + '</button>';
            }).join('') +
          '</div>'
        ) : '';
        root.innerHTML = '<div class="nx-card">' +
          '<p class="nx-eyebrow">' + eyebrowText + '</p>' +
          '<h3 class="nx-title">' + escapeHtml(titleText) + ' · ' + products.length + ' ' + (products.length===1?'item':'items') + '</h3>' +
          chipStrip +
          '<div class="nx-prod-grid">' + tiles + '</div>' +
        '</div>';
      }
    `,
  },

  // ── CategoryGrid ──────────────────────────────────────────────────────
  'category-grid': {
    emptyHtml: `<div class="nx-card"><div class="nx-empty">Loading categories…</div></div>`,
    renderJs: `
      const cats = data.categories || [];
      const merchantId = data.merchantId || '';
      if (!cats.length) {
        root.innerHTML = '<div class="nx-card"><div class="nx-empty">No categories yet.</div></div>';
        return;
      }
      const tiles = cats.map(c => {
        const safeName = escapeHtml(c.name || '');
        const argsObj = {merchantId, category: c.name, limit: 24};
        const args = JSON.stringify(argsObj).replace(/"/g,'&quot;');
        const prompt = escapeHtml('Show me ' + (c.name || '') + ' products');
        const bg = c.sampleImage ? "background-image:url('" + c.sampleImage + "');" : '';
        return \`
          <div class="nx-cat" role="button" tabindex="0"
               data-call-tool="search_products"
               data-args="\${args}"
               data-prompt="\${prompt}">
            <div class="nx-cat-img" style="\${bg}"></div>
            <div class="nx-cat-overlay"></div>
            <div class="nx-cat-text">
              <p class="nx-cat-name">\${safeName}</p>
              <p class="nx-cat-count">\${c.productCount || 0} \${c.productCount === 1 ? 'item' : 'items'}</p>
            </div>
          </div>\`;
      }).join('');
      root.innerHTML = '<div class="nx-card">' +
        '<p class="nx-eyebrow">Browse</p>' +
        '<h3 class="nx-title">Shop by category</h3>' +
        '<div class="nx-cat-grid">' + tiles + '</div>' +
      '</div>';
    `,
  },

  // ── ProductGrid ───────────────────────────────────────────────────────
  'product-grid': {
    emptyHtml: `<div class="nx-card"><div class="nx-empty">Searching…</div></div>`,
    renderJs: `
      const products = data.products || [];
      const merchantId = data.merchantId || '';
      const filterCategory = data.category || '';
      const filterQuery = data.q || '';
      if (!products.length) {
        const backArgs = JSON.stringify({merchantId}).replace(/"/g,'&quot;');
        root.innerHTML = '<div class="nx-card">' +
          '<p class="nx-breadcrumb">' +
            (merchantId ? '<a class="nx-breadcrumb-link" data-call-tool="list_categories" data-args="' + backArgs + '" data-prompt="Show all categories">All categories</a>' : 'Search') +
          '</p>' +
          '<div class="nx-empty">No products matched. Try a different category or search term.</div>' +
        '</div>';
        return;
      }
      const tiles = products.map(p => {
        const imgUrl = p.images && p.images[0] ? p.images[0] : '';
        const stock = (p.inventoryQuantity != null && p.inventoryQuantity > 0);
        const stockClass = stock ? 'nx-prod-stock' : 'nx-prod-stock nx-prod-stock-out';
        const stockText = stock ? '● In stock' : '○ Out of stock';
        const pid = p.id || '';
        const ptitle = p.title || '';
        const args = merchantId
          ? JSON.stringify({merchantId,productId:pid}).replace(/"/g,'&quot;')
          : '';
        const prompt = merchantId
          ? escapeHtml('Tell me about ' + ptitle)
          : escapeHtml('Tell me more about ' + ptitle);
        const clickAttrs = merchantId
          ? 'role="button" tabindex="0" data-call-tool="get_product" data-args="' + args + '" data-prompt="' + prompt + '"'
          : 'data-prompt-only="1" data-prompt="' + prompt + '" role="button" tabindex="0"';
        const bg = imgUrl ? "background-image:url('" + imgUrl + "');" : '';
        // 3-button action row — only when we have a merchantId (needed for handoff)
        const handoffArgs = merchantId
          ? JSON.stringify({merchantId, items:[{productId:pid, quantity:1}]}).replace(/"/g,'&quot;')
          : '';
        const addPrompt = escapeHtml('Add 1 ' + ptitle + ' to my cart');
        const buyPrompt = escapeHtml('Generate a secure browser checkout link for 1 ' + ptitle);
        const tileActions = merchantId ? (
          '<div style="display:flex;gap:4px;margin-top:8px;">' +
            '<button style="flex:1;padding:6px 4px;font-size:10px;font-weight:600;border-radius:6px;border:1px solid #E2E8F0;background:#fff;color:#475569;cursor:pointer;pointer-events:auto;font-family:inherit;"' +
                   ' data-prompt-only="1" data-prompt="' + addPrompt + '" title="Add to cart">＋ Add</button>' +
            '<button style="flex:1;padding:6px 4px;font-size:10px;font-weight:600;border-radius:6px;border:1px solid #E2E8F0;background:#fff;color:#475569;cursor:pointer;pointer-events:auto;font-family:inherit;"' +
                   ' data-call-tool="get_product" data-args="' + args + '" data-prompt="' + prompt + '" title="View details">Details</button>' +
            '<button style="flex:1;padding:6px 4px;font-size:10px;font-weight:700;border-radius:6px;border:0;background:linear-gradient(135deg,#67E8F9,#818CF8 50%,#C084FC);color:#0B0F2A;cursor:pointer;pointer-events:auto;font-family:inherit;"' +
                   ' data-call-tool="create_handoff" data-args="' + handoffArgs + '" data-prompt="' + buyPrompt + '" title="Checkout">↗ Buy</button>' +
          '</div>'
        ) : '';
        return \`
          <div class="nx-prod" \${clickAttrs}>
            <div class="nx-prod-img" style="\${bg}"></div>
            <div class="nx-prod-body">
              <p class="nx-prod-title">\${escapeHtml(ptitle)}</p>
              <div class="nx-prod-price">\${fmt(p.priceCents)}</div>
              <div class="\${stockClass}">\${stockText}</div>
              \${tileActions}
            </div>
          </div>\`;
      }).join('');
      const titleText = filterCategory
        ? filterCategory
        : filterQuery
          ? '"' + filterQuery + '"'
          : 'All products';
      const eyebrowText = filterCategory ? 'Category' : filterQuery ? 'Search results' : 'Products';
      // Category chip strip — derived from the products themselves so we don't
      // depend on the list_categories tool being in the agent's manifest.
      const cats = Array.from(new Set(products.flatMap(p => (p.categories||[])))).slice(0, 8);
      const chipStrip = cats.length && merchantId ? (
        '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;">' +
          (filterCategory ? (
            '<button data-call-tool="search_products" data-args="' + JSON.stringify({merchantId,limit:24}).replace(/"/g,'&quot;') + '" data-prompt="Show all products" style="padding:5px 10px;border-radius:999px;border:1px solid #E2E8F0;background:#F8FAFC;color:#475569;font-size:12px;font-weight:500;cursor:pointer;font-family:inherit;">← All</button>'
          ) : '') +
          cats.map(c => {
            const safeC = escapeHtml(c).replace(/"/g,'&quot;');
            const cArgs = JSON.stringify({merchantId,category:c,limit:24}).replace(/"/g,'&quot;');
            const cPrompt = 'Show ' + safeC;
            const active = filterCategory === c;
            const style = active
              ? 'padding:5px 10px;border-radius:999px;border:1px solid #818CF8;background:#EEF2FF;color:#3730A3;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;'
              : 'padding:5px 10px;border-radius:999px;border:1px solid #E2E8F0;background:#fff;color:#475569;font-size:12px;font-weight:500;cursor:pointer;font-family:inherit;';
            return '<button data-call-tool="search_products" data-args="' + cArgs + '" data-prompt="' + cPrompt + '" style="' + style + '">' + safeC + '</button>';
          }).join('') +
        '</div>'
      ) : '';
      root.innerHTML = '<div class="nx-card">' +
        '<p class="nx-eyebrow">' + eyebrowText + '</p>' +
        '<h3 class="nx-title">' + escapeHtml(titleText) + ' · ' + products.length + ' ' + (products.length===1?'item':'items') + '</h3>' +
        chipStrip +
        '<div class="nx-prod-grid">' + tiles + '</div>' +
      '</div>';
    `,
  },

  // ── ProductDetail ─────────────────────────────────────────────────────
  'product-detail': {
    emptyHtml: `<div class="nx-card"><div class="nx-empty">Loading product…</div></div>`,
    renderJs: `
      const p = data.product;
      if (!p) { root.innerHTML = '<div class="nx-card"><div class="nx-empty">Product not found.</div></div>'; return; }
      const m = data.merchant || {};
      const merchantId = m.id || '';
      const modes = m.availableModes || ['IN_APP'];
      const imgStyle = p.images && p.images[0]
        ? 'background-image:url(\\'' + escapeHtml(p.images[0]) + '\\');background-size:cover;background-position:center;'
        : 'background:linear-gradient(135deg,#E0F2FE,#EDE9FE);';
      const itemArgs = JSON.stringify({merchantId,items:[{productId:p.id,quantity:1}]}).replace(/"/g,'&quot;');
      const escTitle = escapeHtml(p.title || 'this item');
      const escMerch = escapeHtml(m.displayName || 'this store');
      // Stash payment context for the requestCheckout button (read by handler)
      window.__nx_pay_ctx = {
        merchantId,
        merchantName: m.displayName || 'Merchant',
        productId: p.id,
        productTitle: p.title,
        priceCents: p.priceCents,
        currency: p.currency || 'USD',
        sku: p.sku,
      };
      // Build action buttons based on availableModes.
      // Demo scope: only SIGNED_URL is wired end-to-end. IN_APP, MERCHANT_PAGE,
      // and CHATGPT_PAY are rendered as disabled stubs so the three-flow story
      // is visible, but they can't be tapped — keeps the demo on rails.
      const actions = [];
      const disabledStyle = 'opacity:0.45;cursor:not-allowed;filter:grayscale(0.25);';
      // Pay with ChatGPT (native, requestCheckout) — stub for demo
      actions.push(\`
        <button class="nx-btn nx-btn-secondary" disabled aria-disabled="true" style="\${disabledStyle}">
          <span>⚡ Pay with ChatGPT</span>
          <span class="nx-btn-meta">Coming soon</span>
        </button>\`);
      // Add to cart — neutral (sends a chat message)
      actions.push(\`
        <button class="nx-btn nx-btn-secondary"
                data-prompt-only="1"
                data-prompt="Add 1 \${escTitle} to my cart">
          <span>＋ Add to cart</span>
        </button>\`);
      // Buy now in chat (IN_APP) — stub for demo, gated by merchant mode
      if (modes.indexOf('IN_APP') >= 0) {
        actions.push(\`
          <button class="nx-btn nx-btn-secondary" disabled aria-disabled="true" style="\${disabledStyle}">
            <span>🔒 Buy via Nexus card-on-file</span>
            <span class="nx-btn-meta">Coming soon</span>
          </button>\`);
      }
      // Pay via secure link (SIGNED_URL) — Flow B, browser handoff. The only
      // checkout flow that's live for the demo.
      if (modes.indexOf('SIGNED_URL') >= 0) {
        actions.push(\`
          <button class="nx-btn nx-btn-primary"
                  data-call-tool="create_handoff"
                  data-args="\${itemArgs}"
                  data-prompt="Generate a secure browser checkout link for 1 \${escTitle}">
            <span>↗ Open secure link</span>
            <span class="nx-btn-meta">browser</span>
          </button>\`);
      }
      // Pay on merchant site (MERCHANT_PAGE) — stub for demo
      if (modes.indexOf('MERCHANT_PAGE') >= 0) {
        actions.push(\`
          <button class="nx-btn nx-btn-secondary" disabled aria-disabled="true" style="\${disabledStyle}">
            <span>🏬 Pay on \${escMerch}</span>
            <span class="nx-btn-meta">Coming soon</span>
          </button>\`);
      }
      const optionsLabel = m.isMock
        ? '<p class="nx-eyebrow" style="margin:14px 0 8px;">Demo · all 3 options</p>'
        : modes.length > 1
          ? '<p class="nx-eyebrow" style="margin:14px 0 8px;">Checkout options</p>'
          : '<p class="nx-eyebrow" style="margin:14px 0 8px;">Checkout</p>';
      root.innerHTML = '<div class="nx-card">' +
        '<div style="width:100%;aspect-ratio:16/9;border-radius:10px;margin-bottom:14px;' + imgStyle + '"></div>' +
        '<h3 class="nx-title">' + escapeHtml(p.title) + '</h3>' +
        '<p class="nx-tile-meta" style="margin-bottom:10px;">SKU ' + escapeHtml(p.sku || '') + (m.displayName ? ' · ' + escMerch : '') + '</p>' +
        (p.description ? '<p style="font-size:13px;color:#475569;margin:0 0 14px;line-height:1.55;">' + escapeHtml(p.description) + '</p>' : '') +
        '<div class="nx-grand" style="margin-bottom:4px;"><span class="nx-grand-label">Price</span><span class="nx-grand-amount">' + fmt(p.priceCents) + '</span></div>' +
        optionsLabel +
        '<div class="nx-actions">' + actions.join('') + '</div>' +
      '</div>';
    `,
  },

  // ── OrderSummary ──────────────────────────────────────────────────────
  'order-summary': {
    emptyHtml: `<div class="nx-card"><div class="nx-empty">Building order summary…</div></div>`,
    renderJs: `
      const c = data.checkout || data;
      const items = (c.metadata && c.metadata.items) || [];
      const checkoutId = c.id || c.checkoutId || '';
      const totalCents = c.totalCents || 0;
      const merchantName = c.merchantName || 'Order';
      // Stash for the chatgpt-pay button
      window.__nx_pay_ctx = {
        merchantId: c.merchantId,
        merchantName: merchantName,
        productId: items[0] && items[0].sku,
        productTitle: items.length === 1 ? items[0].title : (items.length + ' items'),
        priceCents: totalCents,
        currency: c.currency || 'USD',
        sku: items[0] && items[0].sku,
        checkoutId: checkoutId,
      };
      const itemHtml = items.map(it => \`
        <div class="nx-row">
          <div>
            <div style="font-weight:500;">\${escapeHtml(it.title)}</div>
            <div class="nx-meta">SKU \${escapeHtml(it.sku)} · Qty \${it.quantity}</div>
          </div>
          <div class="nx-amount">\${fmt(it.lineTotalCents)}</div>
        </div>\`).join('');
      const escMerch = escapeHtml(merchantName);
      // Demo scope: in-chat checkout is disabled. If the GPT routes the user
      // here anyway (e.g. they typed "buy this"), payment buttons are rendered
      // as disabled stubs so the path can't complete. The shopper is directed
      // back to "Open secure link" on the product card.
      const disabledStyle = 'opacity:0.45;cursor:not-allowed;filter:grayscale(0.25);';
      root.innerHTML = '<div class="nx-card"><p class="nx-eyebrow">Order summary</p>' +
        '<h3 class="nx-title">' + escMerch + '</h3>' +
        '<div>' + itemHtml + '</div>' +
        '<div class="nx-totals">' +
          '<div class="nx-totals-row"><span>Subtotal</span><span class="nx-amount">' + fmt(c.subtotalCents) + '</span></div>' +
          '<div class="nx-totals-row"><span>Shipping</span><span class="nx-amount">' + fmt(c.shippingCostCents) + '</span></div>' +
          '<div class="nx-totals-row"><span>Tax</span><span class="nx-amount">' + fmt(c.taxCents) + '</span></div>' +
          '<div class="nx-grand"><span class="nx-grand-label">Total</span><span class="nx-grand-amount">' + fmt(totalCents) + '</span></div>' +
        '</div>' +
        '<div class="nx-banner" style="margin-top:14px;">In-chat checkout is coming soon. Open the product card and tap <strong>↗ Open secure link</strong> to complete payment in the browser.</div>' +
        '<div class="nx-actions" style="margin-top:14px;">' +
          '<button class="nx-btn nx-btn-secondary" disabled aria-disabled="true" style="' + disabledStyle + '">' +
            '<span>⚡ Pay with ChatGPT</span>' +
            '<span class="nx-btn-meta">Coming soon</span>' +
          '</button>' +
          '<button class="nx-btn nx-btn-secondary" disabled aria-disabled="true" style="' + disabledStyle + '">' +
            '<span>🔒 Confirm &amp; Pay ' + fmt(totalCents) + '</span>' +
            '<span class="nx-btn-meta">Coming soon</span>' +
          '</button>' +
        '</div>' +
      '</div>';
    `,
  },

  // ── PaymentSheet ──────────────────────────────────────────────────────
  'payment-sheet': {
    emptyHtml: `<div class="nx-card"><div class="nx-empty">Preparing payment…</div></div>`,
    renderJs: `
      const total = data.totalCents || (data.checkout && data.checkout.totalCents) || 0;
      const merchant = data.merchantName || (data.checkout && data.checkout.merchantName) || 'Merchant';
      const pm = data.paymentMethod || { brand: 'visa', last4: '4242' };
      const brand = pm.brand[0].toUpperCase() + pm.brand.slice(1);
      root.innerHTML = '<div class="nx-card"><p class="nx-eyebrow">Confirm payment</p>' +
        '<h3 class="nx-title">Pay ' + fmt(total) + ' to ' + escapeHtml(merchant) + '</h3>' +
        '<div class="nx-payment-options">' +
          (data.showApplePay !== false ? '<div class="nx-payment-option"><span>🍎 <strong>Apple Pay</strong></span><span class="nx-pill">Face ID</span></div>' : '') +
          '<div class="nx-payment-option"><span>💳 <strong>' + escapeHtml(brand) + '</strong> ending ' + escapeHtml(pm.last4) + '</span><span class="nx-pill nx-pill-success">Default</span></div>' +
          (data.showShopPay ? '<div class="nx-payment-option"><span>💚 <strong>Shop Pay</strong></span><span class="nx-pill">Saved</span></div>' : '') +
        '</div>' +
        '<button class="nx-button nx-button-gradient" onclick="window.parent.postMessage({jsonrpc:\\'2.0\\',method:\\'ui/notifications/user-action\\',params:{action:\\'confirm-payment\\'}},\\'*\\')">🔒 Confirm payment</button>' +
      '</div>';
    `,
  },

  // ── CheckoutLink ──────────────────────────────────────────────────────
  'checkout-link': {
    emptyHtml: `<div class="nx-card"><div class="nx-empty">Generating link…</div></div>`,
    renderJs: `
      const total = data.totalCents || 0;
      const merchant = data.merchantName || 'Merchant';
      const url = data.checkoutUrl || '#';
      const isPlatform = data.checkoutHost === 'platform';
      const where = isPlatform
        ? "You'll be sent to <strong>" + escapeHtml(merchant) + "</strong> to complete payment."
        : 'Secure checkout hosted by Agentix.';
      const expires = data.expiresAt ? new Date(data.expiresAt) : new Date(Date.now() + 60*60_000);
      const minutes = Math.max(0, Math.round((expires.getTime() - Date.now())/60_000));
      const rawOrderId = data.pendingOrderId || data.orderId || '';
      const orderId = rawOrderId.slice(0,8).toUpperCase();
      // Post-checkout signal: once the shopper completes payment in the browser
      // and returns to chat, this tap-to-confirm action calls get_order_status
      // with the pendingOrderId. Nexus auto-bridges pendingOrder → Order on
      // payment completion, so the OrderStatusCard renders with the confirmation
      // summary inline. True autonomous push-back is a future webhook project.
      const statusArgs = JSON.stringify({orderId: rawOrderId}).replace(/"/g,'&quot;');
      const statusPrompt = 'Did my order go through?';
      const statusBtn = rawOrderId ? (
        '<button class="nx-btn nx-btn-secondary" style="margin-top:10px;"' +
                ' data-call-tool="get_order_status"' +
                ' data-args="' + statusArgs + '"' +
                ' data-prompt="' + statusPrompt + '">' +
          '<span>✓ Check order status</span>' +
          '<span class="nx-btn-meta">after paying</span>' +
        '</button>'
      ) : '';
      root.innerHTML = '<div class="nx-card"><p class="nx-eyebrow">Checkout link ready</p>' +
        '<h3 class="nx-title">' + escapeHtml(merchant) + ' · ' + fmt(total) + '</h3>' +
        '<p class="nx-meta" style="margin-bottom:12px;">Order ' + escapeHtml(orderId) + ' · Expires in ' + minutes + ' min</p>' +
        '<a href="' + escapeHtml(url) + '" target="_top" class="nx-button nx-button-gradient" style="text-decoration:none;">🔒 Open secure checkout →</a>' +
        statusBtn +
        '<p style="margin-top:10px;font-size:12px;color:#64748B;">' + where + ' Once you\\'ve paid, tap <strong>Check order status</strong> to confirm.</p>' +
      '</div>';
    `,
  },

  // ── OrderConfirmation ─────────────────────────────────────────────────
  'order-confirmation': {
    emptyHtml: `<div class="nx-card"><div class="nx-empty">Confirming…</div></div>`,
    renderJs: `
      const order = data.order || {};
      const payment = data.payment || {};
      const total = payment.amountCents || order.totalCents || 0;
      const merchant = order.merchantName || '';
      const summary = payment.summary || '';
      const mode = payment.mode || 'demo';
      const number = order.orderNumber || '—';
      const banner = mode === 'demo'
        ? '<div class="nx-banner">Demo mode — no real charge was processed.</div>'
        : '';
      root.innerHTML = '<div class="nx-card"><div style="text-align:center;">' +
        '<div class="nx-check">✓</div>' +
        '<h3 class="nx-title">Order confirmed</h3>' +
        (merchant ? '<p class="nx-meta" style="margin-bottom:14px;">' + escapeHtml(merchant) + '</p>' : '') +
        '<div class="nx-grand-amount" style="font-size:28px;">' + fmt(total) + '</div>' +
        (summary ? '<p style="margin:8px 0 14px;color:#475569;font-size:13px;">' + escapeHtml(summary) + '</p>' : '') +
        '<div style="display:inline-block;padding:6px 12px;border-radius:6px;background:#F1F5F9;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:#0F172A;">' + escapeHtml(number) + '</div>' +
        banner +
      '</div></div>';
    `,
  },

  // ── OrderStatus ───────────────────────────────────────────────────────
  'order-status': {
    emptyHtml: `<div class="nx-card"><div class="nx-empty">Looking up order…</div></div>`,
    renderJs: `
      const o = data.order || {};
      const status = (o.status || 'PENDING').toUpperCase();
      const positive = ['CONFIRMED','SHIPPED','DELIVERED','PAID'].indexOf(status) >= 0;
      const negative = ['CANCELLED','FAILED','EXPIRED'].indexOf(status) >= 0;
      const isPending = !positive && !negative;
      // Pending state — shopper tapped "Check order status" but the
      // PendingOrder hasn't been completed yet. Show a clearer
      // "waiting for payment" message instead of a confusing $0/PENDING row.
      if (isPending) {
        const total = (o.totalCents != null) ? fmt(o.totalCents) : '';
        root.innerHTML = '<div class="nx-card" style="text-align:center;">' +
          '<div style="font-size:32px;margin-bottom:8px;">⏳</div>' +
          '<h3 class="nx-title" style="margin-bottom:6px;">Waiting for payment</h3>' +
          '<p class="nx-meta" style="margin-bottom:14px;">' +
            'We haven&rsquo;t received confirmation from the checkout page yet.' +
          '</p>' +
          (total ? '<div class="nx-grand-amount" style="font-size:24px;margin-bottom:14px;">' + total + '</div>' : '') +
          '<p style="font-size:12px;color:#64748B;line-height:1.5;">' +
            'Finish payment in the browser tab, then tap <strong>✓ Check order status</strong> again to confirm.' +
          '</p>' +
        '</div>';
        return;
      }
      const pillClass = positive ? 'nx-pill nx-pill-success' : 'nx-pill nx-pill-warn';
      const headerIcon = positive
        ? '<div class="nx-check" style="margin-bottom:10px;">✓</div>'
        : '<div style="font-size:32px;text-align:center;margin-bottom:6px;">⚠️</div>';
      const tracking = o.trackingNumber
        ? '<div class="nx-row"><span>Tracking</span><span class="nx-amount">' +
            (o.trackingUrl ? '<a href="' + escapeHtml(o.trackingUrl) + '" target="_top" style="color:#1D4ED8;">' + escapeHtml(o.trackingNumber) + '</a>' : escapeHtml(o.trackingNumber)) +
          '</span></div>'
        : '';
      const headerText = positive ? 'Order confirmed' : 'Order ' + status.toLowerCase();
      root.innerHTML = '<div class="nx-card">' +
        '<div style="text-align:center;">' + headerIcon +
          '<h3 class="nx-title" style="margin-bottom:6px;">' + escapeHtml(headerText) + '</h3>' +
          (o.orderNumber ? '<p class="nx-meta" style="margin-bottom:14px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">' + escapeHtml(o.orderNumber) + '</p>' : '') +
        '</div>' +
        '<div class="nx-row"><span>Status</span><span><span class="' + pillClass + '">' + escapeHtml(status) + '</span></span></div>' +
        (o.fulfillmentStatus ? '<div class="nx-row"><span>Fulfillment</span><span>' + escapeHtml(o.fulfillmentStatus) + '</span></div>' : '') +
        '<div class="nx-row"><span>Total</span><span class="nx-amount">' + fmt(o.totalCents) + '</span></div>' +
        tracking +
      '</div>';
    `,
  },
};

/** Generate the full iframe HTML page for a widget. */
export function widgetHtml(name: WidgetName): string {
  const spec = WIDGETS[name];
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Agentix · ${name}</title>
<style>${SHARED_CSS}</style>
</head>
<body>
<div id="root">${spec.emptyHtml}</div>
<script>
${POSTMSG_LISTENER}
function render(data) {
${spec.renderJs}
}
</script>
</body>
</html>`;
}
