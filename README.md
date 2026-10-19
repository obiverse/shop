# Obiverse Shop

Handmade men's slippers and authentic perfumes. Build a cart, send it on WhatsApp, close the trade in person.
Static PWA on GitHub Pages: **https://obiverse.github.io/shop/**

Read [docs/PLAN.md](docs/PLAN.md) for the why.

## Everyday tasks

| I want to… | Do this |
|---|---|
| Edit products on this laptop (no GitHub login) | `pnpm admin` → Chrome opens the editor → **Work with Local Repository** → pick this `obiverse.shop` folder → edit, Save → `pnpm ship`. Ship commits your edits and publishes. |
| Edit products from a phone | `obiverse.github.io/shop/admin/` → **Sign In Using Access Token** (needs a GitHub account with access). Then `pnpm ship` on the laptop. |
| Add a product on a laptop | Make `src/content/products/<slug>/index.md` (copy a neighbour) and put the photos beside it. |
| Turn a phone photo into a catalogue shot | `pnpm studio ~/Downloads/IMG_1234.HEIC <slug> "#FFE6CC" "#FFAE6B" floor -6`: product cut out, graded, on a colour-matched backdrop (light → deep) with a tinted shadow; use `reflect` for bottles and boxes. Also writes an enhanced original and the transparent `cutout.webp`. Needs macOS. Pick colours from the product's packaging. |
| Change the home banners | Each house's `banner` (kicker, title, text, button); `{from}` becomes the lowest current price. |
| Change a price | Edit `price:` (the regular price) in the product, or in the admin. |
| Run a sale on a whole house | In `src/content/houses/<house>.json` (or admin → Houses): `"promo": { "label": "Launch offer", "percent": 15, "ends": "2026-11-30" }`. Every product shows −15%, the struck-through regular price and a countdown. **On the day after `ends`, prices return to regular by themselves.** Delete `promo` to end early. |
| Put one product on sale | In the product: `sale: { percent: 20, ends: 2026-12-24 }` or `sale: { price: 17500 }`. Overrides the house offer. |
| Add a badge | `badge: Bestseller` (only if it's true). |
| Mark something sold out | Set `stock: out` (or `low`, `made_to_order`). |
| Hide a product | Set `draft: true`. |
| Block rental dates | Add `{ from: 2026-12-24, to: 2026-12-27 }` under `rent.booked`. |
| Change a WhatsApp number | `src/content/houses/<house>.json` |
| Check an order a customer sent | Tap the **Verify** link at the bottom of their WhatsApp message. |
| Publish | `pnpm ship` |

## Setup (once per machine)

```sh
nvm use            # Node 24 (see .nvmrc)
pnpm install
pnpm dev           # http://localhost:4321/shop/
```

Rust is optional. The built ledger is committed in `src/ledger-pkg/`. If you change `crates/ledger`,
run `pnpm ledger` (needs `cargo` + `wasm-pack`), which tests it and rebuilds the WASM.

## Layout

```
crates/ledger/        Rust → WASM: pricing, rental dates, order codes, WhatsApp text (cargo test)
src/content/houses/   one JSON per house + lineup + lookbook
src/content/products/ one folder per product: index.md + photos
src/pages/            home, house, product, rent, saved, cart, order (verify), catalog.json, manifest
src/scripts/          cart store, ledger loader, app shell (install, offline, haptics, share)
public/admin/         Sveltia CMS (config.yml)
public/sw.js          offline service worker
scripts/ship.sh       build + push to gh-pages
scripts/studio/       Apple Vision cut-out + studio compositor
assets/products/      original photos and fliers (source material, not published)
```

## If you lose access to GitHub

Shipping keeps working from this Mac: `pnpm ship` uses the GitHub CLI's saved login (`gh auth status`), and
`pnpm admin` needs no login at all. To get the account back:

1. **Recovery codes.** At github.com/login, after the password step choose *Use a recovery code*
   (the `github-recovery-codes.txt` you downloaded when you set up 2FA).
2. **A device still signed in.** Any browser or the GitHub mobile app that's still logged in can add a new
   authenticator under *Settings → Password and authentication*.
3. **Account recovery.** On the 2FA screen, *Recover your account*. GitHub verifies you and restores access
   (usually 1–3 business days). Do this now so it's running.
4. Afterwards: add a passkey **and** an authenticator, save new recovery codes somewhere off the phone,
   and add a trusted teammate as a collaborator so the shop never depends on one phone.

## Team access to the editor

1. Add the teammate as a collaborator on `obiverse/shop`.
2. They create a fine-grained token: GitHub → Settings → Developer settings → Fine-grained tokens →
   only `obiverse/shop`, **Contents: Read and write**.
3. At `/shop/admin/` choose **Sign in with token**.
