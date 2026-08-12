var de=Object.defineProperty;var he=(n,e,t)=>e in n?de(n,e,{enumerable:!0,configurable:!0,writable:!0,value:t}):n[e]=t;var c=(n,e,t)=>he(n,typeof e!="symbol"?e+"":e,t);import"./modulepreload-polyfill-B5Qt9EMX.js";import{J as pe,d as ue,A as me,e as se,f as fe,h as ge,l as Se,E as ke,i as ye,j as be,s as we}from"./Sound-CXK0kihV.js";import{T as Ee}from"./Text-CMg41cYS.js";import{l as Ce,a as K,b as xe,s as Ie}from"./Warehouse-Dkg0kq08.js";import"./CanvasPool-8td293LM.js";import"./canvasUtils-C8_brHhr.js";import"./BatchableSprite-qOYjpB38.js";import"./getPo2TextureFromSource-CzhtZTC9.js";const Te=6,oe=60,Ae=.06,Me=40,Re=.05,I=["ore","ice","crystal"],W={ore:3,ice:4,crystal:8},Le=50,$e=20,_e=.06,Pe=.5,Oe=1.5;function Ne(){return{product:null,freshness:0}}class ve{constructor(e={},t=Math.random){c(this,"shelf");c(this,"customer",null);c(this,"pendingShipment",null);c(this,"catalog",null);c(this,"market",{prices:{...W}});c(this,"balance",0);c(this,"served",0);c(this,"missed",0);c(this,"wasted",0);c(this,"customerPatienceRemaining",0);c(this,"customersEnabled",!1);c(this,"shipmentsEnabled",!1);c(this,"marketEnabled",!1);c(this,"ticksSinceMarketUpdate",0);c(this,"listeners",[]);c(this,"random");this.random=t,this.shelf=[],this.configure(e)}onEvent(e){this.listeners.push(e)}emit(e){for(const t of this.listeners)t(e)}configure(e={}){const t=e.shelfSize??Te;if(this.shelf=Array.from({length:t},Ne),(e.prestock??[]).forEach((o,i)=>{this.shelf[i]&&(this.shelf[i]={product:o,freshness:oe})}),this.customersEnabled=e.customersEnabled??!1,this.shipmentsEnabled=e.shipmentsEnabled??!1,this.marketEnabled=e.marketEnabled??!1,e.catalogEnabled){const o=Math.max(1,Math.floor(t/I.length)),i={};I.forEach((r,d)=>{const f=[];for(let S=0;S<o;S++){const k=d*o+S;k<t&&f.push(k)}i[r]=f}),this.catalog=i}else this.catalog=null;this.market.prices={...W},this.ticksSinceMarketUpdate=0,this.balance=this.marketEnabled?e.initialBalance??Le:0,this.customer=null,this.pendingShipment=null,this.customerPatienceRemaining=0,this.served=0,this.missed=0,this.wasted=0}applyIntent(e){var t;if(e.kind==="place"){const o=this.shelf[e.slotIndex];if(!o){this.emit({type:"error",message:`No such slot: ${e.slotIndex}.`});return}if(o.product!==null){this.emit({type:"error",message:"Can't place — slot isn't empty."});return}const i=((t=this.pendingShipment)==null?void 0:t.product)===e.product;if(this.marketEnabled&&i){const r=this.market.prices[e.product];if(this.balance<r){this.emit({type:"error",message:`Not enough cash — ${e.product} costs $${r.toFixed(2)}, you have $${this.balance.toFixed(2)}.`});return}this.balance=Math.round((this.balance-r)*100)/100}o.product=e.product,o.freshness=oe,this.emit({type:"placed",slotIndex:e.slotIndex,product:e.product}),i&&(this.pendingShipment=null);return}if(e.kind==="sell"){const o=this.shelf[e.slotIndex];if(!o||!o.product){this.emit({type:"error",message:"Nothing there to sell."});return}if(!this.customer){this.emit({type:"error",message:"No customer waiting."});return}if(o.product!==this.customer.product){this.emit({type:"error",message:"That's not what the customer wants."});return}const i=o.product;o.product=null,o.freshness=0,this.served+=1;let r=0;this.marketEnabled&&(r=this.market.prices[i],this.balance=Math.round((this.balance+r)*100)/100),this.emit({type:"sold",slotIndex:e.slotIndex,product:i,earnings:r}),this.customer=null,this.customerPatienceRemaining=0;return}if(e.kind==="swap"){const o=this.shelf[e.slotIndexA],i=this.shelf[e.slotIndexB];if(!o||!i){this.emit({type:"error",message:"No such slot to swap."});return}const r={...o};this.shelf[e.slotIndexA]={...i},this.shelf[e.slotIndexB]=r,this.emit({type:"swapped",slotIndexA:e.slotIndexA,slotIndexB:e.slotIndexB});return}if(!this.pendingShipment){this.emit({type:"error",message:"No shipment to reject."});return}this.emit({type:"shipmentRejected",product:this.pendingShipment.product}),this.pendingShipment=null}offerShipment(e){return this.pendingShipment?!1:(this.pendingShipment={product:e},this.emit({type:"shipmentArrived",product:e}),!0)}step(e){for(let t=0;t<this.shelf.length;t++){const o=this.shelf[t];o.product&&(o.freshness-=1,o.freshness<=0&&(this.emit({type:"spoiled",slotIndex:t,product:o.product}),this.wasted+=1,o.product=null,o.freshness=0))}if(this.customersEnabled){if(this.customer)this.customerPatienceRemaining-=1,this.customerPatienceRemaining<=0&&(this.emit({type:"customerLeft",product:this.customer.product}),this.missed+=1,this.customer=null);else if(this.random()<Ae){const t=I[Math.floor(this.random()*I.length)];this.customer={product:t},this.customerPatienceRemaining=Me,this.emit({type:"customerArrived",product:t})}}if(this.shipmentsEnabled&&!this.pendingShipment&&this.random()<Re){const t=I[Math.floor(this.random()*I.length)];this.pendingShipment={product:t},this.emit({type:"shipmentArrived",product:t})}if(this.marketEnabled&&(this.ticksSinceMarketUpdate+=1,this.ticksSinceMarketUpdate>=$e)){this.ticksSinceMarketUpdate=0;for(const t of I){const o=(this.random()*2-1)*_e,i=this.market.prices[t]*(1+o),r=W[t]*Pe,d=W[t]*Oe;this.market.prices[t]=Math.round(Math.min(d,Math.max(r,i))*100)/100}}}}const T=70,$=80,ie=14,Be={ore:11569512,ice:12577008,crystal:13215984},je=1974568,Fe=3817544;class X{constructor(e,t){c(this,"app");c(this,"world");c(this,"layer");c(this,"juice",new pe);this.app=e,this.world=t,this.layer=new ue,this.app.stage.addChild(this.layer),this.app.stage.addChild(this.juice.localContainer),this.app.stage.addChild(this.juice.screenContainer),this.recenter(),this.app.renderer.on("resize",()=>this.recenter())}static async mount(e,t){const o=new me;return await o.init({resizeTo:e,background:1316634,antialias:!0}),e.appendChild(o.canvas),new X(o,t)}recenter(){this.layer.position.set(this.app.screen.width/2,this.app.screen.height/2),this.juice.localContainer.position.copyFrom(this.layer.position)}slotX(e){const t=this.world.shelf.length;return-(t*T+(t-1)*ie)/2+e*(T+ie)}burstAtSlot(e,t){e<0||e>=this.world.shelf.length||this.juice.burst(this.slotX(e)+T/2,0,t)}flash(e){this.juice.flash(e,this.app.screen.width,this.app.screen.height)}render(){this.juice.update(),this.layer.removeChildren();const e=this.world.shelf.length;for(let o=0;o<e;o++){const i=this.world.shelf[o],r=this.slotX(o),d=i.product?Be[i.product]:je,f=new se().roundRect(0,0,T,$,4).fill(d).stroke({width:1.5,color:Fe});if(f.position.set(r,-$/2),this.layer.addChild(f),this.layer.addChild(this.label(String(o),r+T/2,$/2+6)),i.product){this.layer.addChild(this.label(i.product,r+T/2,-$/2-14,1316634));const S=i.freshness/60,k=this.freshnessBar(S);k.position.set(r+6,$/2-12),this.layer.addChild(k)}}const t=-$/2-50;this.world.customer&&this.layer.addChild(this.label(`Customer wants: ${this.world.customer.product}`,0,t,15132390)),this.world.pendingShipment&&this.layer.addChild(this.label(`Shipment waiting: ${this.world.pendingShipment.product}`,0,t-20,8037065))}freshnessBar(e){const t=T-12,o=4,i=Math.max(0,Math.min(1,e)),r=i<.3?14242639:i<.6?14263871:5220569,d=new se;return d.rect(0,0,t,o).fill(855825),d.rect(0,0,t*i,o).fill(r),d}label(e,t,o,i=8950176){const r=new Ee({text:e,style:{fontFamily:"monospace",fontSize:11,fill:i}});return r.anchor.set(.5,0),r.position.set(t,o),r}}class We{constructor(e,t,o){c(this,"panel");c(this,"rows",new Map);c(this,"lastPrice",new Map);c(this,"visible",!1);this.panel=document.createElement("div"),this.panel.className="market-panel",this.panel.style.display="none";const i=document.createElement("div");i.className="market-panel-header";const r=document.createElement("span");r.textContent=t;const d=document.createElement("button");d.className="market-panel-close",d.textContent="×",d.setAttribute("aria-label","Close market"),d.addEventListener("click",()=>this.close()),i.appendChild(r),i.appendChild(d),this.panel.appendChild(i);const f=document.createElement("table");f.className="market-table";const S=document.createElement("thead"),k=document.createElement("tr");for(const A of["Product","Price","Δ","On shelf"]){const g=document.createElement("th");g.textContent=A,k.appendChild(g)}S.appendChild(k),f.appendChild(S);const F=document.createElement("tbody");for(const A of o){const g=document.createElement("tr"),P=document.createElement("td");P.textContent=A,P.className="market-cell-name";const O=document.createElement("td");O.className="market-cell-num";const N=document.createElement("td");N.className="market-cell-num";const M=document.createElement("td");M.className="market-cell-num",g.appendChild(P),g.appendChild(O),g.appendChild(N),g.appendChild(M),F.appendChild(g),this.rows.set(A,{tr:g,priceCell:O,changeCell:N,stockCell:M})}f.appendChild(F),this.panel.appendChild(f),e.appendChild(this.panel)}update(e){for(const[t,o]of this.rows){const i=e[t];if(!i)continue;const r=this.lastPrice.get(t),d=r===void 0?0:i.price-r;this.lastPrice.set(t,i.price),o.priceCell.textContent=`$${i.price.toFixed(2)}`,o.changeCell.textContent=d===0?"—":`${d>0?"+":""}${d.toFixed(2)}`,o.changeCell.classList.toggle("market-up",d>0),o.changeCell.classList.toggle("market-down",d<0),o.stockCell.textContent=String(i.stock)}}toggle(){this.visible?this.close():this.open()}open(){this.visible=!0,this.panel.style.display="flex"}close(){this.visible=!1,this.panel.style.display="none"}}const De=1500,Ue=200;class ze{constructor(e){c(this,"worker");c(this,"callbacks");c(this,"ready",!1);c(this,"awaitingTick",!1);c(this,"watchdog",null);this.callbacks=e,this.worker=this.spawnWorker()}spawnWorker(){const e=new Worker(new URL("/autocode/assets/storeSandbox.worker-DrM2mIRd.js",import.meta.url),{type:"module"});return e.addEventListener("message",t=>this.handleMessage(t)),e}handleMessage(e){const t=e.data;t.type==="intent"?this.callbacks.onIntent(t.intent):t.type==="log"?this.callbacks.onLog(t.message):t.type==="error"?this.callbacks.onError(t.message):t.type==="loaded"?this.ready=!0:t.type==="tickDone"?this.clearWatchdog():t.type==="done"&&this.finishRun()}clearWatchdog(){this.awaitingTick=!1,this.watchdog!==null&&(window.clearTimeout(this.watchdog),this.watchdog=null)}finishRun(){var e,t;this.clearWatchdog(),(t=(e=this.callbacks).onDone)==null||t.call(e)}run(e){this.watchdog=window.setTimeout(()=>{this.watchdog=null,this.callbacks.onError("Script exceeded its time budget and was stopped — check for an infinite loop."),this.worker.terminate(),this.worker=this.spawnWorker()},De),this.worker.postMessage({type:"run",code:e})}load(e){this.ready=!1,this.worker.postMessage({type:"load",code:e})}tick(e){!this.ready||this.awaitingTick||(this.awaitingTick=!0,this.watchdog=window.setTimeout(()=>{this.callbacks.onError("Script took too long on a tick and was stopped — check for an infinite loop."),this.worker.terminate(),this.worker=this.spawnWorker(),this.ready=!1,this.awaitingTick=!1},Ue),this.worker.postMessage({type:"tick",...e}))}stop(){this.clearWatchdog(),this.worker.terminate(),this.worker=this.spawnWorker(),this.ready=!1}dispose(){this.clearWatchdog(),this.worker.terminate()}}const He={id:"S0",title:"S0 — Filling the Shelf",mode:"once",shelfSize:6,checkSuccess:n=>{var e,t,o,i;return((e=n.shelf[0])==null?void 0:e.product)==="ore"&&((t=n.shelf[1])==null?void 0:t.product)==="ice"&&((o=n.shelf[2])==null?void 0:o.product)==="ore"&&((i=n.shelf[3])==null?void 0:i.product)==="crystal"},description:"An array is a fixed number of indexed slots, not a bag of items. Place each crate of mined resources at a specific slot index — in order, exactly once.",starterCode:`// place(slotIndex, product) — each slot is a specific position, not just "somewhere."
place(0, "ore");
place(1, "ice");
place(2, "ore");
place(3, "crystal");
`},Ke={id:"S1",title:"S1 — Finding It Again",mode:"loop",shelfSize:6,customersEnabled:!0,prestock:["ore","ice","ore","crystal"],checkSuccess:n=>n.served>=1,description:"Knowing something is somewhere on the shelf isn't the same as knowing where. When a customer wants something, scan the shelf slot by slot until you find a match — or run out of slots.",starterCode:`// This script runs every tick. Scan the shelf slot by slot for what the customer wants.
if (customer) {
  for (let i = 0; i < shelf.length; i++) {
    if (shelf[i].product === customer.product) {
      sell(i);
      break;
    }
  }
}
`},Xe={id:"S2",title:"S2 — Making Room",mode:"loop",shelfSize:4,customersEnabled:!0,shipmentsEnabled:!0,checkSuccess:n=>n.served>=1,description:"A fixed-size shelf has edges. Shipments now arrive on their own timer — check for an empty slot before accepting one; if the shelf is full, reject it rather than crashing or overwriting.",starterCode:`if (customer) {
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
`},Ge={id:"S3",title:"S3 — Look It Up",mode:"loop",shelfSize:9,customersEnabled:!0,shipmentsEnabled:!0,catalogEnabled:!0,marketEnabled:!0,checkSuccess:n=>n.served>=2,description:"The cargo bay is now divided into a section per resource. catalog[product] gives you that section's slot indices directly — a dictionary lookup instead of an if/else chain. Prices fluctuate now too (check the Market panel) — accepting a shipment costs the current price, selling earns it.",starterCode:`if (customer) {
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
`},Ve={id:"S4",title:"S4 — Keep It Fresh",mode:"loop",shelfSize:9,customersEnabled:!0,shipmentsEnabled:!0,catalogEnabled:!0,marketEnabled:!0,checkSuccess:n=>n.served>=2&&n.wasted<=1,description:"Sort each section by freshness — most urgent first — so the front of the section is always the next thing that should move. There's no built-in sort() for the shelf: use swap(slotIndexA, slotIndexB) to actually reorder it yourself, a slot at a time.",starterCode:`if (customer) {
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
`},Je={id:"S5",title:"S5 — Cut to the Chase",mode:"loop",shelfSize:9,customersEnabled:!0,shipmentsEnabled:!0,catalogEnabled:!0,marketEnabled:!0,checkSuccess:n=>n.served>=2,description:`Because each section is kept sorted by freshness (S4), you can answer "how many are expiring soon?" with binary search instead of checking every slot — jump to the middle, narrow, repeat. That only works because it's sorted.`,starterCode:`if (customer) {
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
`},Ye={id:"S-CAP",title:"Capstone — Run the Whole Store",mode:"loop",shelfSize:12,customersEnabled:!0,shipmentsEnabled:!0,catalogEnabled:!0,marketEnabled:!0,checkSuccess:n=>n.served>=8&&n.wasted<=3,description:"Everything so far, at scale: route shipments and sales through the catalog, keep every section sorted by freshness, and watch the market — accept shipments when prices are low, sell when they're high. Left running unattended.",starterCode:`function tendSection(product) {
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
`},w=[He,Ke,Xe,Ge,Ve,Je,Ye],D=["ore","ice","crystal"],qe=4906624,U=15680580,Ze=4906624,Qe=800;function et(){let n=0;return()=>{const e=performance.now();return e-n<Qe?!1:(n=e,!0)}}const tt=[{title:"Once mode (S0)",entries:[{signature:'place(slotIndex, product: "ore" | "ice" | "crystal")',description:"Place a product at a specific shelf slot. Errors if the slot isn't empty."}]},{title:"Loop mode (S1+)",entries:[{signature:"shelf",description:"Array of { product, freshness } — one entry per slot."},{signature:"customer",description:"{ product } if someone's waiting, else null."},{signature:"pendingShipment",description:"{ product } if stock is waiting to be accepted, else null."},{signature:"sell(slotIndex)",description:"Sell that slot's contents to the current customer."},{signature:"place(slotIndex, product)",description:"Place a product — same as once mode."},{signature:"rejectShipment()",description:"Turn away the pending shipment instead of accepting it."}]},{title:"Catalog & market (S3+)",entries:[{signature:"catalog[product]",description:"Array of slot indices reserved for that product."},{signature:"market.prices[product]",description:"Current fluctuating price."},{signature:"market.balance",description:"Cash on hand — shipments cost it, sales earn it."}]},{title:"Sorting (S4+)",entries:[{signature:"swap(slotIndexA, slotIndexB)",description:"Swap two slots' contents — the only way to reorder the shelf. No built-in sort()."}]},{title:"Everywhere",entries:[{signature:"console.log(...)",description:"Prints to the console panel."}]}];function p(n){const e=document.querySelector(n);if(!e)throw new Error(`Missing element: ${n}`);return e}function _(n,e){return n.mode==="loop"?n[e]??!1:!1}async function st(){const n=p("#world-panel"),e=p("#editor-host"),t=p("#console-host"),o=p("#challenge-select"),i=p("#tick-display b"),r=p("#stats-badge"),d=p("#stat-balance"),f=p("#stat-served"),S=p("#stat-missed"),k=p("#stat-wasted"),F=p("#script-dot"),A=p("#script-name"),g=p("#run-btn"),P=p("#stop-btn"),O=p("#docs-btn"),N=p("#market-btn"),M=p("#credits-display"),ne=p("#stat-warehouse"),G=p("#mute-btn"),re=new fe(document.body,"Store API",tt);O.addEventListener("click",()=>re.toggle());const V=new We(document.body,"Market",D);N.addEventListener("click",()=>V.toggle());const E=new ge,z=et();function J(){G.textContent=E.isMuted?"🔇":"🔊"}J(),G.addEventListener("click",()=>{E.toggleMute(),J()});const R=Ce();M.textContent=`$${R.credits.toFixed(2)}`;function ce(){u.mode!=="loop"||!_(u,"marketEnabled")||R.credits!==l.balance&&(R.credits=l.balance,Ie(R),M.textContent=`$${R.credits.toFixed(2)}`)}const v=Se(),Y=new Map;for(const s of w){const a=document.createElement("option");a.value=s.id,o.appendChild(a),Y.set(s.id,a)}function q(){w.forEach((s,a)=>{const y=Y.get(s.id);if(!y)return;const j=a>0&&!v.has(w[a-1].id);y.disabled=j;const m=v.has(s.id)?"✓ ":j?"🔒 ":"";y.textContent=`${m}${s.title}`})}q();const l=new ve({shelfSize:w[0].shelfSize}),C=await X.mount(n,l),h=new ye(t),H=new ke(e,w[0].starterCode);let u=w[0],x=!1,L=[],b=null;function ae(){var s;v.has(u.id)||(s=u.checkSuccess)!=null&&s.call(u,l)&&(v.add(u.id),we(v),q(),h.success(`✓ ${u.title} complete!`),E.success(),C.flash(Ze))}l.onEvent(s=>{if(s.type==="placed"){if(h.log(`Placed ${s.product} at slot ${s.slotIndex}.`),b===s.product){const a=K();a[s.product]=Math.max(0,a[s.product]-1),xe(a),b=null}}else if(s.type==="sold"){const a=s.earnings>0?` ($${s.earnings.toFixed(2)})`:"";h.success(`Sold ${s.product} from slot ${s.slotIndex}${a}! 🛒`),E.success(),C.burstAtSlot(s.slotIndex,qe)}else if(s.type==="swapped")h.log(`Swapped slots ${s.slotIndexA} and ${s.slotIndexB}.`);else if(s.type==="customerArrived")h.info(`Customer wants ${s.product}.`);else if(s.type==="customerLeft")h.error(`A customer left unhappy — wanted ${s.product}.`);else if(s.type==="shipmentArrived"){const a=b===s.product?" (from the warehouse)":"";h.log(`Shipment arrived: ${s.product}${a}.`)}else s.type==="shipmentRejected"?(h.info(`Rejected a shipment of ${s.product}.`),b===s.product&&(b=null)):s.type==="spoiled"?(h.error(`${s.product} spoiled at slot ${s.slotIndex}. 💀`),z()&&(E.error(),C.burstAtSlot(s.slotIndex,U),C.flash(U))):s.type==="error"&&(h.error(s.message),z()&&(E.error(),C.flash(U)))});function le(){if(!_(u,"marketEnabled")||l.pendingShipment)return;const s=K(),a=D.find(y=>s[y]>0);a&&(b=a,l.offerShipment(a)||(b=null))}const B=new ze({onIntent:s=>{u.mode==="once"?L.push(s):l.applyIntent(s)},onLog:s=>h.log(s),onError:s=>{h.error(s),z()&&(E.error(),C.flash(U))},onDone:()=>{for(const s of L)l.applyIntent(s);h.info(`Script finished — applied ${L.length} action(s).`),L=[]}});function Z(){d.textContent=`$${l.balance.toFixed(2)}`,f.textContent=String(l.served),S.textContent=String(l.missed),k.textContent=String(l.wasted),r.textContent=`${l.served} served`,F.classList.toggle("running",x),A.textContent=x?"pilot.js":"idle";const s={};for(const m of l.shelf)m.product&&(s[m.product]=(s[m.product]??0)+1);const a={};for(const m of D)a[m]={price:l.market.prices[m],stock:s[m]??0};V.update(a),ce();const y=K(),j=D.filter(m=>y[m]>0).map(m=>`${m}:${y[m]}`);ne.textContent=j.length>0?j.join("  "):"—",ae()}const Q=new be(l,()=>{C.render(),Z(),i.textContent=String(Q.currentTick)},()=>{le(),x&&u.mode==="loop"&&B.tick({shelf:l.shelf,customer:l.customer,pendingShipment:l.pendingShipment,catalog:l.catalog,prices:l.market.prices,balance:l.balance})});function ee(s){l.configure({shelfSize:s.shelfSize,customersEnabled:_(s,"customersEnabled"),shipmentsEnabled:_(s,"shipmentsEnabled"),catalogEnabled:_(s,"catalogEnabled"),marketEnabled:_(s,"marketEnabled"),prestock:s.mode==="loop"?s.prestock:void 0,initialBalance:R.credits})}function te(s){const a=w.find(y=>y.id===s);a&&(u=a,x=!1,L=[],b=null,B.stop(),ee(a),H.setCode(a.starterCode),o.value=a.id,h.clear(),h.info(a.description),Z())}o.addEventListener("change",()=>te(o.value)),g.addEventListener("click",()=>{h.clear(),h.info(u.description),ee(u),L=[],b=null,u.mode==="once"?(x=!1,B.run(H.getCode())):(x=!0,B.load(H.getCode()),h.info("Script loaded — running every tick."))}),P.addEventListener("click",()=>{x=!1,B.stop(),h.info("Stopped.")}),te(w[0].id),Q.start()}st().catch(n=>{console.error(n),document.body.innerHTML=`<pre style="color:#ef4444;padding:2rem;">${String(n)}</pre>`});
