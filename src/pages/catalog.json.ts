// The browser's price list. The cart stores ids only; every quote is re-computed from this file.
import { getImage } from "astro:assets";
import { houses, products, minor, iso, href, offer } from "../lib/shop";

export async function GET() {
  const hs = await houses();
  const ps = await products();
  const body = {
    houses: hs.map((h) => ({ id: h.id, name: h.data.name, currency: h.data.currency, whatsapp: h.data.whatsapp.replace(/\D/g, ""), accent: h.data.accent })),
    products: await Promise.all(
      ps.map(async (p) => ({
        id: p.id,
        title: p.data.title,
        house: p.data.house.id,
        mode: p.data.mode,
        price: minor(p.data.price),
        stock: p.data.stock,
        sale: ((o) => o && { price: minor(o.now), ends: o.ends ?? "" })(offer(p, hs.find((h) => h.id === p.data.house.id)!)),
        rent: p.data.rent && {
          deposit: minor(p.data.rent.deposit),
          min_days: p.data.rent.min_days,
          units: p.data.rent.units,
          booked: p.data.rent.booked.map((r) => ({ from: iso(r.from), to: iso(r.to), qty: r.qty })),
        },
        options: p.data.options,
        tags: p.data.tags,
        tint: p.data.tint,
        url: href(`p/${p.id}/`),
        thumb: (await getImage({ src: p.data.images[0], width: 320, height: 400, format: "webp" })).src,
      })),
    ),
  };
  return new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
}
