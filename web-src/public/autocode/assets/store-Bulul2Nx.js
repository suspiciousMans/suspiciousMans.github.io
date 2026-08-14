var ge=Object.defineProperty;var Se=(i,e,t)=>e in i?ge(i,e,{enumerable:!0,configurable:!0,writable:!0,value:t}):i[e]=t;var c=(i,e,t)=>Se(i,typeof e!="symbol"?e+"":e,t);import{c as ke,a as ye,l as X,d as be}from"./Dock-DQToxM1Z.js";import{J as we,d as Ee,A as Ce,e as ne,f as xe,h as Ie,l as Te,E as Ae,i as Me,j as Re,s as Le}from"./Sound-CXK0kihV.js";import{T as $e}from"./Text-CMg41cYS.js";import{l as G,s as Pe}from"./Warehouse-Bn_cejO5.js";import"./CanvasPool-8td293LM.js";import"./canvasUtils-C8_brHhr.js";import"./BatchableSprite-qOYjpB38.js";import"./getPo2TextureFromSource-CzhtZTC9.js";const _e=6,ie=60,Oe=.06,Ne=40,ve=.05,A=["ore","ice","crystal"],D={ore:3,ice:4,crystal:8},Be=50,je=20,Fe=.06,We=.5,De=1.5;function Ue(){return{product:null,freshness:0}}class ze{constructor(e={},t=Math.random){c(this,"shelf");c(this,"customer",null);c(this,"pendingShipment",null);c(this,"catalog",null);c(this,"market",{prices:{...D}});c(this,"balance",0);c(this,"served",0);c(this,"missed",0);c(this,"wasted",0);c(this,"customerPatienceRemaining",0);c(this,"customersEnabled",!1);c(this,"shipmentsEnabled",!1);c(this,"marketEnabled",!1);c(this,"ticksSinceMarketUpdate",0);c(this,"listeners",[]);c(this,"random");this.random=t,this.shelf=[],this.configure(e)}onEvent(e){this.listeners.push(e)}emit(e){for(const t of this.listeners)t(e)}configure(e={}){const t=e.shelfSize??_e;if(this.shelf=Array.from({length:t},Ue),(e.prestock??[]).forEach((o,n)=>{this.shelf[n]&&(this.shelf[n]={product:o,freshness:ie})}),this.customersEnabled=e.customersEnabled??!1,this.shipmentsEnabled=e.shipmentsEnabled??!1,this.marketEnabled=e.marketEnabled??!1,e.catalogEnabled){const o=Math.max(1,Math.floor(t/A.length)),n={};A.forEach((r,d)=>{const f=[];for(let S=0;S<o;S++){const k=d*o+S;k<t&&f.push(k)}n[r]=f}),this.catalog=n}else this.catalog=null;this.market.prices={...D},this.ticksSinceMarketUpdate=0,this.balance=this.marketEnabled?e.initialBalance??Be:0,this.customer=null,this.pendingShipment=null,this.customerPatienceRemaining=0,this.served=0,this.missed=0,this.wasted=0}applyIntent(e){var t;if(e.kind==="place"){const o=this.shelf[e.slotIndex];if(!o){this.emit({type:"error",message:`No such slot: ${e.slotIndex}.`});return}if(o.product!==null){this.emit({type:"error",message:"Can't place — slot isn't empty."});return}const n=((t=this.pendingShipment)==null?void 0:t.product)===e.product;if(this.marketEnabled&&n){const r=this.market.prices[e.product];if(this.balance<r){this.emit({type:"error",message:`Not enough cash — ${e.product} costs $${r.toFixed(2)}, you have $${this.balance.toFixed(2)}.`});return}this.balance=Math.round((this.balance-r)*100)/100}o.product=e.product,o.freshness=ie,this.emit({type:"placed",slotIndex:e.slotIndex,product:e.product}),n&&(this.pendingShipment=null);return}if(e.kind==="sell"){const o=this.shelf[e.slotIndex];if(!o||!o.product){this.emit({type:"error",message:"Nothing there to sell."});return}if(!this.customer){this.emit({type:"error",message:"No customer waiting."});return}if(o.product!==this.customer.product){this.emit({type:"error",message:"That's not what the customer wants."});return}const n=o.product;o.product=null,o.freshness=0,this.served+=1;let r=0;this.marketEnabled&&(r=this.market.prices[n],this.balance=Math.round((this.balance+r)*100)/100),this.emit({type:"sold",slotIndex:e.slotIndex,product:n,earnings:r}),this.customer=null,this.customerPatienceRemaining=0;return}if(e.kind==="swap"){const o=this.shelf[e.slotIndexA],n=this.shelf[e.slotIndexB];if(!o||!n){this.emit({type:"error",message:"No such slot to swap."});return}const r={...o};this.shelf[e.slotIndexA]={...n},this.shelf[e.slotIndexB]=r,this.emit({type:"swapped",slotIndexA:e.slotIndexA,slotIndexB:e.slotIndexB});return}if(!this.pendingShipment){this.emit({type:"error",message:"No shipment to reject."});return}this.emit({type:"shipmentRejected",product:this.pendingShipment.product}),this.pendingShipment=null}offerShipment(e){return this.pendingShipment?!1:(this.pendingShipment={product:e},this.emit({type:"shipmentArrived",product:e}),!0)}step(e){for(let t=0;t<this.shelf.length;t++){const o=this.shelf[t];o.product&&(o.freshness-=1,o.freshness<=0&&(this.emit({type:"spoiled",slotIndex:t,product:o.product}),this.wasted+=1,o.product=null,o.freshness=0))}if(this.customersEnabled){if(this.customer)this.customerPatienceRemaining-=1,this.customerPatienceRemaining<=0&&(this.emit({type:"customerLeft",product:this.customer.product}),this.missed+=1,this.customer=null);else if(this.random()<Oe){const t=A[Math.floor(this.random()*A.length)];this.customer={product:t},this.customerPatienceRemaining=Ne,this.emit({type:"customerArrived",product:t})}}if(this.shipmentsEnabled&&!this.pendingShipment&&this.random()<ve){const t=A[Math.floor(this.random()*A.length)];this.pendingShipment={product:t},this.emit({type:"shipmentArrived",product:t})}if(this.marketEnabled&&(this.ticksSinceMarketUpdate+=1,this.ticksSinceMarketUpdate>=je)){this.ticksSinceMarketUpdate=0;for(const t of A){const o=(this.random()*2-1)*Fe,n=this.market.prices[t]*(1+o),r=D[t]*We,d=D[t]*De;this.market.prices[t]=Math.round(Math.min(d,Math.max(r,n))*100)/100}}}}const M=70,P=80,re=14,He={ore:11569512,ice:12577008,crystal:13215984},Ke=1974568,Xe=3817544;class V{constructor(e,t){c(this,"app");c(this,"world");c(this,"layer");c(this,"juice",new we);this.app=e,this.world=t,this.layer=new Ee,this.app.stage.addChild(this.layer),this.app.stage.addChild(this.juice.localContainer),this.app.stage.addChild(this.juice.screenContainer),this.recenter(),this.app.renderer.on("resize",()=>this.recenter())}static async mount(e,t){const o=new Ce;return await o.init({resizeTo:e,background:1316634,antialias:!0}),e.appendChild(o.canvas),new V(o,t)}recenter(){this.layer.position.set(this.app.screen.width/2,this.app.screen.height/2),this.juice.localContainer.position.copyFrom(this.layer.position)}slotX(e){const t=this.world.shelf.length;return-(t*M+(t-1)*re)/2+e*(M+re)}burstAtSlot(e,t){e<0||e>=this.world.shelf.length||this.juice.burst(this.slotX(e)+M/2,0,t)}flash(e){this.juice.flash(e,this.app.screen.width,this.app.screen.height)}render(){this.juice.update(),this.layer.removeChildren();const e=this.world.shelf.length;for(let o=0;o<e;o++){const n=this.world.shelf[o],r=this.slotX(o),d=n.product?He[n.product]:Ke,f=new ne().roundRect(0,0,M,P,4).fill(d).stroke({width:1.5,color:Xe});if(f.position.set(r,-P/2),this.layer.addChild(f),this.layer.addChild(this.label(String(o),r+M/2,P/2+6)),n.product){this.layer.addChild(this.label(n.product,r+M/2,-P/2-14,1316634));const S=n.freshness/60,k=this.freshnessBar(S);k.position.set(r+6,P/2-12),this.layer.addChild(k)}}const t=-P/2-50;this.world.customer&&this.layer.addChild(this.label(`Customer wants: ${this.world.customer.product}`,0,t,15132390)),this.world.pendingShipment&&this.layer.addChild(this.label(`Shipment waiting: ${this.world.pendingShipment.product}`,0,t-20,8037065))}freshnessBar(e){const t=M-12,o=4,n=Math.max(0,Math.min(1,e)),r=n<.3?14242639:n<.6?14263871:5220569,d=new ne;return d.rect(0,0,t,o).fill(855825),d.rect(0,0,t*n,o).fill(r),d}label(e,t,o,n=8950176){const r=new $e({text:e,style:{fontFamily:"monospace",fontSize:11,fill:n}});return r.anchor.set(.5,0),r.position.set(t,o),r}}class Ge{constructor(e,t,o){c(this,"panel");c(this,"rows",new Map);c(this,"lastPrice",new Map);c(this,"visible",!1);this.panel=document.createElement("div"),this.panel.className="market-panel",this.panel.style.display="none";const n=document.createElement("div");n.className="market-panel-header";const r=document.createElement("span");r.textContent=t;const d=document.createElement("button");d.className="market-panel-close",d.textContent="×",d.setAttribute("aria-label","Close market"),d.addEventListener("click",()=>this.close()),n.appendChild(r),n.appendChild(d),this.panel.appendChild(n);const f=document.createElement("table");f.className="market-table";const S=document.createElement("thead"),k=document.createElement("tr");for(const L of["Product","Price","Δ","On shelf"]){const g=document.createElement("th");g.textContent=L,k.appendChild(g)}S.appendChild(k),f.appendChild(S);const F=document.createElement("tbody");for(const L of o){const g=document.createElement("tr"),_=document.createElement("td");_.textContent=L,_.className="market-cell-name";const O=document.createElement("td");O.className="market-cell-num";const N=document.createElement("td");N.className="market-cell-num";const w=document.createElement("td");w.className="market-cell-num",g.appendChild(_),g.appendChild(O),g.appendChild(N),g.appendChild(w),F.appendChild(g),this.rows.set(L,{tr:g,priceCell:O,changeCell:N,stockCell:w})}f.appendChild(F),this.panel.appendChild(f),e.appendChild(this.panel)}update(e){for(const[t,o]of this.rows){const n=e[t];if(!n)continue;const r=this.lastPrice.get(t),d=r===void 0?0:n.price-r;this.lastPrice.set(t,n.price),o.priceCell.textContent=`$${n.price.toFixed(2)}`,o.changeCell.textContent=d===0?"—":`${d>0?"+":""}${d.toFixed(2)}`,o.changeCell.classList.toggle("market-up",d>0),o.changeCell.classList.toggle("market-down",d<0),o.stockCell.textContent=String(n.stock)}}toggle(){this.visible?this.close():this.open()}open(){this.visible=!0,this.panel.style.display="flex"}close(){this.visible=!1,this.panel.style.display="none"}}const Ve=1500,Je=200;class Ye{constructor(e){c(this,"worker");c(this,"callbacks");c(this,"ready",!1);c(this,"awaitingTick",!1);c(this,"watchdog",null);this.callbacks=e,this.worker=this.spawnWorker()}spawnWorker(){const e=new Worker(new URL("/autocode/assets/storeSandbox.worker-DrM2mIRd.js",import.meta.url),{type:"module"});return e.addEventListener("message",t=>this.handleMessage(t)),e}handleMessage(e){const t=e.data;t.type==="intent"?this.callbacks.onIntent(t.intent):t.type==="log"?this.callbacks.onLog(t.message):t.type==="error"?this.callbacks.onError(t.message):t.type==="loaded"?this.ready=!0:t.type==="tickDone"?this.clearWatchdog():t.type==="done"&&this.finishRun()}clearWatchdog(){this.awaitingTick=!1,this.watchdog!==null&&(window.clearTimeout(this.watchdog),this.watchdog=null)}finishRun(){var e,t;this.clearWatchdog(),(t=(e=this.callbacks).onDone)==null||t.call(e)}run(e){this.watchdog=window.setTimeout(()=>{this.watchdog=null,this.callbacks.onError("Script exceeded its time budget and was stopped — check for an infinite loop."),this.worker.terminate(),this.worker=this.spawnWorker()},Ve),this.worker.postMessage({type:"run",code:e})}load(e){this.ready=!1,this.worker.postMessage({type:"load",code:e})}tick(e){!this.ready||this.awaitingTick||(this.awaitingTick=!0,this.watchdog=window.setTimeout(()=>{this.callbacks.onError("Script took too long on a tick and was stopped — check for an infinite loop."),this.worker.terminate(),this.worker=this.spawnWorker(),this.ready=!1,this.awaitingTick=!1},Je),this.worker.postMessage({type:"tick",...e}))}stop(){this.clearWatchdog(),this.worker.terminate(),this.worker=this.spawnWorker(),this.ready=!1}dispose(){this.clearWatchdog(),this.worker.terminate()}}const qe={id:"S0",title:"S0 — Filling the Shelf",mode:"once",shelfSize:6,checkSuccess:i=>{var e,t,o,n;return((e=i.shelf[0])==null?void 0:e.product)==="ore"&&((t=i.shelf[1])==null?void 0:t.product)==="ice"&&((o=i.shelf[2])==null?void 0:o.product)==="ore"&&((n=i.shelf[3])==null?void 0:n.product)==="crystal"},description:"An array is a fixed number of indexed slots, not a bag of items. Place each crate of mined resources at a specific slot index — in order, exactly once.",starterCode:`// place(slotIndex, product) — each slot is a specific position, not just "somewhere."
place(0, "ore");
place(1, "ice");
place(2, "ore");
place(3, "crystal");
`},Ze={id:"S1",title:"S1 — Finding It Again",mode:"loop",shelfSize:6,customersEnabled:!0,prestock:["ore","ice","ore","crystal"],checkSuccess:i=>i.served>=1,description:"Knowing something is somewhere on the shelf isn't the same as knowing where. When a customer wants something, scan the shelf slot by slot until you find a match — or run out of slots.",starterCode:`// This script runs every tick. Scan the shelf slot by slot for what the customer wants.
if (customer) {
  for (let i = 0; i < shelf.length; i++) {
    if (shelf[i].product === customer.product) {
      sell(i);
      break;
    }
  }
}
`},Qe={id:"S2",title:"S2 — Making Room",mode:"loop",shelfSize:4,customersEnabled:!0,shipmentsEnabled:!0,checkSuccess:i=>i.served>=1,description:"A fixed-size shelf has edges. Shipments now arrive on their own timer — check for an empty slot before accepting one; if the shelf is full, reject it rather than crashing or overwriting.",starterCode:`if (customer) {
  for (let i = 0; i < shelf.length; i++) {
    if (shelf[i].product === customer.product) {
      sell(i);
      break;
    }
  }
}

if (pendingShipment) {
  let emptySlot = -1;
  for (let i = 0; i < shelf.length; i++) {
    if (shelf[i].product === null) {
      emptySlot = i;
      break;
    }
  }
  if (emptySlot >= 0) {
    place(emptySlot, pendingShipment.product);
  } else {
    rejectShipment();
  }
}
`},et={id:"S3",title:"S3 — Look It Up",mode:"loop",shelfSize:9,customersEnabled:!0,shipmentsEnabled:!0,catalogEnabled:!0,marketEnabled:!0,checkSuccess:i=>i.served>=2,description:"The cargo bay is now divided into a section per resource. catalog[product] gives you that section's slot indices directly — a dictionary lookup instead of an if/else chain. Prices fluctuate now too (check the Market panel) — accepting a shipment costs the current price, selling earns it.",starterCode:`if (customer) {
  const section = catalog[customer.product];
  for (const i of section) {
    if (shelf[i].product === customer.product) {
      sell(i);
      break;
    }
  }
}

if (pendingShipment) {
  const section = catalog[pendingShipment.product];
  let emptySlot = -1;
  for (const i of section) {
    if (shelf[i].product === null) {
      emptySlot = i;
      break;
    }
  }
  if (emptySlot >= 0) {
    place(emptySlot, pendingShipment.product);
  } else {
    rejectShipment();
  }
}
`},tt={id:"S4",title:"S4 — Keep It Fresh",mode:"loop",shelfSize:9,customersEnabled:!0,shipmentsEnabled:!0,catalogEnabled:!0,marketEnabled:!0,checkSuccess:i=>i.served>=2&&i.wasted<=1,description:"Sort each section by freshness — most urgent first — so the front of the section is always the next thing that should move. There's no built-in sort() for the shelf: use swap(slotIndexA, slotIndexB) to actually reorder it yourself, a slot at a time.",starterCode:`if (customer) {
  const section = catalog[customer.product];
  for (const i of section) {
    if (shelf[i].product === customer.product) {
      sell(i);
      break;
    }
  }
}

if (pendingShipment) {
  const section = catalog[pendingShipment.product];
  let emptySlot = -1;
  for (const i of section) {
    if (shelf[i].product === null) {
      emptySlot = i;
      break;
    }
  }
  if (emptySlot >= 0) {
    place(emptySlot, pendingShipment.product);
  } else {
    rejectShipment();
  }
}

// Keep each section sorted by freshness (most urgent first) using swaps.
for (const product in catalog) {
  const section = catalog[product];
  for (let i = 0; i < section.length - 1; i++) {
    const a = shelf[section[i]];
    const b = shelf[section[i + 1]];
    if (a.product && b.product && a.freshness > b.freshness) {
      swap(section[i], section[i + 1]);
    }
  }
}
`},st={id:"S5",title:"S5 — Cut to the Chase",mode:"loop",shelfSize:9,customersEnabled:!0,shipmentsEnabled:!0,catalogEnabled:!0,marketEnabled:!0,checkSuccess:i=>i.served>=2,description:`Because each section is kept sorted by freshness (S4), you can answer "how many are expiring soon?" with binary search instead of checking every slot — jump to the middle, narrow, repeat. That only works because it's sorted.`,starterCode:`if (customer) {
  const section = catalog[customer.product];
  for (const i of section) {
    if (shelf[i].product === customer.product) {
      sell(i);
      break;
    }
  }
}

if (pendingShipment) {
  const section = catalog[pendingShipment.product];
  let emptySlot = -1;
  for (const i of section) {
    if (shelf[i].product === null) {
      emptySlot = i;
      break;
    }
  }
  if (emptySlot >= 0) {
    place(emptySlot, pendingShipment.product);
  } else {
    rejectShipment();
  }
}

for (const product in catalog) {
  const section = catalog[product];
  for (let i = 0; i < section.length - 1; i++) {
    const a = shelf[section[i]];
    const b = shelf[section[i + 1]];
    if (a.product && b.product && a.freshness > b.freshness) {
      swap(section[i], section[i + 1]);
    }
  }
}

// Binary search: how many ore items are expiring soon (freshness < 20)?
// Only works because the section is already sorted ascending by freshness.
const oreSection = catalog["ore"].filter((i) => shelf[i].product !== null);
let lo = 0;
let hi = oreSection.length;
while (lo < hi) {
  const mid = Math.floor((lo + hi) / 2);
  if (shelf[oreSection[mid]].freshness < 20) {
    lo = mid + 1;
  } else {
    hi = mid;
  }
}
if (lo > 0) console.log(lo + " ore item(s) expiring soon.");
`},ot={id:"S-CAP",title:"Capstone — Run the Whole Store",mode:"loop",shelfSize:12,customersEnabled:!0,shipmentsEnabled:!0,catalogEnabled:!0,marketEnabled:!0,checkSuccess:i=>i.served>=8&&i.wasted<=3,description:"Everything so far, at scale: route shipments and sales through the catalog, keep every section sorted by freshness, and watch the market — accept shipments when prices are low, sell when they're high. Left running unattended.",starterCode:`function tendSection(product) {
  const section = catalog[product];

  if (customer && customer.product === product) {
    for (const i of section) {
      if (shelf[i].product === product) {
        sell(i);
        break;
      }
    }
  }

  for (let i = 0; i < section.length - 1; i++) {
    const a = shelf[section[i]];
    const b = shelf[section[i + 1]];
    if (a.product && b.product && a.freshness > b.freshness) {
      swap(section[i], section[i + 1]);
    }
  }
}

for (const product in catalog) {
  tendSection(product);
}

if (pendingShipment) {
  const section = catalog[pendingShipment.product];
  let emptySlot = -1;
  for (const i of section) {
    if (shelf[i].product === null) {
      emptySlot = i;
      break;
    }
  }
  if (emptySlot >= 0) {
    place(emptySlot, pendingShipment.product);
  } else {
    rejectShipment();
  }
}
`},E=[qe,Ze,Qe,et,tt,st,ot],U=["ore","ice","crystal"],nt=4906624,z=15680580,it=4906624,rt=800;function ct(){let i=0;return()=>{const e=performance.now();return e-i<rt?!1:(i=e,!0)}}const at=[{title:"Once mode (S0)",entries:[{signature:'place(slotIndex, product: "ore" | "ice" | "crystal")',description:"Place a product at a specific shelf slot. Errors if the slot isn't empty."}]},{title:"Loop mode (S1+)",entries:[{signature:"shelf",description:"Array of { product, freshness } — one entry per slot."},{signature:"customer",description:"{ product } if someone's waiting, else null."},{signature:"pendingShipment",description:"{ product } if stock is waiting to be accepted, else null."},{signature:"sell(slotIndex)",description:"Sell that slot's contents to the current customer."},{signature:"place(slotIndex, product)",description:"Place a product — same as once mode."},{signature:"rejectShipment()",description:"Turn away the pending shipment instead of accepting it."}]},{title:"Catalog & market (S3+)",entries:[{signature:"catalog[product]",description:"Array of slot indices reserved for that product."},{signature:"market.prices[product]",description:"Current fluctuating price."},{signature:"market.balance",description:"Cash on hand — shipments cost it, sales earn it."}]},{title:"Sorting (S4+)",entries:[{signature:"swap(slotIndexA, slotIndexB)",description:"Swap two slots' contents — the only way to reorder the shelf. No built-in sort()."}]},{title:"Everywhere",entries:[{signature:"console.log(...)",description:"Prints to the console panel."}]}];function h(i){const e=document.querySelector(i);if(!e)throw new Error(`Missing element: ${i}`);return e}function R(i,e){return i.mode==="loop"?i[e]??!1:!1}async function lt(){const i=h("#world-panel"),e=h("#editor-host"),t=h("#console-host"),o=h("#challenge-select"),n=h("#tick-display b"),r=h("#stats-badge"),d=h("#stat-balance"),f=h("#stat-served"),S=h("#stat-missed"),k=h("#stat-wasted"),F=h("#script-dot"),L=h("#script-name"),g=h("#run-btn"),_=h("#stop-btn"),O=h("#docs-btn"),N=h("#market-btn"),w=h("#credits-display"),ce=h("#stat-warehouse"),J=h("#mute-btn"),ae=h("#status-panel"),le=h("#dock-root"),de=h("#layout-picker-host"),he=ke("store",le,[{id:"world",title:"World",element:i},{id:"status",title:"Status",element:ae,minimumHeight:300},{id:"editor",title:"Editor",element:e},{id:"console",title:"Console",element:t}]);de.appendChild(ye(he));const pe=new xe(document.body,"Store API",at);O.addEventListener("click",()=>pe.toggle());const Y=new Ge(document.body,"Market",U);N.addEventListener("click",()=>Y.toggle());const C=new Ie,H=ct();function q(){J.textContent=C.isMuted?"🔇":"🔊"}q(),J.addEventListener("click",()=>{C.toggleMute(),q()});const x=X();w.textContent=`$${x.credits.toFixed(2)}`;let W=0;function ue(){if(u.mode!=="loop"||!R(u,"marketEnabled"))return;const s=Math.round((l.balance-W)*100)/100;s!==0&&(x.credits=be(s),W=l.balance,w.textContent=`$${x.credits.toFixed(2)}`)}const v=Te(),Z=new Map;for(const s of E){const a=document.createElement("option");a.value=s.id,o.appendChild(a),Z.set(s.id,a)}function Q(){E.forEach((s,a)=>{const y=Z.get(s.id);if(!y)return;const j=a>0&&!v.has(E[a-1].id);y.disabled=j;const m=v.has(s.id)?"✓ ":j?"🔒 ":"";y.textContent=`${m}${s.title}`})}Q();const l=new ze({shelfSize:E[0].shelfSize}),I=await V.mount(i,l),p=new Me(t),K=new Ae(e,E[0].starterCode);let u=E[0],T=!1,$=[],b=null;window.addEventListener("storage",()=>{const s=X().credits;x.credits=s,w.textContent=`$${s.toFixed(2)}`,!(u.mode!=="loop"||!R(u,"marketEnabled"))&&s!==l.balance&&(l.balance=s,W=s)});function me(){var s;v.has(u.id)||(s=u.checkSuccess)!=null&&s.call(u,l)&&(v.add(u.id),Le(v),Q(),p.success(`✓ ${u.title} complete!`),C.success(),I.flash(it))}l.onEvent(s=>{if(s.type==="placed"){if(p.log(`Placed ${s.product} at slot ${s.slotIndex}.`),b===s.product){const a=G();a[s.product]=Math.max(0,a[s.product]-1),Pe(a),b=null}}else if(s.type==="sold"){const a=s.earnings>0?` ($${s.earnings.toFixed(2)})`:"";p.success(`Sold ${s.product} from slot ${s.slotIndex}${a}! 🛒`),C.success(),I.burstAtSlot(s.slotIndex,nt)}else if(s.type==="swapped")p.log(`Swapped slots ${s.slotIndexA} and ${s.slotIndexB}.`);else if(s.type==="customerArrived")p.info(`Customer wants ${s.product}.`);else if(s.type==="customerLeft")p.error(`A customer left unhappy — wanted ${s.product}.`);else if(s.type==="shipmentArrived"){const a=b===s.product?" (from the warehouse)":"";p.log(`Shipment arrived: ${s.product}${a}.`)}else s.type==="shipmentRejected"?(p.info(`Rejected a shipment of ${s.product}.`),b===s.product&&(b=null)):s.type==="spoiled"?(p.error(`${s.product} spoiled at slot ${s.slotIndex}. 💀`),H()&&(C.error(),I.burstAtSlot(s.slotIndex,z),I.flash(z))):s.type==="error"&&(p.error(s.message),H()&&(C.error(),I.flash(z)))});function fe(){if(!R(u,"marketEnabled")||l.pendingShipment)return;const s=G(),a=U.find(y=>s[y]>0);a&&(b=a,l.offerShipment(a)||(b=null))}const B=new Ye({onIntent:s=>{u.mode==="once"?$.push(s):l.applyIntent(s)},onLog:s=>p.log(s),onError:s=>{p.error(s),H()&&(C.error(),I.flash(z))},onDone:()=>{for(const s of $)l.applyIntent(s);p.info(`Script finished — applied ${$.length} action(s).`),$=[]}});function ee(){d.textContent=`$${l.balance.toFixed(2)}`,f.textContent=String(l.served),S.textContent=String(l.missed),k.textContent=String(l.wasted),r.textContent=`${l.served} served`,F.classList.toggle("running",T),L.textContent=T?"pilot.js":"idle";const s={};for(const m of l.shelf)m.product&&(s[m.product]=(s[m.product]??0)+1);const a={};for(const m of U)a[m]={price:l.market.prices[m],stock:s[m]??0};Y.update(a),ue();const y=G(),j=U.filter(m=>y[m]>0).map(m=>`${m}:${y[m]}`);ce.textContent=j.length>0?j.join("  "):"—",me()}const te=new Re(l,()=>{I.render(),ee(),n.textContent=String(te.currentTick)},()=>{fe(),T&&u.mode==="loop"&&B.tick({shelf:l.shelf,customer:l.customer,pendingShipment:l.pendingShipment,catalog:l.catalog,prices:l.market.prices,balance:l.balance})});function se(s){x.credits=X().credits,l.configure({shelfSize:s.shelfSize,customersEnabled:R(s,"customersEnabled"),shipmentsEnabled:R(s,"shipmentsEnabled"),catalogEnabled:R(s,"catalogEnabled"),marketEnabled:R(s,"marketEnabled"),prestock:s.mode==="loop"?s.prestock:void 0,initialBalance:x.credits}),W=l.balance,w.textContent=`$${x.credits.toFixed(2)}`}function oe(s){const a=E.find(y=>y.id===s);a&&(u=a,T=!1,$=[],b=null,B.stop(),se(a),K.setCode(a.starterCode),o.value=a.id,p.clear(),p.info(a.description),ee())}o.addEventListener("change",()=>oe(o.value)),g.addEventListener("click",()=>{p.clear(),p.info(u.description),se(u),$=[],b=null,u.mode==="once"?(T=!1,B.run(K.getCode())):(T=!0,B.load(K.getCode()),p.info("Script loaded — running every tick."))}),_.addEventListener("click",()=>{T=!1,B.stop(),p.info("Stopped.")}),oe(E[0].id),te.start()}lt().catch(i=>{console.error(i),document.body.innerHTML=`<pre style="color:#ef4444;padding:2rem;">${String(i)}</pre>`});
