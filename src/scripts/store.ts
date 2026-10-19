// Cart and saved items live on the phone. The cart holds ids, options and dates — never prices.
export type Item = { id: string; qty: number; opt: string; from: string; to: string };

const read = <T>(k: string, d: T): T => {
  try { return JSON.parse(localStorage.getItem(k) || "") ?? d; } catch { return d; }
};
const write = (k: string, v: unknown) => {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch {}
  dispatchEvent(new CustomEvent("shop:change", { detail: k }));
};

const same = (a: Item, b: Item) => a.id === b.id && a.opt === b.opt && a.from === b.from && a.to === b.to;

export const cart = {
  all: () => read<Item[]>("obv.cart", []),
  set: (items: Item[]) => write("obv.cart", items.filter((i) => i.qty > 0)),
  add(item: Item) {
    const items = cart.all();
    const hit = items.find((i) => same(i, item));
    if (hit) hit.qty += item.qty; else items.push(item);
    cart.set(items);
  },
  count: () => cart.all().length, // lines, so 80 chairs reads as one thing in the cart
  clear: (ids?: string[]) => cart.set(ids ? cart.all().filter((i) => !ids.includes(i.id)) : []),
};

export const saved = {
  all: () => read<string[]>("obv.saved", []),
  has: (id: string) => saved.all().includes(id),
  toggle(id: string) {
    const s = saved.all();
    write("obv.saved", s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
    return !s.includes(id);
  },
};

export const profile = {
  get: () => ({ name: "", note: "", area: "", ...read<{ name?: string; note?: string; area?: string }>("obv.profile", {}) }),
  set: (p: { name: string; note: string; area: string }) => write("obv.profile", p),
};

// Orders sent on WhatsApp, newest first: the phone's own order history ("Buy again", "Ask about it").
export type Order = { code: string; house: string; name: string; at: number; total: string; items: Item[]; wa: string };
export const orders = {
  all: () => read<Order[]>("obv.orders", []),
  add(o: Order) { write("obv.orders", [o, ...orders.all().filter((x) => x.code !== o.code)].slice(0, 30)); },
};

// Recently viewed product ids, newest first.
export const viewed = {
  all: () => read<string[]>("obv.viewed", []),
  push(id: string) { write("obv.viewed", [id, ...viewed.all().filter((x) => x !== id)].slice(0, 12)); },
};
