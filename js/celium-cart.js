/* Compact Celium checkout and cart-derived rehabilitation impact. */
(function () {
  'use strict';
  var API = 'https://checkout.celium.eco/api/public/storefront/';
  var EMBED = 'emb_XYo9N5lBLx';
  var treesByHandle = {
    '5l-extra-virgin-organic-olive-oil': 5,
    '1l-extra-virgin-organic-olive-oil': 1,
    '750ml-extra-virgin-organic-olive-oil': 1
  };
  var treesByVariant = Object.create(null);
  var previous = 0;

  /** Use catalogue IDs, not prices or display names, to map each physical unit. */
  function registerProducts(products) {
    Object.keys(treesByVariant).forEach(function (id) { delete treesByVariant[id]; });
    products.forEach(function (product) {
      if (!treesByHandle[product.handle]) return;
      (product.variants || []).forEach(function (variant) {
        treesByVariant[variant.id] = treesByHandle[product.handle];
      });
    });
  }

  /** Recalculate the complete cart on every confirmed update, including removals. */
  function syncImpact(event) {
    var detail = event.detail || {};
    var count = ((detail.cart && detail.cart.lines) || []).reduce(function (total, line) {
      var qty = Number(line.quantity);
      return total + (Number.isInteger(qty) && qty > 0 ? (treesByVariant[line.variantId] || 0) * qty : 0);
    }, 0);
    document.getElementById('tree-impact-count').textContent = count;
    document.getElementById('tree-impact-label').textContent = count === 1 ? 'olive tree' : 'olive trees';
    document.getElementById('tree-impact-bar').classList.toggle('visible', count > 0);
    // The drawer covers the page bar on phones; repeat the same total by checkout.
    var cartHost = document.querySelector('[data-celium-cart]');
    var root = cartHost && cartHost.shadowRoot;
    var footer = root && root.querySelector('.df');
    if (footer) {
      var impact = root.querySelector('.samsara-cart-impact');
      if (!impact) {
        impact = document.createElement('p');
        impact.className = 'samsara-cart-impact';
        impact.setAttribute('aria-live', 'polite');
        impact.style.cssText = 'margin:0;text-align:center;font-size:13px;line-height:1.5;color:#42613a';
        footer.insertBefore(impact, root.querySelector('.go'));
      }
      impact.hidden = count === 0;
      impact.textContent = '🌿 Your order will help rehabilitate ' + count + (count === 1 ? ' olive tree' : ' olive trees');
    }
    // Restoring a saved cart is not a new contribution: never replay its toast.
    if (detail.reason !== 'restore' && count > previous && window.__samsaraAddTrees) {
      window.__samsaraAddTrees(count - previous);
    }
    previous = count;
  }

  /** Bound public configuration/catalogue loading; no admin credentials are used. */
  async function getJson(url, headers) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 15000);
    try {
      var response = await fetch(url, { headers: headers || {}, signal: controller.signal });
      if (!response.ok) throw new Error('Checkout service unavailable');
      return await response.json();
    } finally { clearTimeout(timer); }
  }

  /** Resolve the supplied saved embed's public vendor identity, then load one cart. */
  async function start() {
    var hosts = document.querySelectorAll('[data-celium-product]');
    try {
      var embed = await getJson(API + 'embed?id=' + EMBED);
      if (!embed.vendor || embed.vendor.slug !== 'samsara' || !embed.vendor.key) throw new Error('Unexpected store');
      var catalog = await getJson(API + 'products?vendor=samsara', { 'x-celium-storefront-key': embed.vendor.key });
      registerProducts(catalog.products || []);
      Object.keys(treesByHandle).forEach(function (handle) {
        if (!(catalog.products || []).some(function (p) { return p.handle === handle && p.variants && p.variants.length; })) {
          throw new Error('Missing checkout product');
        }
      });
      // This is Celium's own short-lived public catalogue cache, not a cart copy.
      try { sessionStorage.setItem('celium_products_samsara', JSON.stringify({ t: Date.now(), d: catalog })); } catch (e) {}
      var script = document.createElement('script');
      script.src = 'js/vendor/celium-buy.js';
      script.async = true;
      script.dataset.vendor = embed.vendor.slug;
      script.dataset.key = embed.vendor.key;
      script.dataset.accent = '#1a1208';
      await new Promise(function (resolve, reject) {
        script.onload = resolve;
        script.onerror = function () { reject(new Error('Checkout script unavailable')); };
        document.head.appendChild(script);
      });
    } catch (error) {
      hosts.forEach(function (host) {
        host.textContent = 'Checkout is temporarily unavailable. Please refresh to try again.';
      });
    }
  }

  window.addEventListener('celium:cart-updated', syncImpact);
  // Expose only the pure catalogue registration for contract tests; no cart is duplicated.
  if (typeof module !== 'undefined' && module.exports) module.exports = { registerProducts: registerProducts, syncImpact: syncImpact };
  else start();
})();
