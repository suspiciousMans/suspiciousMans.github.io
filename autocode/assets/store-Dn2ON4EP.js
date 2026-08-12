var pe=Object.defineProperty;var ue=(i,e,s)=>e in i?pe(i,e,{enumerable:!0,configurable:!0,writable:!0,value:s}):i[e]=s;var c=(i,e,s)=>ue(i,typeof e!="symbol"?e+"":e,s);import{l as X,d as me}from"./PlayerProfile-BhU5pp6a.js";import{J as fe,d as ge,A as Se,e as ne,f as ke,h as ye,l as be,E as we,i as Ee,j as Ce,s as xe}from"./Sound-CXK0kihV.js";import{T as Ie}from"./Text-CMg41cYS.js";import{l as G,s as Te}from"./Warehouse-Bn_cejO5.js";import"./CanvasPool-8td293LM.js";import"./canvasUtils-C8_brHhr.js";import"./BatchableSprite-qOYjpB38.js";import"./getPo2TextureFromSource-CzhtZTC9.js";const Ae=6,ie=60,Me=.06,Re=40,Le=.05,A=["ore","ice","crystal"],D={ore:3,ice:4,crystal:8},$e=50,_e=20,Pe=.06,Oe=.5,Ne=1.5;function ve(){return{product:null,freshness:0}}class Be{constructor(e={},s=Math.random){c(this,"shelf");c(this,"customer",null);c(this,"pendingShipment",null);c(this,"catalog",null);c(this,"market",{prices:{...D}});c(this,"balance",0);c(this,"served",0);c(this,"missed",0);c(this,"wasted",0);c(this,"customerPatienceRemaining",0);c(this,"customersEnabled",!1);c(this,"shipmentsEnabled",!1);c(this,"marketEnabled",!1);c(this,"ticksSinceMarketUpdate",0);c(this,"listeners",[]);c(this,"random");this.random=s,this.shelf=[],this.configure(e)}onEvent(e){this.listeners.push(e)}emit(e){for(const s of this.listeners)s(e)}configure(e={}){const s=e.shelfSize??Ae;if(this.shelf=Array.from({length:s},ve),(e.prestock??[]).forEach((o,n)=>{this.shelf[n]&&(this.shelf[n]={product:o,freshness:ie})}),this.customersEnabled=e.customersEnabled??!1,this.shipmentsEnabled=e.shipmentsEnabled??!1,this.marketEnabled=e.marketEnabled??!1,e.catalogEnabled){const o=Math.max(1,Math.floor(s/A.length)),n={};A.forEach((r,d)=>{const f=[];for(let S=0;S<o;S++){const k=d*o+S;k<s&&f.push(k)}n[r]=f}),this.catalog=n}else this.catalog=null;this.market.prices={...D},this.ticksSinceMarketUpdate=0,this.balance=this.marketEnabled?e.initialBalance??$e:0,this.customer=null,this.pendingShipment=null,this.customerPatienceRemaining=0,this.served=0,this.missed=0,this.wasted=0}applyIntent(e){var s;if(e.kind==="place"){const o=this.shelf[e.slotIndex];if(!o){this.emit({type:"error",message:`No such slot: ${e.slotIndex}.`});return}if(o.product!==null){this.emit({type:"error",message:"Can't place — slot isn't empty."});return}const n=((s=this.pendingShipment)==null?void 0:s.product)===e.product;if(this.marketEnabled&&n){const r=this.market.prices[e.product];if(this.balance<r){this.emit({type:"error",message:`Not enough cash — ${e.product} costs $${r.toFixed(2)}, you have $${this.balance.toFixed(2)}.`});return}this.balance=Math.round((this.balance-r)*100)/100}o.product=e.product,o.freshness=ie,this.emit({type:"placed",slotIndex:e.slotIndex,product:e.product}),n&&(this.pendingShipment=null);return}if(e.kind==="sell"){const o=this.shelf[e.slotIndex];if(!o||!o.product){this.emit({type:"error",message:"Nothing there to sell."});return}if(!this.customer){this.emit({type:"error",message:"No customer waiting."});return}if(o.product!==this.customer.product){this.emit({type:"error",message:"That's not what the customer wants."});return}const n=o.product;o.product=null,o.freshness=0,this.served+=1;let r=0;this.marketEnabled&&(r=this.market.prices[n],this.balance=Math.round((this.balance+r)*100)/100),this.emit({type:"sold",slotIndex:e.slotIndex,product:n,earnings:r}),this.customer=null,this.customerPatienceRemaining=0;return}if(e.kind==="swap"){const o=this.shelf[e.slotIndexA],n=this.shelf[e.slotIndexB];if(!o||!n){this.emit({type:"error",message:"No such slot to swap."});return}const r={...o};this.shelf[e.slotIndexA]={...n},this.shelf[e.slotIndexB]=r,this.emit({type:"swapped",slotIndexA:e.slotIndexA,slotIndexB:e.slotIndexB});return}if(!this.pendingShipment){this.emit({type:"error",message:"No shipment to reject."});return}this.emit({type:"shipmentRejected",product:this.pendingShipment.product}),this.pendingShipment=null}offerShipment(e){return this.pendingShipment?!1:(this.pendingShipment={product:e},this.emit({type:"shipmentArrived",product:e}),!0)}step(e){for(let s=0;s<this.shelf.length;s++){const o=this.shelf[s];o.product&&(o.freshness-=1,o.freshness<=0&&(this.emit({type:"spoiled",slotIndex:s,product:o.product}),this.wasted+=1,o.product=null,o.freshness=0))}if(this.customersEnabled){if(this.customer)this.customerPatienceRemaining-=1,this.customerPatienceRemaining<=0&&(this.emit({type:"customerLeft",product:this.customer.product}),this.missed+=1,this.customer=null);else if(this.random()<Me){const s=A[Math.floor(this.random()*A.length)];this.customer={product:s},this.customerPatienceRemaining=Re,this.emit({type:"customerArrived",product:s})}}if(this.shipmentsEnabled&&!this.pendingShipment&&this.random()<Le){const s=A[Math.floor(this.random()*A.length)];this.pendingShipment={product:s},this.emit({type:"shipmentArrived",product:s})}if(this.marketEnabled&&(this.ticksSinceMarketUpdate+=1,this.ticksSinceMarketUpdate>=_e)){this.ticksSinceMarketUpdate=0;for(const s of A){const o=(this.random()*2-1)*Pe,n=this.market.prices[s]*(1+o),r=D[s]*Oe,d=D[s]*Ne;this.market.prices[s]=Math.round(Math.min(d,Math.max(r,n))*100)/100}}}}const M=70,_=80,re=14,je={ore:11569512,ice:12577008,crystal:13215984},Fe=1974568,We=3817544;class V{constructor(e,s){c(this,"app");c(this,"world");c(this,"layer");c(this,"juice",new fe);this.app=e,this.world=s,this.layer=new ge,this.app.stage.addChild(this.layer),this.app.stage.addChild(this.juice.localContainer),this.app.stage.addChild(this.juice.screenContainer),this.recenter(),this.app.renderer.on("resize",()=>this.recenter())}static async mount(e,s){const o=new Se;return await o.init({resizeTo:e,background:1316634,antialias:!0}),e.appendChild(o.canvas),new V(o,s)}recenter(){this.layer.position.set(this.app.screen.width/2,this.app.screen.height/2),this.juice.localContainer.position.copyFrom(this.layer.position)}slotX(e){const s=this.world.shelf.length;return-(s*M+(s-1)*re)/2+e*(M+re)}burstAtSlot(e,s){e<0||e>=this.world.shelf.length||this.juice.burst(this.slotX(e)+M/2,0,s)}flash(e){this.juice.flash(e,this.app.screen.width,this.app.screen.height)}render(){this.juice.update(),this.layer.removeChildren();const e=this.world.shelf.length;for(let o=0;o<e;o++){const n=this.world.shelf[o],r=this.slotX(o),d=n.product?je[n.product]:Fe,f=new ne().roundRect(0,0,M,_,4).fill(d).stroke({width:1.5,color:We});if(f.position.set(r,-_/2),this.layer.addChild(f),this.layer.addChild(this.label(String(o),r+M/2,_/2+6)),n.product){this.layer.addChild(this.label(n.product,r+M/2,-_/2-14,1316634));const S=n.freshness/60,k=this.freshnessBar(S);k.position.set(r+6,_/2-12),this.layer.addChild(k)}}const s=-_/2-50;this.world.customer&&this.layer.addChild(this.label(`Customer wants: ${this.world.customer.product}`,0,s,15132390)),this.world.pendingShipment&&this.layer.addChild(this.label(`Shipment waiting: ${this.world.pendingShipment.product}`,0,s-20,8037065))}freshnessBar(e){const s=M-12,o=4,n=Math.max(0,Math.min(1,e)),r=n<.3?14242639:n<.6?14263871:5220569,d=new ne;return d.rect(0,0,s,o).fill(855825),d.rect(0,0,s*n,o).fill(r),d}label(e,s,o,n=8950176){const r=new Ie({text:e,style:{fontFamily:"monospace",fontSize:11,fill:n}});return r.anchor.set(.5,0),r.position.set(s,o),r}}class De{constructor(e,s,o){c(this,"panel");c(this,"rows",new Map);c(this,"lastPrice",new Map);c(this,"visible",!1);this.panel=document.createElement("div"),this.panel.className="market-panel",this.panel.style.display="none";const n=document.createElement("div");n.className="market-panel-header";const r=document.createElement("span");r.textContent=s;const d=document.createElement("button");d.className="market-panel-close",d.textContent="×",d.setAttribute("aria-label","Close market"),d.addEventListener("click",()=>this.close()),n.appendChild(r),n.appendChild(d),this.panel.appendChild(n);const f=document.createElement("table");f.className="market-table";const S=document.createElement("thead"),k=document.createElement("tr");for(const L of["Product","Price","Δ","On shelf"]){const g=document.createElement("th");g.textContent=L,k.appendChild(g)}S.appendChild(k),f.appendChild(S);const F=document.createElement("tbody");for(const L of o){const g=document.createElement("tr"),P=document.createElement("td");P.textContent=L,P.className="market-cell-name";const O=document.createElement("td");O.className="market-cell-num";const N=document.createElement("td");N.className="market-cell-num";const w=document.createElement("td");w.className="market-cell-num",g.appendChild(P),g.appendChild(O),g.appendChild(N),g.appendChild(w),F.appendChild(g),this.rows.set(L,{tr:g,priceCell:O,changeCell:N,stockCell:w})}f.appendChild(F),this.panel.appendChild(f),e.appendChild(this.panel)}update(e){for(const[s,o]of this.rows){const n=e[s];if(!n)continue;const r=this.lastPrice.get(s),d=r===void 0?0:n.price-r;this.lastPrice.set(s,n.price),o.priceCell.textContent=`$${n.price.toFixed(2)}`,o.changeCell.textContent=d===0?"—":`${d>0?"+":""}${d.toFixed(2)}`,o.changeCell.classList.toggle("market-up",d>0),o.changeCell.classList.toggle("market-down",d<0),o.stockCell.textContent=String(n.stock)}}toggle(){this.visible?this.close():this.open()}open(){this.visible=!0,this.panel.style.display="flex"}close(){this.visible=!1,this.panel.style.display="none"}}const Ue=1500,ze=200;class He{constructor(e){c(this,"worker");c(this,"callbacks");c(this,"ready",!1);c(this,"awaitingTick",!1);c(this,"watchdog",null);this.callbacks=e,this.worker=this.spawnWorker()}spawnWorker(){const e=new Worker(new URL("/autocode/assets/storeSandbox.worker-DrM2mIRd.js",import.meta.url),{type:"module"});return e.addEventListener("message",s=>this.handleMessage(s)),e}handleMessage(e){const s=e.data;s.type==="intent"?this.callbacks.onIntent(s.intent):s.type==="log"?this.callbacks.onLog(s.message):s.type==="error"?this.callbacks.onError(s.message):s.type==="loaded"?this.ready=!0:s.type==="tickDone"?this.clearWatchdog():s.type==="done"&&this.finishRun()}clearWatchdog(){this.awaitingTick=!1,this.watchdog!==null&&(window.clearTimeout(this.watchdog),this.watchdog=null)}finishRun(){var e,s;this.clearWatchdog(),(s=(e=this.callbacks).onDone)==null||s.call(e)}run(e){this.watchdog=window.setTimeout(()=>{this.watchdog=null,this.callbacks.onError("Script exceeded its time budget and was stopped — check for an infinite loop."),this.worker.terminate(),this.worker=this.spawnWorker()},Ue),this.worker.postMessage({type:"run",code:e})}load(e){this.ready=!1,this.worker.postMessage({type:"load",code:e})}tick(e){!this.ready||this.awaitingTick||(this.awaitingTick=!0,this.watchdog=window.setTimeout(()=>{this.callbacks.onError("Script took too long on a tick and was stopped — check for an infinite loop."),this.worker.terminate(),this.worker=this.spawnWorker(),this.ready=!1,this.awaitingTick=!1},ze),this.worker.postMessage({type:"tick",...e}))}stop(){this.clearWatchdog(),this.worker.terminate(),this.worker=this.spawnWorker(),this.ready=!1}dispose(){this.clearWatchdog(),this.worker.terminate()}}const Ke={id:"S0",title:"S0 — Filling the Shelf",mode:"once",shelfSize:6,checkSuccess:i=>{var e,s,o,n;return((e=i.shelf[0])==null?void 0:e.product)==="ore"&&((s=i.shelf[1])==null?void 0:s.product)==="ice"&&((o=i.shelf[2])==null?void 0:o.product)==="ore"&&((n=i.shelf[3])==null?void 0:n.product)==="crystal"},description:"An array is a fixed number of indexed slots, not a bag of items. Place each crate of mined resources at a specific slot index — in order, exactly once.",starterCode:`// place(slotIndex, product) — each slot is a specific position, not just "somewhere."
place(0, "ore");
place(1, "ice");
place(2, "ore");
place(3, "crystal");
`},Xe={id:"S1",title:"S1 — Finding It Again",mode:"loop",shelfSize:6,customersEnabled:!0,prestock:["ore","ice","ore","crystal"],checkSuccess:i=>i.served>=1,description:"Knowing something is somewhere on the shelf isn't the same as knowing where. When a customer wants something, scan the shelf slot by slot until you find a match — or run out of slots.",starterCode:`// This script runs every tick. Scan the shelf slot by slot for what the customer wants.
if (customer) {
  for (let i = 0; i < shelf.length; i++) {
    if (shelf[i].product === customer.product) {
      sell(i);
      break;
    }
  }
}
`},Ge={id:"S2",title:"S2 — Making Room",mode:"loop",shelfSize:4,customersEnabled:!0,shipmentsEnabled:!0,checkSuccess:i=>i.served>=1,description:"A fixed-size shelf has edges. Shipments now arrive on their own timer — check for an empty slot before accepting one; if the shelf is full, reject it rather than crashing or overwriting.",starterCode:`if (customer) {
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
`},Ve={id:"S3",title:"S3 — Look It Up",mode:"loop",shelfSize:9,customersEnabled:!0,shipmentsEnabled:!0,catalogEnabled:!0,marketEnabled:!0,checkSuccess:i=>i.served>=2,description:"The cargo bay is now divided into a section per resource. catalog[product] gives you that section's slot indices directly — a dictionary lookup instead of an if/else chain. Prices fluctuate now too (check the Market panel) — accepting a shipment costs the current price, selling earns it.",starterCode:`if (customer) {
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
`},Je={id:"S4",title:"S4 — Keep It Fresh",mode:"loop",shelfSize:9,customersEnabled:!0,shipmentsEnabled:!0,catalogEnabled:!0,marketEnabled:!0,checkSuccess:i=>i.served>=2&&i.wasted<=1,description:"Sort each section by freshness — most urgent first — so the front of the section is always the next thing that should move. There's no built-in sort() for the shelf: use swap(slotIndexA, slotIndexB) to actually reorder it yourself, a slot at a time.",starterCode:`if (customer) {
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
`},Ye={id:"S5",title:"S5 — Cut to the Chase",mode:"loop",shelfSize:9,customersEnabled:!0,shipmentsEnabled:!0,catalogEnabled:!0,marketEnabled:!0,checkSuccess:i=>i.served>=2,description:`Because each section is kept sorted by freshness (S4), you can answer "how many are expiring soon?" with binary search instead of checking every slot — jump to the middle, narrow, repeat. That only works because it's sorted.`,starterCode:`if (customer) {
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
`},qe={id:"S-CAP",title:"Capstone — Run the Whole Store",mode:"loop",shelfSize:12,customersEnabled:!0,shipmentsEnabled:!0,catalogEnabled:!0,marketEnabled:!0,checkSuccess:i=>i.served>=8&&i.wasted<=3,description:"Everything so far, at scale: route shipments and sales through the catalog, keep every section sorted by freshness, and watch the market — accept shipments when prices are low, sell when they're high. Left running unattended.",starterCode:`function tendSection(product) {
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
`},E=[Ke,Xe,Ge,Ve,Je,Ye,qe],U=["ore","ice","crystal"],Ze=4906624,z=15680580,Qe=4906624,et=800;function tt(){let i=0;return()=>{const e=performance.now();return e-i<et?!1:(i=e,!0)}}const st=[{title:"Once mode (S0)",entries:[{signature:'place(slotIndex, product: "ore" | "ice" | "crystal")',description:"Place a product at a specific shelf slot. Errors if the slot isn't empty."}]},{title:"Loop mode (S1+)",entries:[{signature:"shelf",description:"Array of { product, freshness } — one entry per slot."},{signature:"customer",description:"{ product } if someone's waiting, else null."},{signature:"pendingShipment",description:"{ product } if stock is waiting to be accepted, else null."},{signature:"sell(slotIndex)",description:"Sell that slot's contents to the current customer."},{signature:"place(slotIndex, product)",description:"Place a product — same as once mode."},{signature:"rejectShipment()",description:"Turn away the pending shipment instead of accepting it."}]},{title:"Catalog & market (S3+)",entries:[{signature:"catalog[product]",description:"Array of slot indices reserved for that product."},{signature:"market.prices[product]",description:"Current fluctuating price."},{signature:"market.balance",description:"Cash on hand — shipments cost it, sales earn it."}]},{title:"Sorting (S4+)",entries:[{signature:"swap(slotIndexA, slotIndexB)",description:"Swap two slots' contents — the only way to reorder the shelf. No built-in sort()."}]},{title:"Everywhere",entries:[{signature:"console.log(...)",description:"Prints to the console panel."}]}];function p(i){const e=document.querySelector(i);if(!e)throw new Error(`Missing element: ${i}`);return e}function R(i,e){return i.mode==="loop"?i[e]??!1:!1}async function ot(){const i=p("#world-panel"),e=p("#editor-host"),s=p("#console-host"),o=p("#challenge-select"),n=p("#tick-display b"),r=p("#stats-badge"),d=p("#stat-balance"),f=p("#stat-served"),S=p("#stat-missed"),k=p("#stat-wasted"),F=p("#script-dot"),L=p("#script-name"),g=p("#run-btn"),P=p("#stop-btn"),O=p("#docs-btn"),N=p("#market-btn"),w=p("#credits-display"),ce=p("#stat-warehouse"),J=p("#mute-btn"),ae=new ke(document.body,"Store API",st);O.addEventListener("click",()=>ae.toggle());const Y=new De(document.body,"Market",U);N.addEventListener("click",()=>Y.toggle());const C=new ye,H=tt();function q(){J.textContent=C.isMuted?"🔇":"🔊"}q(),J.addEventListener("click",()=>{C.toggleMute(),q()});const x=X();w.textContent=`$${x.credits.toFixed(2)}`;let W=0;function le(){if(u.mode!=="loop"||!R(u,"marketEnabled"))return;const t=Math.round((l.balance-W)*100)/100;t!==0&&(x.credits=me(t),W=l.balance,w.textContent=`$${x.credits.toFixed(2)}`)}window.addEventListener("storage",()=>{const t=X().credits;x.credits=t,w.textContent=`$${t.toFixed(2)}`,!(u.mode!=="loop"||!R(u,"marketEnabled"))&&t!==l.balance&&(l.balance=t,W=t)});const v=be(),Z=new Map;for(const t of E){const a=document.createElement("option");a.value=t.id,o.appendChild(a),Z.set(t.id,a)}function Q(){E.forEach((t,a)=>{const y=Z.get(t.id);if(!y)return;const j=a>0&&!v.has(E[a-1].id);y.disabled=j;const m=v.has(t.id)?"✓ ":j?"🔒 ":"";y.textContent=`${m}${t.title}`})}Q();const l=new Be({shelfSize:E[0].shelfSize}),I=await V.mount(i,l),h=new Ee(s),K=new we(e,E[0].starterCode);let u=E[0],T=!1,$=[],b=null;function de(){var t;v.has(u.id)||(t=u.checkSuccess)!=null&&t.call(u,l)&&(v.add(u.id),xe(v),Q(),h.success(`✓ ${u.title} complete!`),C.success(),I.flash(Qe))}l.onEvent(t=>{if(t.type==="placed"){if(h.log(`Placed ${t.product} at slot ${t.slotIndex}.`),b===t.product){const a=G();a[t.product]=Math.max(0,a[t.product]-1),Te(a),b=null}}else if(t.type==="sold"){const a=t.earnings>0?` ($${t.earnings.toFixed(2)})`:"";h.success(`Sold ${t.product} from slot ${t.slotIndex}${a}! 🛒`),C.success(),I.burstAtSlot(t.slotIndex,Ze)}else if(t.type==="swapped")h.log(`Swapped slots ${t.slotIndexA} and ${t.slotIndexB}.`);else if(t.type==="customerArrived")h.info(`Customer wants ${t.product}.`);else if(t.type==="customerLeft")h.error(`A customer left unhappy — wanted ${t.product}.`);else if(t.type==="shipmentArrived"){const a=b===t.product?" (from the warehouse)":"";h.log(`Shipment arrived: ${t.product}${a}.`)}else t.type==="shipmentRejected"?(h.info(`Rejected a shipment of ${t.product}.`),b===t.product&&(b=null)):t.type==="spoiled"?(h.error(`${t.product} spoiled at slot ${t.slotIndex}. 💀`),H()&&(C.error(),I.burstAtSlot(t.slotIndex,z),I.flash(z))):t.type==="error"&&(h.error(t.message),H()&&(C.error(),I.flash(z)))});function he(){if(!R(u,"marketEnabled")||l.pendingShipment)return;const t=G(),a=U.find(y=>t[y]>0);a&&(b=a,l.offerShipment(a)||(b=null))}const B=new He({onIntent:t=>{u.mode==="once"?$.push(t):l.applyIntent(t)},onLog:t=>h.log(t),onError:t=>{h.error(t),H()&&(C.error(),I.flash(z))},onDone:()=>{for(const t of $)l.applyIntent(t);h.info(`Script finished — applied ${$.length} action(s).`),$=[]}});function ee(){d.textContent=`$${l.balance.toFixed(2)}`,f.textContent=String(l.served),S.textContent=String(l.missed),k.textContent=String(l.wasted),r.textContent=`${l.served} served`,F.classList.toggle("running",T),L.textContent=T?"pilot.js":"idle";const t={};for(const m of l.shelf)m.product&&(t[m.product]=(t[m.product]??0)+1);const a={};for(const m of U)a[m]={price:l.market.prices[m],stock:t[m]??0};Y.update(a),le();const y=G(),j=U.filter(m=>y[m]>0).map(m=>`${m}:${y[m]}`);ce.textContent=j.length>0?j.join("  "):"—",de()}const te=new Ce(l,()=>{I.render(),ee(),n.textContent=String(te.currentTick)},()=>{he(),T&&u.mode==="loop"&&B.tick({shelf:l.shelf,customer:l.customer,pendingShipment:l.pendingShipment,catalog:l.catalog,prices:l.market.prices,balance:l.balance})});function se(t){x.credits=X().credits,l.configure({shelfSize:t.shelfSize,customersEnabled:R(t,"customersEnabled"),shipmentsEnabled:R(t,"shipmentsEnabled"),catalogEnabled:R(t,"catalogEnabled"),marketEnabled:R(t,"marketEnabled"),prestock:t.mode==="loop"?t.prestock:void 0,initialBalance:x.credits}),W=l.balance,w.textContent=`$${x.credits.toFixed(2)}`}function oe(t){const a=E.find(y=>y.id===t);a&&(u=a,T=!1,$=[],b=null,B.stop(),se(a),K.setCode(a.starterCode),o.value=a.id,h.clear(),h.info(a.description),ee())}o.addEventListener("change",()=>oe(o.value)),g.addEventListener("click",()=>{h.clear(),h.info(u.description),se(u),$=[],b=null,u.mode==="once"?(T=!1,B.run(K.getCode())):(T=!0,B.load(K.getCode()),h.info("Script loaded — running every tick."))}),P.addEventListener("click",()=>{T=!1,B.stop(),h.info("Stopped.")}),oe(E[0].id),te.start()}ot().catch(i=>{console.error(i),document.body.innerHTML=`<pre style="color:#ef4444;padding:2rem;">${String(i)}</pre>`});
