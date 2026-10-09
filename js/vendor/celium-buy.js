/*!
 * Celium Buy Button. Copy-paste embed for Celium Checkout. See docs/celium-checkout.md and docs/celium-buy-button-config.md.
 * Saved embed:  <script src="https://checkout.celium.eco/buy.js" async></script> <div data-celium-embed="emb_..."></div>
 * Legacy:       <script src=".../buy.js" data-vendor="slug" data-key="csk_..." async></script>
 *               <div data-celium-product="handle"></div>   <div data-celium-shop></div>
 * Builder preview: CeliumBuy.mount(el, { vendor, key, config, apiBase }) -> { update(config), destroy() }
 */
(function () {
  'use strict';
  if (typeof window === 'undefined' || window.CeliumBuy) return;

  var scriptEl = document.currentScript || document.querySelector('script[src*="buy.js"]');
  var scriptData = scriptEl ? scriptEl.dataset : {};
  var base = '';
  try { base = new URL(scriptEl.src, location.href).origin; } catch (e) { base = location.origin; }

  // Samsara: the pinned local runtime still calls Celium's hosted storefront.
  base = 'https://checkout.celium.eco';

  var cfg = { vendor: scriptData.vendor || '', key: scriptData.key || '', accent: scriptData.accent || '', cartButton: scriptData.showCartButton || 'auto' };
  var CART_KEY = function () { return 'celium_cart_' + cfg.vendor; };
  var ATTR_KEY = 'celium_attr';

  function warn() { try { console.warn.apply(console, ['[Celium]'].concat([].slice.call(arguments))); } catch (e) {} }
  function lsGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { window.localStorage.setItem(k, v); } catch (e) {} }
  function lsDel(k) { try { window.localStorage.removeItem(k); } catch (e) {} }

  var fmt = null;
  function money(n) {
    n = Number(n) || 0;
    try {
      if (!fmt) fmt = new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' });
      return fmt.format(n).replace(/ /g, ' ').replace(/^ZAR\s?/, 'R ');
    } catch (e) {
      return 'R ' + n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    }
  }

  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (attrs[k] === null || attrs[k] === undefined || attrs[k] === false) continue;
      if (k === 'class') n.className = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
    }
    if (children) children.forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  function bool(v, d) { if (v === undefined || v === null || v === '') return d; return !(String(v) === 'false' || String(v) === '0'); }
  function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/[^a-zA-Z0-9#(),.% -]/g, ''); }
  function px(n, d) { n = Number(n); return (isFinite(n) ? n : d) + 'px'; }

  // ---------- Config ----------
  var DEF = {
    target: { type: 'product', handles: [] }, action: 'cart',
    layout: { style: 'basic', align: 'left', imageSize: 'large', columns: null, showTitle: true, showPrice: true, showCompareAt: true, showDescription: true, maxWidth: null },
    button: { text: null, bg: '#1773b0', bgHover: null, color: '#ffffff', fontFamily: null, fontSize: 14, fontWeight: 600, radius: 10, paddingY: 11, fullWidth: true, soldOutText: 'Sold out' },
    product: { cardBg: '#ffffff', cardBorder: '#e2e2e2', cardRadius: 12, cardShadow: false, titleColor: '#15171a', titleFont: null, titleSize: 15, titleWeight: 600, priceColor: '#15171a', priceSize: 14, compareAtColor: '#6b7280', textColor: '#4b5563' },
    options: { style: 'dropdown', bg: '#ffffff', color: '#15171a', borderColor: '#d4d4d8', radius: 8, selectedBg: '#15171a', selectedColor: '#ffffff', selectedBorderColor: '#15171a' },
    quantity: { style: 'stepper' },
    cart: { title: 'Your cart', checkoutText: 'Checkout', emptyText: 'Your cart is empty', noteEnabled: false, bg: '#ffffff', color: '#15171a', accent: null,
      toggle: { position: 'bottom-right', bg: null, color: '#ffffff', icon: 'bag', show: 'auto' } },
    font: { family: null, google: null }
  };
  function merge(d, s) {
    var out = {};
    for (var k in d) {
      var dv = d[k], sv = s && typeof s === 'object' ? s[k] : undefined;
      if (dv && typeof dv === 'object' && !Array.isArray(dv)) out[k] = merge(dv, sv);
      else if (Array.isArray(dv)) out[k] = Array.isArray(sv) ? sv : dv;
      else if (sv === undefined || (sv !== null && typeof sv === 'object')) out[k] = dv;
      else if (dv === null) out[k] = sv;
      else out[k] = typeof sv === typeof dv ? sv : dv;
    }
    return out;
  }
  function fill(raw) {
    var c = merge(DEF, raw);
    if (!c.layout.columns) c.layout.columns = c.target.type === 'product' ? 1 : 3;
    c.layout.columns = Math.max(1, Math.min(4, Math.round(c.layout.columns) || 1));
    if (!c.cart.accent) c.cart.accent = c.button.bg;
    if (!c.cart.toggle.bg) c.cart.toggle.bg = c.cart.accent;
    if (raw && raw._compact) c._compact = true;
    if (raw && raw._auto) c._auto = true;
    return c;
  }
  function buttonText(c, modal) {
    if (modal && c.action === 'modal') return 'Add to cart';
    if (c.button.text) return c.button.text;
    return c.action === 'buy_now' ? 'Buy now' : c.action === 'modal' && !modal ? 'View product' : 'Add to cart';
  }

  // ---------- Attribution ----------
  function captureAttribution() {
    if (lsGet(ATTR_KEY)) return;
    try {
      var q = new URLSearchParams(location.search), a = {};
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'fbclid'].forEach(function (k) { if (q.get(k)) a[k] = q.get(k); });
      if (document.referrer) a.referrer = document.referrer;
      a.landing_page = location.href;
      lsSet(ATTR_KEY, JSON.stringify(a));
    } catch (e) {}
  }
  function attribution() { try { return JSON.parse(lsGet(ATTR_KEY) || '{}') || {}; } catch (e) { return {}; } }

  // ---------- API ----------
  function api(path, method, body) {
    var headers = { 'x-celium-storefront-key': cfg.key };
    var opts = { method: method || 'GET', headers: headers };
    if (body) { headers['content-type'] = 'application/json'; opts.body = JSON.stringify(body); }
    return fetch(base + '/api/public/storefront/' + path, opts).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) { var e = new Error((j && j.error) || 'Request failed'); e.status = r.status; e.code = j && j.code; throw e; }
        return j;
      });
    });
  }

  var productsPromise = null;
  function loadProducts(force) {
    if (productsPromise && !force) return productsPromise;
    var ck = 'celium_products_' + cfg.vendor;
    if (!force) {
      try {
        var c = JSON.parse(window.sessionStorage.getItem(ck) || 'null');
        if (c && Date.now() - c.t < 60000) { productsPromise = Promise.resolve(c.d); return productsPromise; }
      } catch (e) {}
    }
    productsPromise = api('products?vendor=' + encodeURIComponent(cfg.vendor) + '&key=' + encodeURIComponent(cfg.key)).then(function (d) {
      try { window.sessionStorage.setItem(ck, JSON.stringify({ t: Date.now(), d: d })); } catch (e) {}
      return d;
    });
    productsPromise.catch(function () { productsPromise = null; });
    return productsPromise;
  }

  var embedPromises = {};
  function loadEmbed(id) {
    if (!embedPromises[id]) {
      embedPromises[id] = fetch(base + '/api/public/storefront/embed?id=' + encodeURIComponent(id)).then(function (r) {
        if (!r.ok) throw new Error('embed ' + r.status);
        return r.json();
      });
      embedPromises[id].catch(function () { delete embedPromises[id]; });
    }
    return embedPromises[id];
  }

  // ---------- Cart state ----------
  var cart = null, cartListeners = [];
  // Samsara: publish complete, confirmed cart snapshots for the tree-impact adapter.
  function setCart(c, reason) {
    cart = c;
    cartListeners.forEach(function (f) { try { f(c); } catch (e) {} });
    window.dispatchEvent(new CustomEvent('celium:cart-updated', { detail: { cart: c, reason: reason || 'restore' } }));
  }
  function onCart(f) { cartListeners.push(f); }
  function dropCart(e) { if (e && (e.status === 404 || e.status === 410)) { lsDel(CART_KEY()); setCart(null); } }

  function refreshCart() {
    var id = lsGet(CART_KEY());
    if (!id) { setCart(null); return Promise.resolve(null); }
    return api('cart?vendor=' + encodeURIComponent(cfg.vendor) + '&id=' + encodeURIComponent(id)).then(function (c) {
      setCart(c); return c;
    }).catch(function (e) {
      if (e.status === 404 || e.status === 410) dropCart(e); else warn('cart load failed', e.message);
      return null;
    });
  }
  function addToCart(variantId, qty) {
    qty = Math.max(1, parseInt(qty, 10) || 1);
    var id = lsGet(CART_KEY());
    var body = { vendor: cfg.vendor, cartId: id || undefined, lines: [{ variantId: variantId, quantity: qty }] };
    if (!id) body.attributes = attribution();
    return api('cart', 'POST', body).then(function (c) { lsSet(CART_KEY(), c.id); setCart(c, 'add'); return c; });
  }
  function patchLine(line, quantity) {
    var id = lsGet(CART_KEY());
    return api('cart', 'PATCH', { vendor: cfg.vendor, cartId: id, lines: [{ lineId: line.id, variantId: line.variantId, quantity: quantity }] })
      .then(function (c) { setCart(c, 'update'); return c; }).catch(function (e) { dropCart(e); throw e; });
  }
  function patchNote(note) {
    var id = lsGet(CART_KEY());
    if (!id) return Promise.resolve(null);
    return api('cart', 'PATCH', { vendor: cfg.vendor, cartId: id, note: note }).then(function (c) { setCart(c, 'update'); return c; }).catch(function (e) { dropCart(e); throw e; });
  }

  // ---------- Events ----------
  function track(name, items, value) {
    var gtm = { event: name === 'celium:add_to_cart' ? 'add_to_cart' : 'begin_checkout', ecommerce: { currency: 'ZAR', value: value, items: items } };
    try { (window.dataLayer = window.dataLayer || []).push(gtm); } catch (e) {}
    try { if (typeof window.fbq === 'function') window.fbq('track', name === 'celium:add_to_cart' ? 'AddToCart' : 'InitiateCheckout', { value: value, currency: 'ZAR' }); } catch (e) {}
    try { window.dispatchEvent(new CustomEvent(name, { detail: { currency: 'ZAR', value: value, items: items } })); } catch (e) {}
  }
  function lineItem(l, qty) { return { item_id: l.sku || l.variantId, item_name: l.productTitle, item_variant: l.variantTitle, price: l.unitPrice, quantity: qty || l.quantity }; }

  // ---------- Styles ----------
  var CSS = [
    ':host{all:initial;display:block}',
    ':host([data-kind=cart]){display:contents;contain:none}',
    '*,*::before,*::after{box-sizing:border-box}',
    '.cb{--font:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;--accent:#1773b0;--btn-bg:#1773b0;--btn-hover:#1773b0;--hov:brightness(.92);--btn-color:#fff;--btn-r:10px;--btn-fs:14px;--btn-fw:600;--btn-py:11px;--btn-font:var(--font);--btn-flex:1;',
    '--card-bg:#fff;--card-border:#e2e2e2;--card-r:12px;--card-sh:none;--t-color:#15171a;--t-font:var(--font);--t-size:15px;--t-weight:600;--p-color:#15171a;--p-size:14px;--was:#6b7280;--txt:#4b5563;',
    '--o-bg:#fff;--o-color:#15171a;--o-border:#d4d4d8;--o-r:8px;--os-bg:#15171a;--os-color:#fff;--os-border:#15171a;--ta:left;--ai:flex-start;--ml:0;--mr:0;--maxw:440px;--cols:1;--img-w:100%;',
    'font:14px/1.45 var(--font);color:var(--t-color);-webkit-font-smoothing:antialiased;text-align:var(--ta);letter-spacing:normal;text-transform:none;font-style:normal;font-weight:400}',
    'button,select,input,textarea{font:inherit;color:inherit;letter-spacing:inherit;text-transform:none;margin:0}',
    'button{cursor:pointer}',
    'button:focus-visible,select:focus-visible,input:focus-visible,textarea:focus-visible{outline:2px solid var(--accent);outline-offset:2px}',
    '.card{display:flex;flex-direction:column;width:100%;max-width:var(--maxw);margin-left:var(--ml);margin-right:var(--mr);background:var(--card-bg);border:1px solid var(--card-border);border-radius:var(--card-r);box-shadow:var(--card-sh);overflow:hidden;height:fit-content}',
    '.grid .card{max-width:none;margin:0;height:100%}',
    '.grid{display:grid;grid-template-columns:repeat(var(--cols),minmax(0,1fr));gap:16px}',
    '.grid.auto{grid-template-columns:repeat(auto-fill,minmax(min(100%,230px),1fr))}',
    '.cb[data-w=sm] .grid:not(.auto){grid-template-columns:repeat(min(var(--cols),2),minmax(0,1fr))}',
    '.cb[data-w=xs] .grid:not(.auto){grid-template-columns:minmax(0,1fr)}',
    '.media{aspect-ratio:1/1;background:#f4f5f7;display:block;width:var(--img-w);margin-left:var(--ml);margin-right:var(--mr);overflow:hidden;position:relative}',
    '.card>.media{margin:0 auto;align-self:center;flex:none}',
    '.media img{width:100%;height:100%;object-fit:cover;display:block}',
    '.vo{cursor:pointer}',
    '.body{padding:14px;display:flex;flex-direction:column;gap:10px;flex:1;align-items:var(--ai);min-width:0}',
    '.body>*{max-width:100%}',
    '.title{font-family:var(--t-font);font-size:var(--t-size);font-weight:var(--t-weight);color:var(--t-color);line-height:1.3;margin:0;word-break:break-word}',
    '.price{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap;font-weight:600;font-size:var(--p-size);color:var(--p-color)}',
    '.was{color:var(--was);text-decoration:line-through;font-weight:400;font-size:.9em}',
    '.desc{color:var(--txt);font-size:13.5px;line-height:1.55;margin:0}',
    '.desc.clamp{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}',
    '.desc p{margin:0 0 .7em}.desc ul,.desc ol{margin:0 0 .7em;padding-left:1.3em;text-align:left}.desc>:last-child{margin-bottom:0}',
    '.opts{display:flex;flex-direction:column;gap:10px;width:100%;align-items:var(--ai)}',
    '.opt{display:flex;flex-direction:column;gap:5px;font-size:12px;color:var(--txt);align-items:var(--ai);width:100%}',
    '.opt>b{font-weight:500}',
    'select{width:100%;padding:9px 32px 9px 11px;border:1px solid var(--o-border);border-radius:var(--o-r);background:var(--o-bg) url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'8\' fill=\'none\' stroke=\'%236b7280\' stroke-width=\'2\'%3E%3Cpath d=\'M1 1.5l5 5 5-5\'/%3E%3C/svg%3E") no-repeat right 11px center;-webkit-appearance:none;appearance:none;font-size:14px;color:var(--o-color);min-width:0}',
    '.ovals{display:flex;flex-wrap:wrap;gap:8px;justify-content:var(--ai)}',
    '.ob{border:1px solid var(--o-border);background:var(--o-bg);color:var(--o-color);border-radius:var(--o-r);padding:7px 13px;font-size:13px;line-height:1.2;transition:background .12s,color .12s,border-color .12s}',
    '.ob[aria-pressed=true]{background:var(--os-bg);color:var(--os-color);border-color:var(--os-border)}',
    '.sw{width:30px;height:30px;border-radius:50%;border:2px solid #fff;padding:0;box-shadow:0 0 0 1px var(--o-border);position:relative}',
    '.sw::after{content:"";position:absolute;inset:-5px;border-radius:50%;border:2px solid transparent}',
    '.sw[aria-pressed=true]{box-shadow:0 0 0 2px var(--os-border)}',
    '.na{opacity:.45;text-decoration:line-through}.sw.na{text-decoration:none;opacity:.35}',
    '.row{display:flex;gap:8px;align-items:stretch;margin-top:auto;width:100%;justify-content:var(--ai)}',
    '.qty{display:inline-flex;align-items:center;border:1px solid var(--o-border);border-radius:var(--o-r);background:var(--o-bg);color:var(--o-color);flex:none}',
    '.qty button{width:32px;border:0;background:transparent;font-size:16px;line-height:1;padding:0}',
    '.qty button:disabled{opacity:.35;cursor:default}',
    '.qty span{min-width:22px;text-align:center;font-variant-numeric:tabular-nums;font-weight:500}',
    '.qty input{width:48px;border:0;background:transparent;text-align:center;font-weight:500;-moz-appearance:textfield;padding:0;min-width:0}',
    '.qty input::-webkit-inner-spin-button{opacity:1}',
    '.add{flex:var(--btn-flex);min-width:0;border:0;border-radius:var(--btn-r);background:var(--btn-bg);color:var(--btn-color);padding:var(--btn-py) 16px;font-family:var(--btn-font);font-weight:var(--btn-fw);font-size:var(--btn-fs);transition:filter .15s,background .15s,transform .05s}',
    '.add:hover{background:var(--btn-hover);filter:var(--hov)}.add:active{transform:translateY(1px)}',
    '.add:disabled{background:#e5e7eb;color:#6b7280;cursor:not-allowed;filter:none}',
    '.err{color:#b42318;font-size:12.5px;margin:0}',
    '.skel{height:220px;border-radius:12px;background:linear-gradient(90deg,#f3f4f6,#eceef1,#f3f4f6);background-size:200% 100%;animation:sh 1.2s infinite linear}',
    '@keyframes sh{to{background-position:-200% 0}}',
    '.compact{flex-direction:row;align-items:stretch;max-width:none}.compact>.media{width:112px;aspect-ratio:auto;flex:none;min-height:112px;margin:0}',
    '.compact .body{padding:12px}',
    '.btnonly{display:flex;flex-direction:column;gap:8px;max-width:var(--maxw);margin-left:var(--ml);margin-right:var(--mr);align-items:var(--ai)}.btnonly .row{margin-top:0}',
    '.fgrid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:28px;padding:22px;align-items:start}',
    '.full .body{padding:0;gap:14px}.full .title{font-size:calc(var(--t-size) * 1.45)}.full .price{font-size:calc(var(--p-size) * 1.3)}',
    '.gal{display:flex;flex-direction:column;gap:10px;min-width:0}.gal .media{width:100%;margin:0;border-radius:calc(var(--card-r) * .7)}',
    '.thumbs{display:flex;gap:8px;flex-wrap:wrap}',
    '.th2{width:56px;height:56px;border-radius:8px;border:2px solid transparent;padding:0;background:#f4f5f7;overflow:hidden;opacity:.75}',
    '.th2 img{width:100%;height:100%;object-fit:cover;display:block}.th2[aria-pressed=true]{border-color:var(--os-border);opacity:1}',
    '.cb[data-w=xs] .fgrid,.cb[data-w=sm] .fgrid{grid-template-columns:minmax(0,1fr);gap:18px;padding:16px}',
    '.note{padding:12px;border:1px dashed #e5e7eb;border-radius:10px;color:#6b7280;font-size:13px}',
    // modal
    '.mo{position:fixed;inset:0;z-index:2147482999;background:rgba(15,17,20,.5);display:flex;align-items:center;justify-content:center;padding:16px}',
    '.md{position:relative;width:100%;max-width:940px;max-height:calc(100vh - 32px);overflow:auto;border-radius:var(--card-r);background:var(--card-bg);overscroll-behavior:contain;-webkit-overflow-scrolling:touch}',
    '.md .card{max-width:none;border:0;margin:0;box-shadow:none;border-radius:0}',
    '.cb .md .fgrid{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:28px;padding:28px}',
    '@media (max-width:680px){.cb .md .fgrid{grid-template-columns:minmax(0,1fr);gap:18px;padding:18px}}',
    '.mx{position:absolute;top:8px;right:8px;z-index:2;border:0;background:rgba(255,255,255,.9);width:34px;height:34px;border-radius:50%;font-size:22px;line-height:1;padding:0;color:#4b5563;box-shadow:0 1px 4px rgba(0,0,0,.2)}',
    // cart
    '.fab{position:fixed;z-index:2147483000;width:56px;height:56px;border-radius:50%;border:0;background:var(--tg-bg);color:var(--tg-color);box-shadow:0 6px 20px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;padding:0}',
    '.fab.br{right:20px;bottom:76px}.fab.bl{left:20px;bottom:20px}.fab.rm{right:0;top:50%;transform:translateY(-50%);width:50px;height:58px;border-radius:14px 0 0 14px}',
    '.fab[hidden]{display:none}.fab svg{width:24px;height:24px}',
    '.badge{position:absolute;top:-4px;right:-4px;min-width:20px;height:20px;padding:0 5px;border-radius:10px;background:#fff;color:var(--tg-bg);border:2px solid var(--tg-bg);font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center}',
    '.fab.rm .badge{top:-6px;right:auto;left:-6px}',
    '.ov{position:fixed;inset:0;z-index:2147483001;background:rgba(15,17,20,.45);opacity:0;pointer-events:none;transition:opacity .25s}',
    '.ov.open{opacity:1;pointer-events:auto}',
    '.dr{position:fixed;top:0;right:0;bottom:0;width:min(420px,100vw);z-index:2147483002;background:var(--c-bg);color:var(--c-ink);box-shadow:-8px 0 30px rgba(0,0,0,.18);display:flex;flex-direction:column;transform:translateX(105%);transition:transform .28s cubic-bezier(.2,.8,.2,1);visibility:hidden}',
    '.dr.open{transform:none;visibility:visible}',
    '.dh{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid rgba(127,127,127,.25);font-size:16px;font-weight:600}',
    '.x{border:0;background:transparent;width:36px;height:36px;border-radius:8px;font-size:22px;line-height:1;padding:0;color:inherit;opacity:.6}.x:hover{background:rgba(127,127,127,.15);opacity:1}',
    '.lines{flex:1;overflow-y:auto;padding:6px 18px;overscroll-behavior:contain}',
    '.line{display:grid;grid-template-columns:64px 1fr;gap:12px;padding:14px 0;border-bottom:1px solid rgba(127,127,127,.25)}',
    '.line .th{width:64px;height:64px;border-radius:8px;background:#f4f5f7;overflow:hidden}.line .th img{width:100%;height:100%;object-fit:cover;display:block}',
    '.line .t{font-weight:600;font-size:14px;line-height:1.3;word-break:break-word}.line .v{opacity:.65;font-size:12.5px}',
    '.line .ctl{display:flex;align-items:center;justify-content:space-between;margin-top:8px;gap:8px}',
    '.dr .qty{border-color:rgba(127,127,127,.4);background:transparent;color:inherit}',
    '.rm2{border:0;background:transparent;opacity:.65;text-decoration:underline;font-size:12.5px;padding:4px 0}',
    '.empty{padding:48px 0;text-align:center;opacity:.65}',
    '.df{padding:16px 18px;border-top:1px solid rgba(127,127,127,.25);display:flex;flex-direction:column;gap:10px}',
    '.sub{display:flex;justify-content:space-between;font-weight:600;font-size:15px}',
    '.small{opacity:.65;font-size:12px;margin:0}',
    '.dr textarea{width:100%;min-height:62px;resize:vertical;border:1px solid rgba(127,127,127,.4);border-radius:8px;background:transparent;color:inherit;padding:9px 11px;font-size:13.5px}',
    '.dr label{font-size:12.5px;opacity:.75}',
    '.go{border:0;border-radius:var(--btn-r,10px);background:var(--c-accent);color:#fff;padding:13px;font-weight:600;font-size:15px;width:100%}',
    '.go:hover{filter:brightness(.93)}.go:disabled{opacity:.5;cursor:default}',
    '@media (prefers-reduced-motion:reduce){.dr,.ov,.add,.skel{transition:none;animation:none}}',
    '@media (max-width:360px){.row{flex-wrap:wrap}.add{flex-basis:100%}}'
  ].join('');

  function mountHost(host, kind) {
    var root = host.attachShadow({ mode: 'open' });
    var st = document.createElement('style'); st.textContent = CSS; root.appendChild(st);
    if (kind) host.setAttribute('data-kind', kind);
    return root;
  }

  function fontList(s) {
    if (!s) return [];
    return String(s).split(',').map(function (f) { return f.replace(/[^A-Za-z0-9 -]/g, '').trim(); }).filter(Boolean).map(function (f) {
      return /^(serif|sans-serif|monospace|cursive|fantasy|system-ui)$/i.test(f) ? f : '"' + f + '"';
    });
  }
  function fontStack(c) {
    var list = fontList(c.font.google).concat(fontList(c.font.family));
    return list.concat(['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif']).join(',');
  }
  var linked = {};
  function loadGoogleFont(root, name) {
    if (!name || !/^[A-Za-z0-9 ]{1,60}$/.test(name)) return;
    var href = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(name).replace(/%20/g, '+') + ':wght@400;500;600;700&display=swap';
    try { if (!root.querySelector('link[data-celium-font]')) root.appendChild(el('link', { rel: 'stylesheet', href: href, 'data-celium-font': '' })); } catch (e) {}
    // @font-face rules inside a shadow root are ignored by browsers; the document needs the font too.
    try { if (!linked[href]) { linked[href] = 1; document.head.appendChild(el('link', { rel: 'stylesheet', href: href })); } } catch (e) {}
  }

  function boxVars(c) {
    var b = c.button, p = c.product, o = c.options, L = c.layout, al = L.align;
    var imgW = { small: '50%', medium: '100%', large: '100%' }[L.imageSize] || '100%';
    var maxw = L.maxWidth ? px(L.maxWidth, 440) : L.style === 'full' ? '920px' : L.style === 'button' ? '360px' : '440px';
    var v = {
      '--font': fontStack(c), '--accent': esc(c.cart.accent), '--ta': al === 'center' ? 'center' : al === 'right' ? 'right' : 'left',
      '--ai': al === 'center' ? 'center' : al === 'right' ? 'flex-end' : 'flex-start',
      '--ml': al === 'left' ? '0' : 'auto', '--mr': al === 'right' ? '0' : 'auto', '--maxw': maxw, '--cols': L.columns, '--img-w': imgW,
      '--btn-bg': esc(b.bg), '--btn-hover': esc(b.bgHover || b.bg), '--hov': b.bgHover ? 'none' : 'brightness(.92)', '--btn-color': esc(b.color),
      '--btn-r': px(b.radius, 10), '--btn-fs': px(b.fontSize, 14), '--btn-fw': parseInt(b.fontWeight, 10) || 600, '--btn-py': px(b.paddingY, 11),
      '--btn-font': b.fontFamily ? fontList(b.fontFamily).join(',') + ',var(--font)' : 'var(--font)', '--btn-flex': b.fullWidth ? '1' : 'none',
      '--card-bg': esc(p.cardBg), '--card-border': esc(p.cardBorder), '--card-r': px(p.cardRadius, 12),
      '--card-sh': p.cardShadow ? '0 8px 24px rgba(0,0,0,.10)' : 'none',
      '--t-color': esc(p.titleColor), '--t-font': p.titleFont ? fontList(p.titleFont).join(',') + ',var(--font)' : 'var(--font)', '--t-size': px(p.titleSize, 15), '--t-weight': parseInt(p.titleWeight, 10) || 600,
      '--p-color': esc(p.priceColor), '--p-size': px(p.priceSize, 14), '--was': esc(p.compareAtColor), '--txt': esc(p.textColor),
      '--o-bg': esc(o.bg), '--o-color': esc(o.color), '--o-border': esc(o.borderColor), '--o-r': px(o.radius, 8),
      '--os-bg': esc(o.selectedBg), '--os-color': esc(o.selectedColor), '--os-border': esc(o.selectedBorderColor)
    };
    var s = []; for (var k in v) s.push(k + ':' + v[k]);
    return s.join(';');
  }

  // ---------- Colours for swatches ----------
  var COLORS = { black: '#111', white: '#fff', ivory: '#fffff0', cream: '#f5efe0', beige: '#e3d5bc', sand: '#d8c3a0', natural: '#e6d9c0', tan: '#c9a77a', nude: '#e0bfa6',
    brown: '#6b4a32', chocolate: '#4a2f1f', caramel: '#b9783a', grey: '#9ca3af', gray: '#9ca3af', charcoal: '#374151', silver: '#c0c0c0', gold: '#d4af37', bronze: '#a9743a', copper: '#b87333',
    red: '#d32f2f', burgundy: '#6d1a2b', maroon: '#7b1d1d', wine: '#722f37', rose: '#e8a0b0', pink: '#f4a6c0', blush: '#f2c6c2', coral: '#f2776a', terracotta: '#c8694a', rust: '#b5502d',
    orange: '#f57c00', peach: '#ffcba4', yellow: '#f6d33c', mustard: '#d6a21e', lemon: '#fff176', green: '#3f9b57', sage: '#9caf88', olive: '#6b7a3a', mint: '#a8e0c4', forest: '#2d5a3d', emerald: '#1f9d6b',
    teal: '#1c8a8a', turquoise: '#40c4c4', aqua: '#6fd6d6', blue: '#2e6fd1', navy: '#1b2a4a', sky: '#8ec5f0', denim: '#3b5b8c', purple: '#7a4cc2', violet: '#8b5cf6', lavender: '#c3b1e8', lilac: '#cdb4e0', plum: '#6b3a6b', multi: 'linear-gradient(135deg,#f44 0 25%,#fc3 0 50%,#4b6 0 75%,#48f 0)' };
  var NOT_COLOR = /^(transparent|inherit|initial|unset|revert|currentcolor|auto|none)$/i;
  function colorOf(value) {
    var v = String(value || '').trim().toLowerCase();
    if (!v) return null;
    if (/^#[0-9a-f]{3,8}$/.test(v)) return v;
    if (COLORS[v]) return COLORS[v];
    var words = v.split(/[\s/&,-]+/).filter(Boolean), i;
    for (i = words.length - 1; i >= 0; i--) if (COLORS[words[i]]) return COLORS[words[i]];
    try {
      if (/^[a-z]+$/.test(v) && !NOT_COLOR.test(v) && window.CSS && CSS.supports('color', v)) return v;
      for (i = words.length - 1; i >= 0; i--) if (/^[a-z]+$/.test(words[i]) && !NOT_COLOR.test(words[i]) && CSS.supports('color', words[i])) return words[i];
    } catch (e) {}
    return null;
  }

  // ---------- Safe description HTML ----------
  var OK_TAGS = { P: 1, BR: 1, UL: 1, OL: 1, LI: 1, STRONG: 1, B: 1, EM: 1, I: 1, H1: 'strong', H2: 'strong', H3: 'strong', H4: 'strong', H5: 'strong', H6: 'strong' };
  function safeHtml(html) {
    var frag = document.createDocumentFragment();
    try {
      var doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
      (function walk(src, dst) {
        for (var n = src.firstChild; n; n = n.nextSibling) {
          if (n.nodeType === 3) dst.appendChild(document.createTextNode(n.nodeValue));
          else if (n.nodeType === 1) {
            if (/^(SCRIPT|STYLE|IFRAME|OBJECT|EMBED|NOSCRIPT|TEMPLATE)$/.test(n.tagName)) continue;
            var t = OK_TAGS[n.tagName];
            if (t) { var o = document.createElement(typeof t === 'string' ? t : n.tagName.toLowerCase()); walk(n, o); dst.appendChild(o); }
            else walk(n, dst);
          }
        }
      })(doc.body, frag);
    } catch (e) {}
    return frag;
  }
  function plain(html) { try { return (new DOMParser().parseFromString(String(html || ''), 'text/html').body.textContent || '').replace(/\s+/g, ' ').trim(); } catch (e) { return ''; } }

  // ---------- Variants + options ----------
  function variantFor(p, sel) {
    var vs = p.variants || [];
    for (var i = 0; i < vs.length; i++) {
      var ok = true, so = vs[i].selectedOptions || [];
      for (var j = 0; j < so.length; j++) if (sel[so[j].name] !== so[j].value) { ok = false; break; }
      if (ok) return vs[i];
    }
    return null;
  }
  function valueAvailable(p, sel, name, val) {
    return (p.variants || []).some(function (v) {
      if (!v.availableForSale) return false;
      return (v.selectedOptions || []).every(function (s) { return s.name === name ? s.value === val : sel[s.name] === undefined || sel[s.name] === s.value; });
    });
  }
  function chooseOption(p, sel, name, val) {
    sel[name] = val;
    if (variantFor(p, sel)) return;
    var best = null, bestScore = -1;
    (p.variants || []).forEach(function (v) {
      var so = v.selectedOptions || [], has = so.some(function (s) { return s.name === name && s.value === val; });
      if (!has) return;
      var score = so.filter(function (s) { return sel[s.name] === s.value; }).length + (v.availableForSale ? 0.5 : 0);
      if (score > bestScore) { best = v; bestScore = score; }
    });
    if (best) (best.selectedOptions || []).forEach(function (s) { sel[s.name] = s.value; });
  }

  function buildOptions(p, c, sel, onChange) {
    var box = el('div', { class: 'opts' }), syncs = [];
    (p.options || []).forEach(function (opt) {
      if (!opt.values || opt.values.length < 2) return;
      var style = c.options.style, node, sync;
      var asSwatch = style === 'swatches' && opt.values.every(function (v) { return !!colorOf(v); });
      if (style === 'dropdown') {
        node = el('select', { 'aria-label': opt.name });
        opt.values.forEach(function (v) { node.appendChild(el('option', { value: v, text: v })); });
        node.addEventListener('change', function () { chooseOption(p, sel, opt.name, node.value); onChange(); });
        sync = function () { node.value = sel[opt.name] || opt.values[0]; };
      } else {
        node = el('div', { class: 'ovals', role: 'group', 'aria-label': opt.name });
        var btns = opt.values.map(function (v) {
          var b;
          if (asSwatch) { b = el('button', { type: 'button', class: 'sw', title: v, 'aria-label': v }); b.style.background = colorOf(v); }
          else b = el('button', { type: 'button', class: 'ob', text: v });
          b.addEventListener('click', function () { chooseOption(p, sel, opt.name, v); onChange(); });
          node.appendChild(b); return b;
        });
        sync = function () {
          btns.forEach(function (b, i) {
            var v = opt.values[i];
            b.setAttribute('aria-pressed', sel[opt.name] === v ? 'true' : 'false');
            b.classList.toggle('na', !valueAvailable(p, sel, opt.name, v));
          });
        };
      }
      syncs.push(sync);
      var label = style === 'dropdown' ? el('label', { class: 'opt' }, [el('b', { text: opt.name }), node]) : el('div', { class: 'opt' }, [el('b', { text: opt.name + (asSwatch ? ': ' : '') }), node]);
      var lead = label.firstChild;
      if (asSwatch) syncs.push(function () { lead.textContent = opt.name + ': ' + (sel[opt.name] || ''); });
      box.appendChild(label);
    });
    return { node: syncs.length ? box : null, sync: function () { syncs.forEach(function (f) { f(); }); } };
  }

  // ---------- Product card ----------
  function productCard(p, c, mode, ctx) {
    var modal = mode === 'modal';
    var L = c.layout, style = modal ? 'full' : L.style;
    var viewOnly = !modal && c.action === 'modal';
    var sel = {}, qty = 1, picked = null;
    var imgs = p.images || [];
    var first = (p.variants || []).filter(function (v) { return v.availableForSale; })[0] || (p.variants || [])[0];
    if (first) (first.selectedOptions || []).forEach(function (s) { sel[s.name] = s.value; });
    var noImg = (L.imageSize === 'none' && !modal) || (!imgs.length && !(p.variants || []).some(function (v) { return v.image; }));

    var wrap = el('div', { class: style === 'button' ? 'btnonly' : 'card ' + style + (c._compact ? ' compact' : ''), 'data-al': L.align });
    var img = el('img', { loading: 'lazy', alt: '' });
    var media = el('div', { class: 'media' + (viewOnly ? ' vo' : '') }, [img]);
    var thumbs = el('div', { class: 'thumbs' });
    var thumbBtns = [];
    if (style === 'full' && imgs.length > 1) imgs.forEach(function (im, i) {
      var tb = el('button', { type: 'button', class: 'th2', 'aria-label': 'Show image ' + (i + 1) }, [el('img', { src: im.url, alt: '', loading: 'lazy' })]);
      tb.addEventListener('click', function () { picked = i; update(); });
      thumbBtns.push(tb); thumbs.appendChild(tb);
    });
    var title = el('h3', { class: 'title' + (viewOnly ? ' vo' : ''), text: p.title });
    var priceBox = el('div', { class: 'price' });
    var desc = null;
    if (L.showDescription && (style === 'classic' || style === 'full') && p.descriptionHtml) {
      if (style === 'classic') desc = el('p', { class: 'desc clamp', text: plain(p.descriptionHtml) });
      else { desc = el('div', { class: 'desc' }); desc.appendChild(safeHtml(p.descriptionHtml)); }
      if (style === 'classic' && !desc.textContent) desc = null;
    }
    var opts = viewOnly ? { node: null, sync: function () {} } : buildOptions(p, c, sel, function () { picked = null; qty = 1; update(); });

    var qtyStyle = viewOnly ? 'hidden' : c.quantity.style;
    var qtyNode = null, qtyShow = null, minus = null, plus = null, qtyIn = null;
    if (qtyStyle === 'stepper') {
      var num = el('span', { 'aria-live': 'polite' });
      minus = el('button', { type: 'button', 'aria-label': 'Decrease quantity', text: '−' });
      plus = el('button', { type: 'button', 'aria-label': 'Increase quantity', text: '+' });
      minus.addEventListener('click', function () { qty = Math.max(1, qty - 1); update(); });
      plus.addEventListener('click', function () { qty++; update(); });
      qtyShow = function () { num.textContent = qty; };
      qtyNode = el('div', { class: 'qty' }, [minus, num, plus]);
    } else if (qtyStyle === 'input') {
      qtyIn = el('input', { type: 'number', min: '1', max: '99', inputmode: 'numeric', 'aria-label': 'Quantity', value: '1' });
      qtyIn.addEventListener('input', function () { var n = parseInt(qtyIn.value, 10); if (n > 0) qty = Math.min(99, n); });
      qtyIn.addEventListener('change', function () { update(); });
      qtyShow = function () { if (!qtyIn.matches(':focus')) qtyIn.value = qty; };
      qtyNode = el('div', { class: 'qty' }, [qtyIn]);
    }
    var add = el('button', { type: 'button', class: 'add' });
    var err = el('p', { class: 'err', role: 'alert' }); err.hidden = true;
    var row = el('div', { class: 'row' }, [qtyNode, add]);

    function curVariant() { return variantFor(p, sel); }
    function update() {
      var v = curVariant();
      opts.sync();
      var im = picked !== null && imgs[picked] ? imgs[picked] : (v && v.image) || imgs[0];
      if (im) { if (img.getAttribute('src') !== im.url) img.src = im.url; img.alt = im.altText || p.title; media.style.display = ''; } else media.style.display = 'none';
      if (!imgs.length && !(v && v.image)) media.style.display = 'none';
      var curUrl = im && im.url;
      thumbBtns.forEach(function (tb, i) { tb.setAttribute('aria-pressed', imgs[i] && imgs[i].url === curUrl ? 'true' : 'false'); });
      priceBox.textContent = '';
      if (viewOnly) {
        var pr = p.priceRange || {};
        priceBox.appendChild(el('span', { text: (pr.min !== pr.max ? 'From ' : '') + money(pr.min) }));
      } else if (v) {
        priceBox.appendChild(el('span', { text: money(v.price) }));
        if (L.showCompareAt && v.compareAtPrice && v.compareAtPrice > v.price) priceBox.appendChild(el('span', { class: 'was', text: money(v.compareAtPrice) }));
      }
      var avail = viewOnly ? p.availableForSale !== false : !!(v && v.availableForSale);
      var max = v ? Math.max(1, Math.min(99, v.quantityAvailable || 99)) : 1;
      if (qty > max) qty = max;
      if (qtyShow) qtyShow();
      if (minus) { minus.disabled = qty <= 1; plus.disabled = qty >= max || !avail; }
      if (qtyIn) qtyIn.max = String(max);
      add.disabled = viewOnly ? false : !avail;
      add.textContent = viewOnly ? (avail ? buttonText(c) : buttonText(c)) : !v ? 'Unavailable' : avail ? buttonText(c, modal) : c.button.soldOutText;
    }
    function open() { if (ctx && ctx.openModal) ctx.openModal(p); }
    if (viewOnly) { media.addEventListener('click', open); title.addEventListener('click', open); }
    add.addEventListener('click', function () {
      if (viewOnly) { open(); return; }
      var v = curVariant(); if (!v) return;
      var n = qtyIn ? Math.max(1, Math.min(99, parseInt(qtyIn.value, 10) || qty)) : qty; qty = n;
      err.hidden = true; add.disabled = true; var t = add.textContent; add.textContent = c.action === 'buy_now' ? 'Redirecting…' : 'Adding…';
      var run = c.action === 'buy_now' ? buyNow(v.id, n, p, v, ctx && ctx.preview) : (modal && ctx && ctx.closeModal ? (ctx.closeModal(), doAdd(v.id, n, p, v)) : doAdd(v.id, n, p, v));
      run.then(function () { update(); }).catch(function (e) {
        err.textContent = (e && e.status === 409) ? (e.message || 'Not enough stock available.') : 'Couldn’t add to cart — please try again';
        err.hidden = false; warn('add to cart failed', e && e.message); add.textContent = t; update();
      });
    });

    var parts = [style === 'button' || !L.showTitle ? null : title, L.showPrice ? priceBox : null, desc, opts.node, row, err];
    if (style === 'button') {
      parts.forEach(function (n) { if (n) wrap.appendChild(n); });
    } else if (style === 'full') {
      var body = el('div', { class: 'body' }, parts);
      var kids = [];
      if (!noImg) kids.push(el('div', { class: 'gal' }, [media, thumbBtns.length ? thumbs : null]));
      kids.push(body);
      wrap.appendChild(el('div', { class: 'fgrid', style: noImg ? 'grid-template-columns:minmax(0,1fr)' : null }, kids));
    } else {
      if (!noImg) wrap.appendChild(media);
      wrap.appendChild(el('div', { class: 'body' }, parts));
    }
    update();
    return wrap;
  }

  function doAdd(variantId, qty, p, v) {
    return addToCart(variantId, qty).then(function (c) {
      var l = null;
      for (var i = 0; i < c.lines.length; i++) if (c.lines[i].variantId === variantId) l = c.lines[i];
      var item = l ? lineItem(l, qty) : { item_id: (v && v.sku) || variantId, item_name: p ? p.title : '', price: v ? v.price : 0, quantity: qty };
      track('celium:add_to_cart', [item], Math.round(item.price * qty * 100) / 100);
      openDrawer();
      return c;
    });
  }
  function buyNow(variantId, qty, p, v, preview) {
    // A one-off cart: the shopper's regular cart is left untouched.
    var win = preview ? window.open('about:blank', '_blank') : null;
    return api('cart', 'POST', { vendor: cfg.vendor, lines: [{ variantId: variantId, quantity: qty }], attributes: attribution() }).then(function (c) {
      var item = { item_id: (v && v.sku) || variantId, item_name: p ? p.title : '', price: v ? v.price : 0, quantity: qty };
      track('celium:checkout', [item], c.total != null ? c.total : c.subtotal);
      if (win) win.location.href = c.checkoutUrl; else window.location.href = c.checkoutUrl;
      return c;
    }).catch(function (e) { if (win) win.close(); throw e; });
  }

  // ---------- Instance: renders one embed into a host ----------
  function createInstance(host, config, opts) {
    opts = opts || {};
    var root = host._celiumRoot;
    if (!root) { root = mountHost(host); host._celiumRoot = root; }
    var box = el('div', { class: 'cb' }); root.appendChild(box);
    var c = null, products = null, failed = false, ro = null, modalEl = null, onKey = null;

    function observe() {
      var set = function (w) { box.setAttribute('data-w', w < 380 ? 'xs' : w < 620 ? 'sm' : 'lg'); };
      try {
        ro = new ResizeObserver(function (es) { set(es[0].contentRect.width); });
        ro.observe(box);
      } catch (e) { set(box.clientWidth || window.innerWidth); }
    }
    function closeModal() {
      if (modalEl && modalEl.parentNode) modalEl.parentNode.removeChild(modalEl);
      modalEl = null;
      if (onKey) { document.removeEventListener('keydown', onKey, true); onKey = null; }
    }
    var ctx = { preview: !!opts.preview, closeModal: closeModal, openModal: function (p) {
      closeModal();
      var dlg = el('div', { class: 'md', role: 'dialog', 'aria-modal': 'true', 'aria-label': p.title, tabindex: '-1' });
      var x = el('button', { type: 'button', class: 'mx', 'aria-label': 'Close', text: '×' });
      dlg.appendChild(x); dlg.appendChild(productCard(p, c, 'modal', ctx));
      modalEl = el('div', { class: 'mo' }, [dlg]);
      modalEl.addEventListener('mousedown', function (e) { if (e.target === modalEl) closeModal(); });
      x.addEventListener('click', closeModal);
      onKey = function (e) { if (e.key === 'Escape') { e.stopPropagation(); closeModal(); } };
      document.addEventListener('keydown', onKey, true);
      box.appendChild(modalEl);
      try { dlg.focus(); } catch (e) {}
    } };

    function render() {
      closeModal();
      box.textContent = '';
      if (!c) { box.appendChild(el('div', { class: 'skel' })); return; }
      box.setAttribute('style', boxVars(c));
      loadGoogleFont(root, c.font.google);
      if (failed) { box.appendChild(el('div', { class: 'note', text: 'This product is unavailable right now.' })); return; }
      if (!products) { box.appendChild(el('div', { class: 'skel' })); return; }
      var t = c.target, list = [];
      if (t.type === 'shop') list = products;
      else (t.type === 'product' ? t.handles.slice(0, 1) : t.handles).forEach(function (h) {
        for (var i = 0; i < products.length; i++) if (products[i].handle === h) { list.push(products[i]); break; }
      });
      if (!list.length) { box.appendChild(el('div', { class: 'note', text: t.type === 'shop' ? 'No products to show yet.' : t.type === 'product' && !t.handles.length ? 'Choose a product to show.' : 'Product not found.' })); return; }
      if (t.type === 'product') box.appendChild(productCard(list[0], c, 'card', ctx));
      else {
        var g = el('div', { class: 'grid' + (c._auto ? ' auto' : '') });
        list.forEach(function (p) { g.appendChild(productCard(p, c, 'card', ctx)); });
        box.appendChild(g);
      }
      ensureCartUi();
    }

    function setConfig(cfgIn) {
      c = fill(cfgIn);
      applyCart(c, !!opts.preview);
      render();
    }
    function ready() {
      if (products || !cfg.vendor || !cfg.key) return;
      loadProducts().then(function (d) { products = d.products || []; render(); }).catch(function (e) { failed = true; render(); warn('could not load products', e && e.message); });
    }
    observe();
    var inst = {
      update: function (n) { try { setConfig(n); ready(); } catch (e) { warn('update failed', e && e.message); } },
      destroy: function () { try { closeModal(); if (ro) ro.disconnect(); if (box.parentNode) box.parentNode.removeChild(box); } catch (e) {} },
      host: host
    };
    if (config) inst.update(config); else render();
    return inst;
  }

  // ---------- Legacy attribute placeholders ----------
  function legacyConfig(d, shop, handle) {
    var layout = d.layout === 'compact' || d.layout === 'button' ? d.layout : 'card';
    var bg = d.buttonBg || cfg.accent || null;
    var c = {
      target: shop ? { type: 'shop', handles: [] } : { type: 'product', handles: [handle] },
      layout: { style: layout === 'button' ? 'button' : 'basic', columns: 3, imageSize: bool(d.showImage, true) ? 'large' : 'none', showTitle: bool(d.showTitle, true), showPrice: bool(d.showPrice, true), showDescription: false },
      button: { text: d.buttonText || null },
      quantity: { style: bool(d.showQuantity, true) ? 'stepper' : 'hidden' },
      cart: { toggle: { show: cfg.cartButton === 'always' ? 'always' : 'auto' } },
      _compact: layout === 'compact' && !shop, _auto: shop
    };
    if (layout === 'compact') c.layout.style = 'basic';
    if (bg) { c.button.bg = bg; }
    if (cfg.accent) { c.cart.accent = cfg.accent; c.cart.toggle.bg = cfg.accent; }
    if (d.buttonColor) c.button.color = d.buttonColor;
    if (d.radius !== undefined && d.radius !== '') c.button.radius = parseInt(d.radius, 10) || 0;
    return c;
  }
  function setupHost(host, build) {
    if (host.getAttribute('data-celium-ready')) return;
    host.setAttribute('data-celium-ready', '1');
    if (host.dataset.vendor && !cfg.vendor) cfg.vendor = host.dataset.vendor;
    if (host.dataset.key && !cfg.key) cfg.key = host.dataset.key;
    var inst = createInstance(host, null);
    if (!cfg.vendor || !cfg.key) { warn('missing data-vendor / data-key'); host.shadowRoot.querySelector('.cb').textContent = 'Celium: missing data-vendor or data-key.'; return; }
    inst.update(build());
  }
  function renderLegacy(host) {
    setupHost(host, function () {
      return host.hasAttribute('data-celium-shop') ? legacyConfig(host.dataset, true) : legacyConfig(host.dataset, false, host.getAttribute('data-celium-product'));
    });
  }
  function renderSaved(host) {
    if (host.getAttribute('data-celium-ready')) return;
    host.setAttribute('data-celium-ready', '1');
    var id = (host.getAttribute('data-celium-embed') || '').trim();
    if (!/^emb_[A-Za-z0-9]{10}$/.test(id)) { warn('invalid embed id', id); return; }
    var inst = createInstance(host, null);
    loadEmbed(id).then(function (d) {
      if (!cfg.vendor || !cfg.key) { cfg.vendor = d.vendor.slug; cfg.key = d.vendor.key; }
      inst.update(d.config);
    }).catch(function (e) { inst.destroy(); host.style.display = 'none'; warn('embed unavailable', id, e && e.message); });
  }

  // ---------- Cart UI (toggle + drawer), one per page ----------
  var ui = null, cartCfg = null;
  var ICONS = {
    cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6h15l-1.5 9h-12z"/><path d="M6 6L5 3H2"/><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/></svg>',
    bag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>'
  };
  function applyCart(c, force) {
    if (cartCfg && !force) return;
    cartCfg = c.cart;
    if (ui) ui.apply();
  }
  function ensureCartUi() {
    if (ui) return ui;
    if (!cfg.vendor) return null;
    var host = document.createElement('div'); host.setAttribute('data-celium-cart', '');
    var root;
    try { root = mountHost(host, 'cart'); } catch (e) { return null; }
    var box = el('div', { class: 'cb' }); root.appendChild(box);
    var badge = el('span', { class: 'badge', text: '0' });
    var icon = el('span', { style: 'display:flex' });
    var fab = el('button', { type: 'button', class: 'fab br', 'aria-label': 'Open cart' }, [icon, badge]);
    var ov = el('div', { class: 'ov' });
    var linesBox = el('div', { class: 'lines' });
    var subVal = el('span', { text: money(0) });
    var cerr = el('p', { class: 'err', role: 'alert' }); cerr.hidden = true;
    var go = el('button', { type: 'button', class: 'go', text: 'Checkout' });
    var closeBtn = el('button', { type: 'button', class: 'x', 'aria-label': 'Close cart', text: '×' });
    var titleEl = el('span', { text: 'Your cart' });
    var noteEl = el('textarea', { id: 'cn', maxlength: '500', placeholder: 'Anything we should know about your order?' });
    var noteWrap = el('div', { style: 'display:flex;flex-direction:column;gap:5px' }, [el('label', { for: 'cn', text: 'Order note' }), noteEl]);
    noteWrap.hidden = true;
    var dr = el('div', { class: 'dr', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Shopping cart', tabindex: '-1' }, [
      el('div', { class: 'dh' }, [titleEl, closeBtn]),
      linesBox,
      el('div', { class: 'df' }, [noteWrap, el('div', { class: 'sub' }, [el('span', { text: 'Subtotal' }), subVal]), el('p', { class: 'small', text: 'Shipping and discounts are calculated at checkout.' }), cerr, go])
    ]);
    box.appendChild(fab); box.appendChild(ov); box.appendChild(dr);
    (document.body || document.documentElement).appendChild(host);
    var lastFocus = null, isOpen = false, cc = null;

    function apply() {
      cc = cartCfg || DEF.cart;
      var tg = cc.toggle, accent = esc(cc.accent || cc.toggle.bg || '#1773b0');
      box.setAttribute('style', '--c-bg:' + esc(cc.bg) + ';--c-ink:' + esc(cc.color) + ';--c-accent:' + accent + ';--tg-bg:' + esc(tg.bg || accent) + ';--tg-color:' + esc(tg.color) + ';--accent:' + accent + ';--font:' + fontStack({ font: { google: null, family: null } }));
      fab.className = 'fab ' + ({ 'bottom-left': 'bl', 'right-middle': 'rm' }[tg.position] || 'br');
      icon.innerHTML = ICONS[tg.icon] || ICONS.bag;
      titleEl.textContent = cc.title; go.textContent = cc.checkoutText; noteWrap.hidden = !(cc.noteEnabled && cart && cart.totalQuantity);
      render(cart);
    }
    function render(c) {
      var cc2 = cc || DEF.cart, n = c ? c.totalQuantity : 0;
      badge.textContent = n > 99 ? '99+' : String(n);
      fab.hidden = !(n > 0 || cc2.toggle.show === 'always' || cfg.cartButton === 'always' || isOpen);
      fab.setAttribute('aria-label', 'Open cart, ' + n + ' item' + (n === 1 ? '' : 's'));
      subVal.textContent = money(c ? c.subtotal : 0);
      go.disabled = !n;
      noteWrap.hidden = !(cc2.noteEnabled && n);
      if (root.activeElement !== noteEl) noteEl.value = (c && c.note) || '';
      linesBox.textContent = '';
      if (!n) { linesBox.appendChild(el('div', { class: 'empty', text: cc2.emptyText })); return; }
      c.lines.forEach(function (l) {
        var th = el('div', { class: 'th' }); if (l.image) th.appendChild(el('img', { src: l.image.url, alt: l.image.altText || l.productTitle }));
        var max = Math.max(1, Math.min(99, l.quantityAvailable || 99));
        var m = el('button', { type: 'button', 'aria-label': 'Decrease quantity of ' + l.productTitle, text: '−' });
        var pl = el('button', { type: 'button', 'aria-label': 'Increase quantity of ' + l.productTitle, text: '+' });
        pl.disabled = l.quantity >= max;
        var rm = el('button', { type: 'button', class: 'rm2', 'aria-label': 'Remove ' + l.productTitle, text: 'Remove' });
        function change(q) { cerr.hidden = true; return patchLine(l, q).catch(function (e) { cerr.textContent = 'Couldn’t update your cart — please try again'; cerr.hidden = false; warn('cart update failed', e && e.message); }); }
        m.addEventListener('click', function () { change(l.quantity - 1); });
        pl.addEventListener('click', function () { change(l.quantity + 1); });
        rm.addEventListener('click', function () { change(0); });
        var vt = l.variantTitle && !/^default( title)?$/i.test(l.variantTitle) ? l.variantTitle : '';
        linesBox.appendChild(el('div', { class: 'line' }, [th, el('div', null, [
          el('div', { class: 't', text: l.productTitle }), vt ? el('div', { class: 'v', text: vt }) : null,
          el('div', { class: 'ctl' }, [el('div', { class: 'qty' }, [m, el('span', { text: String(l.quantity) }), pl]), el('strong', { text: money(l.lineTotal) })]),
          el('div', null, [rm])
        ])]));
      });
    }
    function saveNote() {
      var v = noteEl.value.trim().slice(0, 500);
      if (v === ((cart && cart.note) || '')) return Promise.resolve();
      return patchNote(v).catch(function (e) { warn('note save failed', e && e.message); });
    }
    noteEl.addEventListener('blur', saveNote);
    function focusables() { return [].slice.call(dr.querySelectorAll('button:not([disabled]),[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')); }
    function open() {
      if (isOpen) return; isOpen = true; lastFocus = document.activeElement;
      fab.hidden = false; ov.classList.add('open'); dr.classList.add('open');
      setTimeout(function () { try { closeBtn.focus(); } catch (e) {} }, 30);
      refreshCart();
    }
    function close() {
      if (!isOpen) return; saveNote(); isOpen = false; ov.classList.remove('open'); dr.classList.remove('open');
      render(cart);
      try { if (lastFocus && lastFocus.focus) lastFocus.focus(); } catch (e) {}
    }
    fab.addEventListener('click', open); closeBtn.addEventListener('click', close); ov.addEventListener('click', close);
    dr.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.stopPropagation(); close(); return; }
      if (e.key !== 'Tab') return;
      var f = focusables(); if (!f.length) return;
      var a = root.activeElement, i = f.indexOf(a);
      if (e.shiftKey && (i <= 0)) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && (i === f.length - 1 || i === -1)) { e.preventDefault(); f[0].focus(); }
    });
    document.addEventListener('keydown', function (e) { if (isOpen && e.key === 'Escape') close(); });
    go.addEventListener('click', function () {
      if (!cart || !cart.checkoutUrl) return;
      go.disabled = true; var label = go.textContent; go.textContent = 'Redirecting…';
      saveNote().then(function () {
        var items = cart.lines.map(function (l) { return lineItem(l); });
        track('celium:checkout', items, cart.total != null ? cart.total : cart.subtotal);
        window.location.href = cart.checkoutUrl;
      }).catch(function () { go.disabled = false; go.textContent = label; });
    });
    onCart(function (c) { render(c); });
    ui = { open: open, close: close, apply: apply };
    apply();
    refreshCart();
    return ui;
  }
  function openDrawer() { var u = ensureCartUi(); if (u) u.open(); }

  // ---------- Boot ----------
  function scan() {
    var nodes = document.querySelectorAll('[data-celium-embed],[data-celium-product],[data-celium-shop]');
    for (var i = 0; i < nodes.length; i++) {
      try {
        if (nodes[i].hasAttribute('data-celium-embed')) renderSaved(nodes[i]); else renderLegacy(nodes[i]);
      } catch (e) { warn('render failed', e && e.message); }
    }
    if (!cfg.vendor) { var d = document.querySelector('[data-vendor]'); if (d) { cfg.vendor = d.dataset.vendor; cfg.key = cfg.key || d.dataset.key || ''; } }
    if (cfg.vendor && cfg.key && cfg.cartButton === 'always') ensureCartUi();
  }

  window.CeliumBuy = {
    version: '2.0.0',
    open: function () { try { openDrawer(); } catch (e) { warn(e && e.message); } },
    refresh: function () { try { productsPromise = null; scan(); refreshCart(); } catch (e) { warn(e && e.message); } },
    addToCart: function (variantId, qty) { return addToCart(variantId, qty).then(function (c) { openDrawer(); return c; }).catch(function (e) { warn('add to cart failed', e && e.message); throw e; }); },
    mount: function (element, o) {
      try {
        o = o || {};
        if (o.apiBase) base = String(o.apiBase).replace(/\/+$/, '');
        if (o.vendor) cfg.vendor = o.vendor;
        if (o.key) cfg.key = o.key;
        var inst = createInstance(element, null, { preview: true });
        inst.update(o.config || {});
        return { update: inst.update, destroy: inst.destroy };
      } catch (e) { warn('mount failed', e && e.message); return { update: function () {}, destroy: function () {} }; }
    }
  };

  captureAttribution();
  function start() { try { scan(); if (cfg.vendor && cfg.key && lsGet(CART_KEY())) ensureCartUi(); } catch (e) { warn(e && e.message); } }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
