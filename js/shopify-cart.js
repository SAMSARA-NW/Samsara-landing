(function () {
  'use strict';
  var products = {
    '9105424679140': { image: 'assets/images/5l-1.jpg', trees: 5 },
    '9105424580836': { image: 'assets/images/1l-1.jpg', trees: 1 },
    '9105424777444': { image: 'assets/images/1l-1.jpg', trees: 1 }
  };
  function productFor(item) {
    var id = item.variant && item.variant.product && item.variant.product.id;
    return products[String(id || '').split('/').pop()];
  }
  window.SamsaraCart = {
    prepare: function (cart) {
      if (cart.__samsaraImages) return;
      var original = cart.imageForLineItem;
      cart.imageForLineItem = function (item) {
        var product = productFor(item);
        return !item.variant.image && product ? new URL(product.image, document.baseURI).href : original.call(this, item);
      };
      cart.__samsaraImages = true;
    },
    syncImpact: function (cart) {
      var count = (cart.model && cart.model.lineItems || []).reduce(function (total, item) {
        var product = productFor(item);
        return total + (product ? product.trees * item.quantity : 0);
      }, 0);
      document.getElementById('tree-impact-count').textContent = count;
      document.getElementById('tree-impact-bar').classList.toggle('visible', count > 0);
    }
  };
})();
