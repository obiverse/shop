// Scent Finder: three taps — who, vibe, budget — then the best matches with a score, and confetti.
// Scores only use what each product's packaging says about it (its tags); nothing is invented.
import { load, money, today, type Catalog } from "./ledger";
import { cart } from "./store";
import { confetti, toast, fly } from "./app";

type P = Catalog["products"][number];
const steps = [
  { key: "who", q: "Who's it for?", opts: [["men", "For him", "🧔🏾"], ["women", "For her", "👩🏾"], ["any", "Anyone", "✨"]] },
  { key: "vibe", q: "Pick a vibe", opts: [["fresh", "Fresh", "🌿"], ["sweet", "Sweet", "🍒"], ["bold", "Bold", "🔥"], ["warm", "Warm & rich", "🪵"]] },
  { key: "budget", q: "Your budget?", opts: [["10000", "Up to ₦10k", "💸"], ["20000", "Up to ₦20k", "💰"], ["any", "Treat me", "👑"]] },
] as const;

export async function openFinder() {
  const { catalog } = await load();
  const dlg = document.getElementById("finder") as HTMLDialogElement;
  const body = dlg.querySelector<HTMLElement>(".finder-body")!;
  const picks: Record<string, string> = {};
  const scents = catalog.products.filter((p) => p.house === "scents");
  const nowOf = (p: P) => (p.sale && (!p.sale.ends || p.sale.ends >= today()) ? p.sale.price : p.price);

  const draw = (i: number) => {
    if (i >= steps.length) return results();
    const s = steps[i];
    body.innerHTML = `
      <div class="finder-progress">${steps.map((_, j) => `<i class="${j <= i ? "on" : ""}"></i>`).join("")}</div>
      <h2>${s.q}</h2>
      <div class="finder-opts">${s.opts.map(([v, l, e]) => `<button class="finder-opt" data-v="${v}"><span>${e}</span>${l}</button>`).join("")}</div>
      ${i ? `<button class="finder-back" data-back>← Back</button>` : ""}`;
    body.querySelectorAll<HTMLButtonElement>("[data-v]").forEach((b) => b.onclick = () => {
      picks[s.key] = b.dataset.v!;
      b.classList.add("picked");
      navigator.vibrate?.(10);
      setTimeout(() => draw(i + 1), 180);
    });
    body.querySelector<HTMLButtonElement>("[data-back]")?.addEventListener("click", () => draw(i - 1));
  };

  const results = () => {
    const budget = picks.budget === "any" ? Infinity : Number(picks.budget) * 100;
    const scored = scents.map((p) => {
      let s = 0;
      if (picks.who === "any" || p.tags.includes(picks.who) || p.tags.includes("unisex")) s += 40;
      if (p.tags.includes(picks.vibe)) s += 40;
      if (nowOf(p) <= budget) s += 20;
      return { p, s };
    }).sort((a, b) => b.s - a.s || nowOf(a.p) - nowOf(b.p)).slice(0, 3);
    body.innerHTML = `
      <div class="finder-progress">${steps.map(() => `<i class="on"></i>`).join("")}</div>
      <h2>Your matches ✨</h2>
      <div class="finder-results">${scored.map(({ p, s }, i) => `
        <div class="finder-hit" style="${p.tint ? `--tint:${p.tint}` : ""}">
          <a href="${p.url}" class="pic"><img src="${p.thumb}" alt=""></a>
          <div><span class="match">${i === 0 ? "Best match · " : ""}${s}%</span><b>${p.title}</b>
            <span class="now ${p.sale ? "hot" : ""}">${money(nowOf(p), "NGN")}</span></div>
          <button class="btn brand sq" data-add="${p.id}" aria-label="Add ${p.title}">＋</button>
        </div>`).join("")}</div>
      <button class="finder-back" data-again>↻ Try again</button>`;
    body.querySelectorAll<HTMLButtonElement>("[data-add]").forEach((b) => b.onclick = () => {
      const p = scents.find((x) => x.id === b.dataset.add)!;
      const opt = p.options.map((o) => `${o.name} ${o.values[0]}`).join(", ");
      cart.add({ id: p.id, qty: 1, opt, from: "", to: "" });
      fly(b.closest(".finder-hit")!.querySelector("img"));
      toast(`${p.title} added`, true);
    });
    body.querySelector<HTMLButtonElement>("[data-again]")!.onclick = () => draw(0);
    confetti();
  };

  draw(0);
  dlg.showModal();
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
}
