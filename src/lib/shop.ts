// Build-time access to the catalogue. Money is formatted by the same WASM ledger the browser uses.
import fs from "node:fs";
import path from "node:path";
import { getCollection, type CollectionEntry } from "astro:content";
import { initSync, format_money, sale_price } from "../ledger-pkg/ledger.js";
import shop from "../shop.json";

initSync({ module: fs.readFileSync(path.resolve("src/ledger-pkg/ledger_bg.wasm")) });

export type Product = CollectionEntry<"products">;
export type House = CollectionEntry<"houses">;
export { shop };

export const base = import.meta.env.BASE_URL.replace(/\/$/, "");
export const href = (p = "") => `${base}/${p.replace(/^\//, "")}`;
export const minor = (major: number) => Math.round(major * 100);
export const iso = (d: Date) => d.toISOString().slice(0, 10);

export async function houses() {
  return (await getCollection("houses")).sort((a, b) => a.data.order - b.data.order);
}

export async function products(filter: (p: Product) => boolean = () => true) {
  return (await getCollection("products", (p) => !p.data.draft && filter(p))).sort(
    (a, b) => Number(b.data.featured) - Number(a.data.featured) || a.data.order - b.data.order,
  );
}

export async function houseOf(p: Product) {
  return (await houses()).find((h) => h.id === p.data.house.id)!;
}

export function money(major: number, currency: string) {
  return format_money(minor(major), currency);
}

export type Offer = { now: number; was: number; pct: number; label: string; ends?: string };

/** The running offer for a product (its own sale, else its house promo), or null. Prices in major units. */
export function offer(p: Product, h: House): Offer | null {
  const own = p.data.sale, promo = h.data.promo;
  const src = own ?? promo;
  if (!src) return null;
  const ends = src.ends ? iso(src.ends) : undefined;
  if (ends && ends < iso(new Date())) return null; // already over at build time
  const step = h.data.currency === "NGN" ? 50_000 : 0; // NGN offers land on ₦500
  const nowMinor = own?.price ? minor(own.price) : sale_price(minor(p.data.price), src.percent ?? 0, step);
  const wasMinor = minor(p.data.price);
  if (!src.percent && !own?.price) return null;
  if (nowMinor >= wasMinor) return null;
  return {
    now: nowMinor / 100,
    was: wasMinor / 100,
    pct: Math.floor(((wasMinor - nowMinor) * 100) / wasMinor),
    label: own?.label ?? (own ? "Sale" : promo!.label),
    ends,
  };
}

export const endsLabel = (ends: string) => new Date(ends + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

export const stockLabel: Record<string, string> = {
  in: "In stock",
  low: "Only a few left",
  made_to_order: "Made to order",
  out: "Sold out",
};
