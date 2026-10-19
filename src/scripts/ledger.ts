// Loads the WASM ledger and today's catalogue once, on the pages that price things.
import init, { Ledger, decode_cart, format_money } from "../ledger-pkg/ledger.js";
import type { Item } from "./store";

export type Catalog = {
  houses: { id: string; name: string; currency: string; whatsapp: string; accent: string }[];
  products: { id: string; title: string; house: string; mode: string; price: number; stock: string; url: string; thumb: string; options: { name: string; values: string[] }[]; rent?: { deposit: number; min_days: number; units?: number; booked: { from: string; to: string; qty?: number }[] } }[];
};
export type Line = { id: string; title: string; house: string; mode: string; qty: number; opt: string; from: string; to: string; days: number; unit: number; deposit: number; total: number; error?: string };
export type HouseTotal = { house: string; name: string; currency: string; items: number; subtotal: number; deposits: number; total: number; code: string };
export type Quote = { lines: Line[]; houses: HouseTotal[]; ok: boolean };

let ready: Promise<{ ledger: Ledger; catalog: Catalog }> | undefined;

export function load() {
  return (ready ??= (async () => {
    const [, catalog] = await Promise.all([init(), fetch(`${import.meta.env.BASE_URL}catalog.json`).then((r) => r.json() as Promise<Catalog>)]);
    return { ledger: new Ledger(catalog), catalog };
  })());
}

export const quote = async (items: Item[]) => (await load()).ledger.quote(items) as Quote;
export const money = (minor: number, currency: string) => format_money(minor, currency);
export const decode = (s: string) => decode_cart(s) as Item[];
