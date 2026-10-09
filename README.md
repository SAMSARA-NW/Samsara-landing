# Samsara Olive Oil website

Live: https://samsara-landing-psi.vercel.app/index.html

## Current runtime (9 October 2026)

- `index.html`: existing product cards with compact Celium buttons, one shared cart/checkout, unchanged infused-oil preorder.
- `about.html`: rehabilitation progress and involvement enquiry form.
- `links.html`: social landing links, including the involvement section.
- `api/involvement.js`: Vercel Node function sending enquiries through Resend to Nicolas, with the visitor as Reply-To. Configure `RESEND_API_KEY` as a server-only Vercel environment variable. Never put it in browser JavaScript.
- `js/celium-cart.js`: resolves the supplied public saved embed, maps catalogue variant IDs to the established 5/1/1 tree weights, and synchronizes impact from confirmed full-cart snapshots.
- `js/vendor/celium-buy.js`: pinned Celium runtime with a narrow full-cart event hook; see its adjacent README. The old Shopify files are retained as history but no longer loaded.
- Existing infused preorders are stored in `pre_order_hemp` (legacy table name); the UI uses the approved generic infused-oil name and R330/500ml price.
- Legacy PayFast is disabled. All three ordinary product sizes use Celium; infused preorder remains separate.

## Local preview and checks

Static preview: `python3 -m http.server 8080` (the email API needs Vercel's server runtime).

Checks: `node --test tests/*.test.cjs`. Cart impact must follow additions, changes, removals, expiry and reload without replaying old contribution toasts.

Before deploying, browser-check all three public pages at mobile and desktop widths; add 5L, 1L and 750ml products; change/remove quantities; reload the cart; check images and totals; follow the Celium checkout handoff without placing a paid order; test enquiry success/failure and the infused-oil preorder validation.

## Email protections and limits

The handler validates email/message lengths, rejects other origins, includes a honeypot, and uses provider idempotency keys so a retry does not send the same message twice. The rate limiter is per warm function instance, not a distributed/global abuse limit. Consider managed WAF rate limiting if traffic warrants it. Successful API/provider acceptance does not by itself prove inbox receipt.

## Prices (verified against Celium on 9 October 2026)

- 5L tin: R1,780
- 1L tin: R360
- 750ml: R330
- Infused olive oil 500ml preorder: R330

Nicolas approved using the 1L product photo for both 1L and 750ml website cart thumbnails on 24 September 2026. This is a website fallback; it does not upload images to the Shopify catalogue or alter hosted-checkout images.
