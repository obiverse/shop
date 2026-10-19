# Obiverse Shop — the plan

**Started:** 18 October 2026 · Stage 0
**Lives at:** `https://obiverse.github.io/shop/` (repo `obiverse/shop`, branch `gh-pages`)

---

## The one idea

A merchant's shop is three things: **a window** people forward, **a ledger** that prices honestly,
and **a conversation** where the trade closes. We build the window and the ledger. WhatsApp is the
conversation. No server, no database, no monthly bill. The catalogue lives in git, the storefront
is static, and the trade closes person to person, the way Sinbad's did.

```
 phone photo ──► pnpm studio (Apple Vision cut-out → studio backdrop)
                                  │
 team edits ──► /shop/admin (Sveltia CMS) or the files ──► commit to main
                                  │
                       pnpm ship (any laptop, ~1 min)
                       pull → test ledger → build → push gh-pages
                                  │
 customer ◄── obiverse.github.io/shop  (static PWA, installable, offline)
    │  builds cart (ids only; the WASM ledger prices it from catalog.json)
    ▼
 "Send on WhatsApp" ──► one message per house: lines, totals, order code, verify link
    ▼
 team taps verify link ──► /shop/order/#… re-prices the cart against today's catalogue
```

## Decisions (do not reopen without a reason)

| # | Decision | Why |
|---|---|---|
| D1 | **Astro (static output) + vanilla TS.** No React. | A content site with a few interactive parts. Astro ships zero JS by default, validates content against schemas and optimises every photo (AVIF/WebP, responsive sizes) at build time. The whole app's JS is ~9 KB gzipped. |
| D2 | **Rust → WASM "ledger" for all money and dates** (`crates/ledger`, 48 KB gz, tested). | One pure core handles pricing (integer kobo), rental day maths and clash checks, order codes, the WhatsApp message and the verify link. The same file formats prices at build time, so screen and message can never disagree. It can later run server-side unchanged. |
| D3 | **Git is the database. No GitHub Actions.** `pnpm ship` builds locally and force-pushes `dist/` to `gh-pages`. | Free on a public repo, nothing to run or pay for, every change has history and rollback. A handful of product lines doesn't need more. |
| D4 | **Sveltia CMS at `/shop/admin`** (two static files) for phone editing. | Teammates sign in with a GitHub token, edit products, upload photos (auto-WebP). Saves are commits; publishing is `pnpm ship`. |
| D5 | **The cart holds ids, never prices.** | A stale or tampered cart re-prices itself. |
| D6 | **Houses are first-class.** Obi Sandals, Scent House and Obiverse Assets (chair rentals, Ugep) each have their own WhatsApp number, story, accent, lineup and lookbook. | Three lines of trade, one shop. A mixed cart sends one message per house. |
| D7 | **Rentals are a product mode with stock** (`mode: rent`: price per unit per day, `units: 100` chairs, deposit, minimum days, bookings with `qty`). | The ledger checks every day of the range: 100 chairs minus what is already out, across all cart lines. Same cart, same message. |
| D8 | **Every product has its own URL with Open Graph tags + schema.org Product.** | WhatsApp forwarding is distribution. A forwarded link shows photo, name and price. |
| D9 | **Verify link in every order.** | The team re-prices in one tap and never trusts edited message text. |
| D10 | **The shop is an app.** Installable PWA with a bottom tab bar (Shop · Rent · Saved · Cart), offline catalogue and cart, install prompt + iOS hint, home-screen shortcuts, cross-page View Transitions, haptics, Web Share, automatic dark mode. | Feels like an app without an app store, and survives bad networks. |
| D11 | **Studio pipeline in the repo** (`pnpm studio <photo> <slug>`). Apple Vision lifts the product on-device, then it's placed on the house backdrop with a cast shadow. The untouched photo is kept beside it. | Phone photos on tiles become catalogue shots in one command. Showing the real photo too keeps it honest. |
| D13 | **Offers are real and time-boxed.** House `promo` (percent + end date) or product `sale`; the ledger applies them using the shopper's date, so they end on time without a rebuild. NGN offers round down to ₦500. | Discount badges, strike-throughs and countdowns drive sales; an honest end date keeps them legal (FCCPA) and credible. |
| D12 | **3D is opt-in per product** (`model: ./x.glb` → `<model-viewer>`, lazy-loaded, AR on phones). | Pages without a model pay nothing. See *3D path* below. |

