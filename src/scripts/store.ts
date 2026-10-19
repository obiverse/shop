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
  get: () => read<{ name: string; note: string }>("obv.profile", { name: "", note: "" }),
  set: (p: { name: string; note: string }) => write("obv.profile", p),
};
