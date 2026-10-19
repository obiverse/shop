# Obiverse Shop

Handmade men's slippers and authentic perfumes. Build a cart, send it on WhatsApp, close the trade in person.
Static PWA on GitHub Pages: **https://obiverse.github.io/shop/**

Read [docs/PLAN.md](docs/PLAN.md) for the why.

## Everyday tasks

| I want to… | Do this |
|---|---|
| Add or edit a product from my phone | Open `/shop/admin/`, sign in with your GitHub token, edit, Save. Then someone runs `pnpm ship`. |
| Add a product on a laptop | Make `src/content/products/<slug>/index.md` (copy a neighbour) and put the photos beside it. |
| Turn a phone photo into a catalogue shot | `pnpm studio ~/Downloads/IMG_1234.HEIC <slug>` (sand backdrop; add `dusk` for perfumes). Needs macOS. |
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

## Team access to the editor

1. Add the teammate as a collaborator on `obiverse/shop`.
2. They create a fine-grained token: GitHub → Settings → Developer settings → Fine-grained tokens →
   only `obiverse/shop`, **Contents: Read and write**.
3. At `/shop/admin/` choose **Sign in with token**.
