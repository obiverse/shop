// Draws a priced quote, grouped by house. Shared by the cart and the team's verify page.
import { money, type Catalog, type Quote } from "./ledger";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const day = (s: string) => new Date(s + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

export function groups(q: Quote, cat: Catalog, opts: { edit: boolean }) {
  return q.houses.map((h) => {
    const house = cat.houses.find((x) => x.id === h.house)!;
    const lines = q.lines.map((l, i) => ({ l, i })).filter(({ l }) => l.house === h.house);
    return `<section class="group" style="--h:${house.accent}" data-house="${h.house}">
  <header><i></i><h3>${esc(h.name)}</h3><span class="code">${h.code}</span></header>
  ${lines.map(({ l, i }) => {
    const p = cat.products.find((x) => x.id === l.id);
    const detail = [l.opt, l.mode === "rent" && l.from && l.to ? `${day(l.from)} → ${day(l.to)} · ${l.days} day${l.days > 1 ? "s" : ""}` : "", l.mode === "rent" ? `${money(l.unit, h.currency)}/day` : `${money(l.unit, h.currency)} each`].filter(Boolean).join(" · ");
    const was = l.was && !l.error ? `<s class="d">${money(l.was * l.qty * Math.max(1, l.days), h.currency)}</s>` : "";
    return `<div class="line">
    <a href="${p?.url ?? "#"}"><img src="${p?.thumb ?? ""}" alt="" width="72" height="90" loading="lazy"></a>
    <div><a class="t" href="${p?.url ?? "#"}">${esc(l.title || l.id)}</a><div class="d">${esc(detail)}</div>
      ${l.deposit ? `<div class="d">Refundable deposit ${money(l.deposit, h.currency)}</div>` : ""}
      ${l.error ? `<div class="e">${esc(l.error)}</div>` : ""}</div>
    <div class="r"><span>${l.error ? "—" : money(l.total, h.currency)}${was}</span>
      ${opts.edit ? `<div class="qty"><button data-i="${i}" data-d="-1" aria-label="Fewer">−</button><output>${l.qty}</output><button data-i="${i}" data-d="1" aria-label="More">+</button></div>
      <button class="x" data-i="${i}" data-d="x">Remove</button>` : `<span class="d">× ${l.qty}</span>`}</div>
  </div>`;
  }).join("")}
  <div class="sum">
    <div><span>Subtotal</span><span>${money(h.subtotal, h.currency)}</span></div>
    ${h.deposits ? `<div><span>Refundable deposits</span><span>${money(h.deposits, h.currency)}</span></div>` : ""}
    ${h.saved ? `<div class="save"><span>You save</span><span>${money(h.saved, h.currency)}</span></div>` : ""}
    <div class="tot"><span>Total</span><span>${money(h.total, h.currency)}</span></div>
    <div class="muted" style="font-size:.85rem"><span>Delivery is agreed with you on WhatsApp.</span></div>
  </div>
  ${opts.edit ? `<footer><button class="btn wa" data-send="${h.house}" ${h.items ? "" : "disabled"}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3Z"/></svg>Send to ${esc(h.name)} on WhatsApp</button></footer>` : ""}
</section>`;
  }).join("");
}
