// The app shell: cart badge, toasts, haptics, saved hearts, share, live offer timers, search, quick add,
// fly-to-cart, install and offline.
import { cart, saved } from "./store";
import { load, money, today, type Catalog } from "./ledger";

const BASE = import.meta.env.BASE_URL;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function toast(msg: string, cartLink = false) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.innerHTML = `<span>${esc(msg)}</span>${cartLink ? `<a href="${BASE}cart/">View cart</a>` : ""}`;
  t.classList.add("on");
  clearTimeout((t as any)._t);
  (t as any)._t = setTimeout(() => t.classList.remove("on"), cartLink ? 3200 : 2000);
}

export const buzz = () => navigator.vibrate?.(12);

/** A copy of the product photo flies into the cart, and the badge bumps when it lands. */
export function fly(img: HTMLImageElement | null | undefined) {
  buzz();
  const target = [...document.querySelectorAll<HTMLElement>("[data-cart-target]")].find((el) => el.offsetParent !== null);
  if (!img || !target || matchMedia("(prefers-reduced-motion: reduce)").matches) return bump();
  const a = img.getBoundingClientRect(), b = target.getBoundingClientRect();
  const size = Math.min(a.width, 140);
  const ghost = Object.assign(document.createElement("img"), { src: img.currentSrc || img.src, className: "fly" });
  Object.assign(ghost.style, { left: `${a.left + a.width / 2 - size / 2}px`, top: `${a.top + a.height / 2 - size * 0.625}px`, width: `${size}px`, height: `${size * 1.25}px` });
  document.body.append(ghost);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
  ghost.animate(
    [{ transform: "translate(0,0) scale(1)", opacity: 1 }, { transform: `translate(${dx * 0.4}px, ${dy * 0.4 - 80}px) scale(.6)`, opacity: 1, offset: 0.45 }, { transform: `translate(${dx}px, ${dy}px) scale(.08)`, opacity: 0.4 }],
    { duration: 700, easing: "cubic-bezier(.5,0,.75,1)" },
  ).finished.then(() => { ghost.remove(); bump(); });
}
function bump() {
  document.querySelectorAll<HTMLElement>("[data-cart-count]").forEach((c) => { c.classList.remove("bump"); void c.offsetWidth; c.classList.add("bump"); });
}

function badge() {
  const n = cart.count();
  document.querySelectorAll<HTMLElement>("[data-cart-count]").forEach((b) => { b.textContent = String(n); b.hidden = n === 0; });
}
function hearts() {
  document.querySelectorAll<HTMLButtonElement>("[data-save]").forEach((b) => b.setAttribute("aria-pressed", String(saved.has(b.dataset.save!))));
}