## Upgrade paths (when, not if)

| Trigger | Move | What changes |
|---|---|---|
| Publishing by hand gets tedious | **Auto-ship on the kwataverse droplet:** a cron every 10 minutes runs `git fetch`; if main moved, `pnpm ship` with a deploy key. | Nothing in the shop. CMS saves go live in ≤10 minutes. |
| Stock moves faster than rebuilds | **Live overlay over the kwataverse relay.** Products are mirrored as NIP-99 listings (kind 30402, `t=kwataverse`, already accepted by the relay's policy), signed by the house keys pinned in this repo. The PWA reads them over `wss://relay.kwataverse.com` and verifies signatures client-side, so price and stock update live. The static pages stay as the SEO/OG/offline base. | The repo stays the root of trust. A compromised relay can't forge a price. |
| Orders need a book | Orders as encrypted NIP-17 messages to the house key alongside the WhatsApp send, or a 9S `/shop/orders/*` path. | WhatsApp stays the conversation; the record stops living only in chat. |
| Staff without GitHub, CRM, analytics | Payload CMS on the droplet, **exporting** the same `catalog.json` + content files. | The storefront doesn't change. |
| Paying online | Paystack payment link per order code, sent in the WhatsApp thread. | The verify page grows a "request payment" button. |

## 3D path

Photos sell these products; 3D has to be real or not at all. For a flagship pair:
1. Shoot 30–60 photos around the pair on a turntable (even light, no shadows).
2. Apple Object Capture (`PhotogrammetrySession`, on this Mac) → USDZ.
3. Blender: clean, decimate to <50k tris, bake, export GLB with Draco → `src/content/products/<slug>/model.glb` *(served from `public/` until we wire assets)*.
4. Add `model:` to the product and the gallery gets a rotatable, AR-placeable pair.

## Sequence

| Slice | What | Status |
|---|---|---|
| **0.1** | Storefront, cart, WASM ledger, WhatsApp send, verify page, PWA, real catalogue (5 slippers, 8 perfumes, 100 chairs), studio pipeline, GPS-stripped photos. | ✅ built and tested (9 ledger tests; mobile e2e across all three houses) |
| **0.2** | Go live: create `obiverse/shop`, push, enable Pages on `gh-pages`. Confirm prices and names. | ← next |
| **0.3** | Team editing: Sveltia tokens for the team, first product added from a phone. | |
| **0.4** | Auto-ship cron on the droplet. Real rentals. | |
| **1.x** | Relay live-overlay, order book, Paystack links, flagship 3D pair. | |

## What only you can do

1. **Prices.** Slippers ₦18,500–₦24,500 on the launch offer (regular ₦22,000–₦29,000, 15% off until 30 Nov, reverts automatically). Perfumes ₦8,000–₦30,000. Chairs still a placeholder (₦300/chair/day).
2. **Names.** "Obi Sandals" and "Scent House" are working names (Obiverse Assets is from its flier). Does the perfume house have its own WhatsApp number?
3. **Sizes.** Slippers list 40–46. Correct this if the range differs.
4. **Chairs.** Price per chair per day (placeholder ₦300), any deposit, whether blue/purple are counted separately, and a real photo of the stacks (`pnpm studio`). Drop the chair flier into `assets/products/` for the lookbook.
5. **Say go** on creating the public repo `obiverse/shop` and the first ship.
