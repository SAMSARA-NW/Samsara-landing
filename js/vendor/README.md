# Active runtime: Celium Buy Button 2.0.0

Pinned 9 October 2026 from https://checkout.celium.eco/buy.js.
Upstream SHA-256: `a63a171c9d98f3840c25993281a040f1be549c4eb72c95a17fba48a19c763987`.

Narrow, reviewed local changes:

1. Pin API origin to `https://checkout.celium.eco` because the script is now served locally.
2. Emit `celium:cart-updated` after existing internal cart listeners, with `{cart, reason}`. `restore` is the default; successful add and update calls are labelled separately. The adapter uses full snapshots, including null/expired carts, and never intercepts fetch or infers totals from clicks.
3. Raise the bottom-right floating cart button to 76px to clear the site's fixed tree-impact bar.

The native `data-celium-product` button API renders all three product handles in option-1 compact format. `js/celium-cart.js` resolves the public vendor identity from saved embed `emb_XYo9N5lBLx`; no administrative credential or hardcoded storefront key is needed. Each card retains its own price/photos/tree copy, so duplicate embed content is disabled. The original saved embed configuration and remote catalogue are not modified.

Update the runtime deliberately. Preserve/review this small patch and test real add/change/remove/reload/expiry plus checkout navigation before releasing. Tree weights remain 5L=5, 1L=1, 750ml=1; unknown catalogue products receive no invented impact. Old Shopify carts are not imported into Celium.

## Historical Shopify runtime (not loaded)

# Shopify Buy Button

Pinned 24 September 2026 from Shopify's official distribution:
https://sdks.shopifycdn.com/buy-button/latest/buy-button-storefront.js

Bundle: Buy Button 3.1.3, includes Shopify's JS Buy compatibility layer.
Unmodified official bundle.

The local copy removes the additional runtime CDN dependency. Update deliberately and repeat the product/cart/checkout browser checks. The API version is controlled by this upstream compatibility bundle, not the storefront configuration.
