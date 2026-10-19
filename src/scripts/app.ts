// The app shell: cart badge, toasts, haptics, saved hearts, share, install, offline.
import { cart, saved } from "./store";

const BASE = import.meta.env.BASE_URL;

export function toast(msg: string) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("on");
  clearTimeout((t as any)._t);
  (t as any)._t = setTimeout(() => t.classList.remove("on"), 2200);
}

export const buzz = () => navigator.vibrate?.(12);

function badge() {
  const n = cart.count();
  document.querySelectorAll<HTMLElement>("[data-cart-count]").forEach((b) => {
    b.textContent = String(n);
    b.hidden = n === 0;
  });
}

function hearts() {
  document.querySelectorAll<HTMLButtonElement>("[data-save]").forEach((b) => b.setAttribute("aria-pressed", String(saved.has(b.dataset.save!))));
}

document.addEventListener("click", async (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>("[data-save],[data-share]");
  if (!el) return;
  e.preventDefault();
  if (el.dataset.save) {
    const on = saved.toggle(el.dataset.save);
    buzz();
    toast(on ? "Saved" : "Removed from saved");
  } else {
    const url = el.dataset.share || location.href;
    const title = el.dataset.title || document.title;
    if (navigator.share) navigator.share({ title, url }).catch(() => {});
    else { await navigator.clipboard?.writeText(url); toast("Link copied"); }
  }
});

// Offers end on their date even if nobody has rebuilt the site: show the regular price again.
function offers() {
  const now = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
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
  document.querySelectorAll<HTMLElement>("[data-days-left]").forEach((el) => {
    const left = Math.round((Date.parse(el.dataset.daysLeft!) - Date.parse(now)) / 86_400_000) + 1;
    el.textContent = left <= 1 ? "· last day!" : left <= 14 ? `· ${left} days left` : "";
  });
}
offers();

addEventListener("shop:change", () => { badge(); hearts(); });
addEventListener("storage", () => { badge(); hearts(); });
badge();
hearts();

// Offline + install.
if ("serviceWorker" in navigator && !import.meta.env.DEV) navigator.serviceWorker.register(`${BASE}sw.js`, { scope: BASE });

const sheet = document.getElementById("install") as HTMLElement | null;
const dismissed = () => { try { return localStorage.getItem("obv.install") === "no"; } catch { return false; } };
const standalone = matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone;
let deferred: any;

addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferred = e;
  if (sheet && !dismissed()) sheet.hidden = false;
});

if (sheet && !standalone && !dismissed() && /iphone|ipad|ipod/i.test(navigator.userAgent)) {
  sheet.dataset.ios = "";
  setTimeout(() => (sheet.hidden = false), 4000);
}

sheet?.querySelector("[data-install]")?.addEventListener("click", async () => {
  if (deferred) { deferred.prompt(); await deferred.userChoice; deferred = null; }
  sheet.hidden = true;
});
sheet?.querySelector("[data-dismiss]")?.addEventListener("click", () => {
  try { localStorage.setItem("obv.install", "no"); } catch {}
  sheet.hidden = true;
});
