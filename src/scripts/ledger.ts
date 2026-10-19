// Loads the WASM ledger and today's catalogue once, on the pages that price things.
import init, { Ledger, decode_cart, encode_cart, format_money } from "../ledger-pkg/ledger.js";
import type { Item } from "./store";

export type Catalog = {
  houses: { id: string; name: string; currency: string; whatsapp: string; accent: string }[];
  products: { id: string; title: string; house: string; mode: string; price: number; stock: string; sale?: { price: number; ends: string }; url: string; thumb: string; tags: string[]; tint?: string; options: { name: string; values: string[] }[]; rent?: { deposit: number; min_days: number; units?: number; booked: { from: string; to: string; qty?: number }[] } }[];
};
export type Line = { id: string; title: string; house: string; mode: string; qty: number; opt: string; from: string; to: string; days: number; unit: number; was: number; deposit: number; total: number; saved: number; error?: string };
export type HouseTotal = { house: string; name: string; currency: string; items: number; subtotal: number; deposits: number; total: number; saved: number; code: string };
export type Quote = { lines: Line[]; houses: HouseTotal[]; ok: boolean };

let ready: Promise<{ ledger: Ledger; catalog: Catalog }> | undefined;

export function load() {
  return (ready ??= (async () => {
    const [, catalog] = await Promise.all([init(), fetch(`${import.meta.env.BASE_URL}catalog.json`).then((r) => r.json() as Promise<Catalog>)]);
    const ledger = new Ledger(catalog);
    ledger.set_today(today());
    return { ledger, catalog };
  })());
}

/** The shopper's local date, YYYY-MM-DD. */
export const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);

export const quote = async (items: Item[]) => (await load()).ledger.quote(items) as Quote;
export const money = (minor: number, currency: string) => format_money(minor, currency);
export const decode = (s: string) => decode_cart(s) as Item[];
export const encode = (items: Item[]) => encode_cart(items);
