// Build-time access to the catalogue. Money is formatted by the same WASM ledger the browser uses.
import fs from "node:fs";
import path from "node:path";
import { getCollection, type CollectionEntry } from "astro:content";
import { initSync, format_money } from "../ledger-pkg/ledger.js";
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

export const stockLabel: Record<string, string> = {
  in: "In stock",
  low: "Only a few left",
  made_to_order: "Made to order",
  out: "Sold out",
};
