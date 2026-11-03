import{t as e}from"./store.BVCb2Z-P.js";import{a as t,c as n,l as r,n as i,r as a,u as o}from"./app.Cvs845Nb.js";var s=[{key:`who`,q:`Who's it for?`,opts:[[`men`,`For him`,`🧔🏾`],[`women`,`For her`,`👩🏾`],[`any`,`Anyone`,`✨`]]},{key:`vibe`,q:`Pick a vibe`,opts:[[`fresh`,`Fresh`,`🌿`],[`sweet`,`Sweet`,`🍒`],[`bold`,`Bold`,`🔥`],[`warm`,`Warm & rich`,`🪵`]]},{key:`budget`,q:`Your budget?`,opts:[[`10000`,`Up to ₦10k`,`💸`],[`20000`,`Up to ₦20k`,`💰`],[`any`,`Treat me`,`👑`]]}];async function c(){let{catalog:c}=await n(),l=document.getElementById(`finder`),u=l.querySelector(`.finder-body`),d={},f=c.products.filter(e=>e.house===`scents`),p=e=>e.sale&&(!e.sale.ends||e.sale.ends>=o())?e.sale.price:e.price,m=e=>{if(e>=s.length)return h();let t=s[e];u.innerHTML=`
      <div class="finder-progress">${s.map((t,n)=>`<i class="${n<=e?`on`:``}"></i>`).join(``)}</div>
      <h2>${t.q}</h2>
      <div class="finder-opts">${t.opts.map(([e,t,n])=>`<button class="finder-opt" data-v="${e}"><span>${n}</span>${t}</button>`).join(``)}</div>
      ${e?`<button class="finder-back" data-back>← Back</button>`:``}`,u.querySelectorAll(`[data-v]`).forEach(n=>n.onclick=()=>{d[t.key]=n.dataset.v,n.classList.add(`picked`),navigator.vibrate?.(10),setTimeout(()=>m(e+1),180)}),u.querySelector(`[data-back]`)?.addEventListener(`click`,()=>m(e-1))},h=()=>{let n=d.budget===`any`?1/0:Number(d.budget)*100,o=f.map(e=>{let t=0;return(d.who===`any`||e.tags.includes(d.who)||e.tags.includes(`unisex`))&&(t+=40),e.tags.includes(d.vibe)&&(t+=40),p(e)<=n&&(t+=20),{p:e,s:t}}).sort((e,t)=>t.s-e.s||p(e.p)-p(t.p)).slice(0,3);u.innerHTML=`
      <div class="finder-progress">${s.map(()=>`<i class="on"></i>`).join(``)}</div>
      <h2>Your matches ✨</h2>
      <div class="finder-results">${o.map(({p:e,s:t},n)=>`
        <div class="finder-hit" style="${e.tint?`--tint:${e.tint}`:``}">
          <a href="${e.url}" class="pic"><img src="${e.thumb}" alt=""></a>
          <div><span class="match">${n===0?`Best match · `:``}${t}%</span><b>${e.title}</b>
            <span class="now ${e.sale?`hot`:``}">${r(p(e),`NGN`)}</span></div>
          <button class="btn brand sq" data-add="${e.id}" aria-label="Add ${e.title}">＋</button>
        </div>`).join(``)}</div>
      <button class="finder-back" data-again>↻ Try again</button>`,u.querySelectorAll(`[data-add]`).forEach(n=>n.onclick=()=>{let r=f.find(e=>e.id===n.dataset.add),i=r.options.map(e=>`${e.name} ${e.values[0]}`).join(`, `);e.add({id:r.id,qty:1,opt:i,from:``,to:``}),a(n.closest(`.finder-hit`).querySelector(`img`)),t(`${r.title} added`,!0)}),u.querySelector(`[data-again]`).onclick=()=>m(0),i()};m(0),l.showModal(),l.addEventListener(`click`,e=>{e.target===l&&l.close()})}export{c as openFinder};