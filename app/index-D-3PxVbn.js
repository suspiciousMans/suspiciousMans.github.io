import{r as h,j as w}from"./index-T9V-2Bh-.js";import{u as B,T as H}from"./ToyTools-BMXzTxiD.js";import{T as G,a as D,b as W}from"./ToyPanel-DaDUWbOk.js";import{u as X,a as q,O as F,c as J,s as K,d as Q,t as P}from"./OxToy-DTBIUCc4.js";const V=5,b=`// Runs for every cell, every generation.
//   cell   this cell's state: 0 empty, 1 alive
//          (2 and up are "dying" if you add states)
//   alive  how many of its 8 neighbours are alive
// Return the cell's next state.

`,E=[{id:"life",label:"Conway's Life",code:`${b}fn rule(cell, alive) -> Int {
    if cell == 1 {
        # stay alive with 2 or 3 neighbours
        if alive == 2 || alive == 3 { return 1 }
        return 0
    }
    # come alive with exactly 3
    if alive == 3 { return 1 }
    return 0
}
`},{id:"highlife",label:"HighLife (replicators)",code:`${b}fn rule(cell, alive) -> Int {
    if cell == 1 {
        if alive == 2 || alive == 3 { return 1 }
        return 0
    }
    # like Life, but 6 neighbours also give birth
    if alive == 3 || alive == 6 { return 1 }
    return 0
}
`},{id:"daynight",label:"Day & Night",code:`${b}fn rule(cell, alive) -> Int {
    # symmetric: live and dead regions behave the same
    if cell == 1 {
        if contains([3, 4, 6, 7, 8], alive) { return 1 }
        return 0
    }
    if contains([3, 6, 7, 8], alive) { return 1 }
    return 0
}
`},{id:"seeds",label:"Seeds (explosive)",code:`${b}fn rule(cell, alive) -> Int {
    # every live cell dies; empty cells with 2 neighbours are born
    if cell == 0 && alive == 2 { return 1 }
    return 0
}
`},{id:"maze",label:"Mazes",code:`${b}fn rule(cell, alive) -> Int {
    if cell == 1 {
        if alive >= 1 && alive <= 5 { return 1 }
        return 0
    }
    if alive == 3 { return 1 }
    return 0
}
`},{id:"brain",label:"Brian's Brain (3 states)",code:`${b}# three states: 0 off, 1 firing, 2 resting
fn states() -> Int {
    return 3
}

fn rule(cell, alive) -> Int {
    if cell == 1 { return 2 }      # firing cells rest
    if cell == 2 { return 0 }      # resting cells switch off
    if alive == 2 { return 1 }     # off cells fire with 2 firing neighbours
    return 0
}
`},{id:"starwars",label:"Star Wars (4 states)",code:`${b}fn states() -> Int {
    return 4
}

fn rule(cell, alive) -> Int {
    if cell == 1 {
        if contains([3, 4, 5], alive) { return 1 }
        return 2                   # start dying
    }
    if cell >= 2 {
        return (cell + 1) % 4      # 2 → 3 → 0
    }
    if alive == 2 { return 1 }
    return 0
}
`},{id:"blank",label:"Start from scratch",code:`${b}fn rule(cell, alive) -> Int {
    # try: born with 3, survive with 2, 3 or 4?
    return 0
}
`}];function Y(f){const c=/\bfn\s+states\s*\(/.test(f)?"states()":"2";return`${f}

fn main() {
    let k = ${c}
    print("@k", k)
    if k >= 2 && k <= 8 {
        for c in range(0, k) {
            for n in range(0, 9) {
                print("@", rule(c, n))
            }
        }
    }
}
`}function Z(f){var m;const c=P((f[0]||"").split(" ")[1]);if(!Number.isInteger(c)||c<2||c>8)return{error:`states() returned ${(m=f[0])==null?void 0:m.split(" ")[1]}; it needs to be from 2 to 8.`};const p=new Uint8Array(c*9);for(let t=0;t<c;t++)for(let o=0;o<=8;o++){const r=(f[1+t*9+o]||"").slice(2),g=P(r);if(!Number.isInteger(g)||g<0||g>=c)return{error:`rule(${t}, ${o}) returned ${r||"nothing"}, but the next state has to be a whole number from 0 to ${c-1}.`};p[t*9+o]=g}return{k:c,table:p}}function _(f,c){if(f!==2)return`${f} states`;const p=[],m=[];for(let t=0;t<=8;t++)c[t]===1&&p.push(t),c[9+t]===1&&m.push(t);return`B${p.join("")}/S${m.join("")}`}function ee({ctx:f,ink:c,reduced:p,wake:m}){let t=0,o=0,r=new Uint8Array(0),g=new Uint8Array(0),y=null,S=2,x=null,I=!p,M=12,v=0,k=0,R=null,C=()=>{};function j(n){for(let i=0;i<r.length;i++)r[i]=Math.random()<n?1:0;k=0}function L(){if(x){for(let n=0;n<o;n++){const i=(n-1+o)%o*t,u=(n+1)%o*t,s=n*t;for(let e=0;e<t;e++){const l=(e-1+t)%t,a=(e+1)%t,d=(r[i+l]===1)+(r[i+e]===1)+(r[i+a]===1)+(r[s+l]===1)+(r[s+a]===1)+(r[u+l]===1)+(r[u+e]===1)+(r[u+a]===1);g[s+e]=x[r[s+e]*9+d]}}[r,g]=[g,r],k++}}function A(n){const i=Math.floor(n.x),u=Math.floor(n.y);for(let s=0;s<=1;s++)for(let e=0;e<=1;e++){const l=(i+e+t)%t,a=(u+s+o)%o;r[a*t+l]=n.button===2?0:1}}function T(){const[n,i,u]=c().split(",").map(Number),s=y.data;let e=0;for(let l=0;l<r.length;l++){const a=r[l],d=l*4;s[d]=n,s[d+1]=i,s[d+2]=u,a===1&&e++,s[d+3]=a===0?0:a===1?255:40+150*(S-a)/Math.max(1,S-2)}return f.putImageData(y,0,0),e}return{resize(n,i){const u=!t,s=r,e=t;if(t=n,o=i,r=new Uint8Array(t*o),g=new Uint8Array(t*o),y=f.createImageData(t,o),u)return j(.2);for(let l=0;l<s.length;l++){const a=l%e,d=Math.floor(l/e);s[l]&&a<t&&d<o&&(r[d*t+a]=s[l])}},frame(n,i){if(R&&A(R),I&&x){v+=i*M;let s=Math.min(6,Math.floor(v));for(v-=Math.floor(v);s-- >0;)L()}const u=T();C({gen:k,pop:u})},down(n){R=n},up(){R=null},running:()=>I&&!!x,onStats(n){C=n},setRule(n,i){if(n<S)for(let u=0;u<r.length;u++)r[u]>=n&&(r[u]=0);S=n,x=i,m()},setRate(n){M=n},play(n){I=n,m()},stepOnce(){L(),m()},randomize(n){j(n),m()},clear(){r.fill(0),k=0,m()}}}function ie(){const{canvasRef:f,toyRef:c}=B(ee,{cell:V}),p=window.matchMedia("(prefers-reduced-motion: reduce)").matches,[m,t]=h.useState("life"),[o,r]=h.useState(E[0].code),[g,y]=h.useState({kind:"running",text:"Loading Oxidized…"}),[S,x]=h.useState([]),[I,M]=h.useState(""),[v,k]=h.useState(!p),[R,C]=h.useState(12),[j,L]=h.useState(.2),[A,T]=h.useState({gen:0,pop:0}),n=X(),i=()=>c.current;async function u(e){var N;const l=J(e,["rule"]);if(l)return y({kind:"error",text:l});y(O=>O.kind==="ok"?O:{kind:"running",text:"Running your rule…"});const a=await n(Y(e));if(!a)return;const{data:d,printed:U}=K(a.out||[]);if(x(U),!a.ok)return y(Q(a));const $=Z(d);if($.error)return y({kind:"error",text:$.error});(N=i())==null||N.setRule($.k,$.table);const z=_($.k,$.table);M(z),y({kind:"ok",text:`Running your rule · ${z}`})}const s=q(o,u);return h.useEffect(()=>{var l;let e=0;(l=c.current)==null||l.onStats(a=>{const d=performance.now();d-e<200||(e=d,T(a))})},[c]),w.jsxs(F,{code:o,onCode:e=>(r(e),t("edited")),examples:E,example:m,onExample:e=>{const l=E.find(a=>a.id===e);l&&(t(e),r(l.code))},onRun:s,status:g,printed:S,children:[w.jsx("canvas",{ref:f,className:"fill-canvas pixel-canvas"}),w.jsxs(G,{children:[w.jsx(D,{label:"Speed",value:R,min:1,max:40,onChange:e=>{var l;return C(e),(l=i())==null?void 0:l.setRate(e)},format:e=>e+" gen/s"}),w.jsx(D,{label:"Random fill",value:j,min:.05,max:.6,step:.01,onChange:L,format:e=>Math.round(e*100)+"%"}),w.jsx(W,{items:[["Rule",I||"–"],["Generation",A.gen.toLocaleString()],["Alive",A.pop.toLocaleString()]]})]}),w.jsx(H,{tools:[{id:"play",label:v?"Pause":"Play",onClick:()=>{var e;return k(!v),(e=i())==null?void 0:e.play(!v)}},{id:"step",label:"Step",onClick:()=>{var e;return(e=i())==null?void 0:e.stepOnce()}},{id:"random",label:"Random",onClick:()=>{var e;return(e=i())==null?void 0:e.randomize(j)}},{id:"clear",label:"Clear",onClick:()=>{var e;return(e=i())==null?void 0:e.clear()}}],hint:"Drag to draw · right-drag to erase"})]})}export{E as EXAMPLES,ie as default};
