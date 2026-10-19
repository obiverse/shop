import{c as e}from"./app.Dju1NfbP.js";var t=e=>e.replace(/[&<>"]/g,e=>({"&":`&amp;`,"<":`&lt;`,">":`&gt;`,'"':`&quot;`})[e]),n=e=>new Date(e+`T00:00:00Z`).toLocaleDateString(`en-GB`,{day:`numeric`,month:`short`,timeZone:`UTC`});function r(r,i,a){return r.houses.map(o=>{let s=i.houses.find(e=>e.id===o.house),c=r.lines.map((e,t)=>({l:e,i:t})).filter(({l:e})=>e.house===o.house);return`<section class="group" style="--h:${s.accent}" data-house="${o.house}">
  <header><i></i><h3>${t(o.name)}</h3><span class="code">${o.code}</span></header>
  ${c.map(({l:r,i:s})=>{let c=i.products.find(e=>e.id===r.id),l=[r.opt,r.mode===`rent`&&r.from&&r.to?`${n(r.from)} → ${n(r.to)} · ${r.days} day${r.days>1?`s`:``}`:``,r.mode===`rent`?`${e(r.unit,o.currency)}/day`:`${e(r.unit,o.currency)} each`].filter(Boolean).join(` · `),u=r.was&&!r.error?`<s class="d">${e(r.was*r.qty*Math.max(1,r.days),o.currency)}</s>`:``;return`<div class="line">
    <a href="${c?.url??`#`}"><img src="${c?.thumb??``}" alt="" width="72" height="90" loading="lazy"></a>
    <div><a class="t" href="${c?.url??`#`}">${t(r.title||r.id)}</a><div class="d">${t(l)}</div>
      ${r.deposit?`<div class="d">Refundable deposit ${e(r.deposit,o.currency)}</div>`:``}
      ${r.error?`<div class="e">${t(r.error)}</div>`:``}</div>
    <div class="r"><span>${r.error?`—`:e(r.total,o.currency)}${u}</span>
      ${a.edit?`<div class="qty"><button data-i="${s}" data-d="-1" aria-label="Fewer">−</button><output>${r.qty}</output><button data-i="${s}" data-d="1" aria-label="More">+</button></div>
      <button class="x" data-i="${s}" data-d="x">Remove</button>`:`<span class="d">× ${r.qty}</span>`}</div>
  </div>`}).join(``)}
  <div class="sum">
    <div><span>Subtotal</span><span>${e(o.subtotal,o.currency)}</span></div>
    ${o.deposits?`<div><span>Refundable deposits</span><span>${e(o.deposits,o.currency)}</span></div>`:``}
    ${o.saved?`<div class="save"><span>You save</span><span>${e(o.saved,o.currency)}</span></div>`:``}
    <div class="tot"><span>Total</span><span>${e(o.total,o.currency)}</span></div>
    <div class="muted" style="font-size:.85rem"><span>Delivery is agreed with you on WhatsApp.</span></div>
  </div>
  ${a.send?`<footer><button class="btn wa" data-send="${o.house}" ${o.items?``:`disabled`}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3Z"/></svg>Send to ${t(o.name)} on WhatsApp</button></footer>`:``}
</section>`}).join(``)}export{r as t};