// ── offers: end on their date without a rebuild, and count down live
function offers() {
  const now = today();
  document.querySelectorAll<HTMLElement>("[data-ends]").forEach((el) => {
    const ends = el.dataset.ends!;
    if (!ends || ends >= now) return;
    if (el.dataset.regular) {
      const n = el.querySelector<HTMLElement>(".now");
      if (n) { n.textContent = el.dataset.regular; n.classList.remove("hot"); }
    }
    el.querySelectorAll<HTMLElement>("[data-offer-only]").forEach((x) => (x.hidden = true));
    if (el.hasAttribute("data-offer-only")) el.hidden = true;
  });
}
function timers() {
  const els = document.querySelectorAll<HTMLElement>("[data-countdown]");
  if (!els.length) return;
  const tick = () => els.forEach((el) => {
    const [y, m, d] = el.dataset.countdown!.split("-").map(Number);
    const left = Math.max(0, new Date(y, m - 1, d, 23, 59, 59).getTime() - Date.now());
    const s = Math.floor(left / 1000), dd = Math.floor(s / 86400), hh = Math.floor((s % 86400) / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60;
    const two = (n: number) => String(n).padStart(2, "0");
    el.textContent = `${dd ? `${dd}d ` : ""}${two(hh)}:${two(mm)}:${two(ss)}`;
  });
  tick();
  setInterval(tick, 1000);
}

// ── taps: save, share, quick add, search
document.addEventListener("click", async (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>("[data-save],[data-share],[data-quick],[data-search]");
  if (!el) return;
  e.preventDefault();
  e.stopPropagation();
  if (el.dataset.save) {
    const on = saved.toggle(el.dataset.save);
    buzz();
    toast(on ? "♥ Saved for later" : "Removed from saved");
  } else if (el.dataset.share !== undefined) {
    const url = el.dataset.share || location.href;
    const title = el.dataset.title || document.title;
    if (navigator.share) navigator.share({ title, url }).catch(() => {});
    else { await navigator.clipboard?.writeText(url); toast("Link copied"); }
  } else if (el.dataset.quick) {
    quickAdd(el.dataset.quick, el.closest(".card")?.querySelector("img"));
  } else {
    openSearch();
  }
});

// ── quick add: no options → straight in; options → a bottom sheet; rentals → the product page (dates)
async function quickAdd(id: string, img?: HTMLImageElement | null) {
  const { catalog } = await load();
  const p = catalog.products.find((x) => x.id === id);
  if (!p) return;
  if (p.mode === "rent") { location.href = p.url; return; }
  if (!p.options.length) { cart.add({ id, qty: 1, opt: "", from: "", to: "" }); fly(img); toast(`${p.title} added`, true); return; }
  const h = catalog.houses.find((x) => x.id === p.house)!;
  const dlg = document.getElementById("quick") as HTMLDialogElement;
  const form = document.getElementById("quick-form") as HTMLFormElement;
  const { now, was } = priceOf(p);
  form.innerHTML = `
    <div class="qa-head" style="${p.tint ? `--tint:${p.tint}` : ""}">
      <div class="pic"><img src="${p.thumb}" alt=""></div>
      <div><span class="k">${esc(h.name)}</span><h3>${esc(p.title)}</h3>
        <div class="price" style="margin-top:6px"><span class="now ${was ? "hot" : ""}" style="font-size:1.4rem">${money(now, h.currency)}</span>${was ? `<s>${money(was, h.currency)}</s>` : ""}</div>
        <a href="${p.url}" style="font-weight:800;font-size:.85rem;color:var(--brand)">View details →</a></div>
    </div>
    <div class="qa-body">${p.options.map((o) => `<fieldset><legend>${esc(o.name)}</legend><div class="opts">${o.values.map((v) => `<label><input type="radio" name="${esc(o.name)}" value="${esc(v)}" required ${o.values.length === 1 ? "checked" : ""}><span>${esc(v)}</span></label>`).join("")}</div></fieldset>`).join("")}</div>
    <div class="qa-foot"><button class="btn ghost sq" value="cancel" formnovalidate aria-label="Close">✕</button><button class="btn brand grow" value="add">Add to cart · ${money(now, h.currency)}</button></div>`;
  form.onsubmit = (ev) => {
    const sub = (ev as SubmitEvent).submitter as HTMLButtonElement | null;
    if (sub?.value !== "add") return;
    const f = new FormData(form);
    const opt = p.options.map((o) => `${o.name} ${f.get(o.name)}`).join(", ");
    cart.add({ id, qty: 1, opt, from: "", to: "" });
    setTimeout(() => { fly(img); toast(`${p.title} added`, true); }, 120);
  };
  dlg.showModal();
  dlg.addEventListener("click", (ev) => { if (ev.target === dlg) dlg.close(); }, { once: true });
}

function priceOf(p: Catalog["products"][number]) {
  const live = p.sale && (!p.sale.ends || p.sale.ends >= today());
  return live ? { now: p.sale!.price, was: p.price } : { now: p.price, was: 0 };
}

// ── search: instant, offline, over the catalogue
const RECENT = "obv.recent";
async function openSearch() {
  const dlg = document.getElementById("search") as HTMLDialogElement;
  const input = dlg.querySelector("input")!;
  const out = document.getElementById("results")!;
  const { catalog } = await load();
  const hay = catalog.products.map((p) => ({ p, h: catalog.houses.find((x) => x.id === p.house)!, text: `${p.title} ${catalog.houses.find((x) => x.id === p.house)!.name} ${p.tags.join(" ")}`.toLowerCase() }));
  const recent = (): string[] => { try { return JSON.parse(localStorage.getItem(RECENT) || "[]"); } catch { return []; } };
  const row = ({ p, h }: (typeof hay)[number]) => {
    const { now, was } = priceOf(p);
    return `<a class="result" href="${p.url}" data-term="${esc(p.title)}"><img src="${p.thumb}" alt="" loading="lazy" style="${p.tint ? `background:${p.tint}` : ""}"><span><b>${esc(p.title)}</b><small>${esc(h.name)}${p.mode === "rent" ? " · for rent" : ""}</small></span><span><span class="now ${was ? "hot" : ""}">${money(now, h.currency)}</span>${was ? `<s>${money(was, h.currency)}</s>` : ""}</span></a>`;
  };
  const draw = () => {
    const q = input.value.trim().toLowerCase();
    if (!q) {
      const r = recent();
      out.innerHTML = `${r.length ? `<h3>Recent</h3><div class="suggest">${r.map((t) => `<button class="chip" data-fill="${esc(t)}">${esc(t)}</button>`).join("")}</div>` : ""}
        <h3>Popular</h3><div class="suggest">${["Slippers", "Lattafa", "Perfume for men", "Chairs", "Luxury Toe", "Kay Ali"].map((t) => `<button class="chip" data-fill="${t}">${t}</button>`).join("")}</div>
        <h3>Trending</h3>${hay.filter(({ p }) => p.sale || p.tags.includes("events")).slice(0, 6).map(row).join("")}`;
      return;
    }
    // Every query word must start some word of the product (so "men" never matches "women").
    const norm = (t: string) => t.replace(/perfumes?|scents?|eau de parfum|fragrances?|cologne/g, "scent").replace(/slippers?|sandals?|palms?|shoes?/g, "sandal").replace(/chairs?|seats?/g, "chair").replace(/\b(his|male|man|guys?)\b/g, "men").replace(/\b(hers|female|woman|ladies|lady)\b/g, "women");
    const words = norm(q).split(/[^a-z0-9]+/).filter(Boolean);
    const hits = hay.filter(({ text, p }) => {
      const mine = norm(`${text} ${p.house === "scents" ? "scent" : p.house === "sandals" ? "sandal men" : "chair"}`).split(/[^a-z0-9]+/);
      return words.every((w) => mine.some((m) => m.startsWith(w)));
    })
      .sort((a, b) => Number(b.p.title.toLowerCase().startsWith(q)) - Number(a.p.title.toLowerCase().startsWith(q)));
    out.innerHTML = hits.length ? `<h3>${hits.length} result${hits.length > 1 ? "s" : ""}</h3>${hits.map(row).join("")}` : `<div class="empty"><div class="art">🔎</div><h2>No match for “${esc(input.value)}”</h2><p>Try “slippers”, “perfume” or “chairs” — or just ask us on WhatsApp.</p></div>`;
  };
  out.onclick = (e) => {
    const fill = (e.target as HTMLElement).closest<HTMLElement>("[data-fill]");
    if (fill) { input.value = fill.dataset.fill!; draw(); return; }
    const hit = (e.target as HTMLElement).closest<HTMLElement>("[data-term]");
    if (hit && input.value.trim()) try { localStorage.setItem(RECENT, JSON.stringify([input.value.trim(), ...recent().filter((t) => t !== input.value.trim())].slice(0, 6))); } catch {}
  };
  input.oninput = draw;
  dlg.querySelector<HTMLButtonElement>("[data-close]")!.onclick = () => dlg.close();
  draw();
  dlg.showModal();
  input.focus();
}
addEventListener("keydown", (e) => { if (e.key === "/" && !(e.target as HTMLElement).closest("input,textarea")) { e.preventDefault(); openSearch(); } });

// The search row tucks away while scrolling down and returns on the way up.
const header = document.querySelector<HTMLElement>(".top");
if (header) {
  let last = scrollY;
  addEventListener("scroll", () => {
    const y = scrollY;
    if (Math.abs(y - last) < 6) return;
    header.classList.toggle("tucked", y > 140 && y > last);
    last = y;
  }, { passive: true });
}

addEventListener("shop:change", () => { badge(); hearts(); });
addEventListener("storage", () => { badge(); hearts(); });
badge();
hearts();
offers();
timers();

// ── offline + install
if ("serviceWorker" in navigator && !import.meta.env.DEV) navigator.serviceWorker.register(`${BASE}sw.js`, { scope: BASE });

const sheet = document.getElementById("install") as HTMLElement | null;
const dismissed = () => { try { return localStorage.getItem("obv.install") === "no"; } catch { return false; } };
const standalone = matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone;
let deferred: any;
addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferred = e;
  if (sheet && !dismissed()) setTimeout(() => (sheet.hidden = false), 6000);
});
if (sheet && !standalone && !dismissed() && /iphone|ipad|ipod/i.test(navigator.userAgent)) {
  sheet.dataset.ios = "";
  setTimeout(() => (sheet.hidden = false), 8000);
}
sheet?.querySelector("[data-install]")?.addEventListener("click", async () => {
  if (deferred) { deferred.prompt(); await deferred.userChoice; deferred = null; }
  sheet.hidden = true;
});
sheet?.querySelector("[data-dismiss]")?.addEventListener("click", () => {
  try { localStorage.setItem("obv.install", "no"); } catch {}
  sheet.hidden = true;
});
