import{r as p,j as I}from"./index-d22Am6KO.js";import{u as X,T as F}from"./ToyTools-DB0YwaS2.js";import{T as H,a as W,b as q}from"./ToyPanel-CdKfeVfE.js";import{u as B,a as G,O as J,c as K,s as Q,d as V,t as z}from"./OxToy-DcpkrHDe.js";const Y=3,v=`// Runs for every cell in the row, every step.
//   left, me, right   the states of the cell and its two
//                     neighbours (0 or 1, unless you add states)
// Return the cell's state in the next row.

`,N=[{id:"rule30",label:"Rule 30 (chaos)",code:`${v}fn rule(left, me, right) -> Int {
    # left XOR (me OR right)
    let either = 0
    if me == 1 || right == 1 { either = 1 }
    if left != either { return 1 }
    return 0
}
`},{id:"rule90",label:"Rule 90 (Sierpiński)",code:`${v}fn rule(left, me, right) -> Int {
    # on if exactly one neighbour is on
    return (left + right) % 2
}
`},{id:"number",label:"Any Wolfram rule by number",code:`${v}fn rule(left, me, right) -> Int {
    # try 110, 30, 73, 105, 150, 184...
    let number = 110

    # the 8 neighbourhoods, 111 down to 000, are the 8
    # binary digits of the number: look up ours
    let index = left * 4 + me * 2 + right
    let bits = number
    for i in range(0, index) {
        bits = bits / 2
    }
    return bits % 2
}
`},{id:"three",label:"Three colours",code:`${v}fn states() -> Int {
    return 3
}

fn rule(left, me, right) -> Int {
    return (left + me + right) % 3
}
`},{id:"four",label:"Four colours, lopsided",code:`${v}fn states() -> Int {
    return 4
}

fn rule(left, me, right) -> Int {
    return (left + 2 * me + 3 * right + 1) % 4
}
`},{id:"blank",label:"Start from scratch",code:`${v}fn rule(left, me, right) -> Int {
    return me
}
`}];function Z(c){const n=/\bfn\s+states\s*\(/.test(c)?"states()":"2";return`${c}

fn main() {
    let k = ${n}
    print("@k", k)
    if k >= 2 && k <= 5 {
        for l in range(0, k) {
            for m in range(0, k) {
                for r in range(0, k) {
                    print("@", rule(l, m, r))
                }
            }
        }
    }
}
`}function _(c){var i;const n=z((c[0]||"").split(" ")[1]);if(!Number.isInteger(n)||n<2||n>5)return{error:`states() returned ${(i=c[0])==null?void 0:i.split(" ")[1]}; it needs to be from 2 to 5.`};const h=new Uint8Array(n*n*n);for(let e=0;e<h.length;e++){const s=(c[1+e]||"").slice(2),o=z(s);if(!Number.isInteger(o)||o<0||o>=n){const d=Math.floor(e/(n*n)),f=Math.floor(e/n)%n;return{error:`rule(${d}, ${f}, ${e%n}) returned ${s||"nothing"}, but the next state has to be a whole number from 0 to ${n-1}.`}}h[e]=o}return{k:n,table:h}}function tt(c,n){if(c!==2)return`${c} states`;let h=0;for(let i=0;i<8;i++)h+=n[i]<<i;return`Rule ${h}`}function et({ctx:c,ink:n,reduced:h,wake:i}){let e=0,s=0,o=new Uint8Array(0),d=0,f=0,M=null,b=2,k=null,T=!h,R=40,S=0,E=0,A="single",j=()=>{};function w(){if(o.fill(0),d=1,f=1,E=0,A==="single")o[e>>1]=1;else for(let r=0;r<e;r++)o[r]=Math.floor(Math.random()*b)}function O(){if(!k)return;const r=(d-1+s)%s*e,l=d*e;for(let u=0;u<e;u++){const y=o[r+(u-1+e)%e],$=o[r+u],t=o[r+(u+1)%e];o[l+u]=k[(y*b+$)*b+t]}d=(d+1)%s,f=Math.min(s,f+1),E++}function L(){const[r,l,u]=n().split(",").map(Number),y=M.data,$=f<s?0:d;for(let t=0;t<s;t++){const a=($+t)%s*e,g=t<f;for(let x=0;x<e;x++){const C=g?o[a+x]:0,m=(t*e+x)*4;y[m]=r,y[m+1]=l,y[m+2]=u,y[m+3]=C===0?0:b===2?255:70+185*C/(b-1)}}c.putImageData(M,0,0)}return{resize(r,l){e=r,s=l,o=new Uint8Array(e*s),M=c.createImageData(e,s),w()},frame(r,l){if(T&&k){S+=l*R;let u=Math.min(s,Math.floor(S));for(S-=Math.floor(S);u-- >0;)O()}L(),j({steps:E})},down(r){const l=Math.floor(r.x),u=(d-1+s)%s*e;o[u+l]=(o[u+l]+1)%b,i()},running:()=>T&&!!k,onStats(r){j=r},setRule(r,l){b=r,k=l,w(),i()},setRate(r){R=r},setStart(r){A=r,w(),i()},restart(){w(),i()},play(r){T=r,i()}}}function lt(){const{canvasRef:c,toyRef:n}=X(et,{cell:Y}),h=window.matchMedia("(prefers-reduced-motion: reduce)").matches,[i,e]=p.useState("rule30"),[s,o]=p.useState(N[0].code),[d,f]=p.useState({kind:"running",text:"Loading Oxidized…"}),[M,b]=p.useState([]),[k,T]=p.useState(""),[R,S]=p.useState(!h),[E,A]=p.useState(40),[j,w]=p.useState("single"),[O,L]=p.useState({steps:0}),r=B(),l=()=>n.current;async function u(t){var D;const a=K(t,["rule"]);if(a)return f({kind:"error",text:a});f(U=>U.kind==="ok"?U:{kind:"running",text:"Running your rule…"});const g=await r(Z(t));if(!g)return;const{data:x,printed:C}=Q(g.out||[]);if(b(C),!g.ok)return f(V(g));const m=_(x);if(m.error)return f({kind:"error",text:m.error});(D=l())==null||D.setRule(m.k,m.table);const P=tt(m.k,m.table);T(P),f({kind:"ok",text:`Running your rule · ${P}`})}const y=G(s,u);p.useEffect(()=>{var a;let t=0;(a=n.current)==null||a.onStats(g=>{const x=performance.now();x-t<250||(t=x,L(g))})},[n]);const $=t=>{var a;return w(t),(a=l())==null?void 0:a.setStart(t)};return I.jsxs(J,{code:s,onCode:t=>(o(t),e("edited")),examples:N,example:i,onExample:t=>{const a=N.find(g=>g.id===t);a&&(e(t),o(a.code))},onRun:y,status:d,printed:M,children:[I.jsx("canvas",{ref:c,className:"fill-canvas pixel-canvas"}),I.jsxs(H,{children:[I.jsx(W,{label:"Speed",value:E,min:2,max:200,onChange:t=>{var a;return A(t),(a=l())==null?void 0:a.setRate(t)},format:t=>t+" rows/s"}),I.jsx(q,{items:[["Rule",k||"–"],["Rows",O.steps.toLocaleString()]]})]}),I.jsx(F,{tools:[{id:"play",label:R?"Pause":"Play",onClick:()=>{var t;return S(!R),(t=l())==null?void 0:t.play(!R)}},{id:"single",label:"One cell",active:j==="single",onClick:()=>$("single")},{id:"random",label:"Random",active:j==="random",onClick:()=>$("random")}],hint:"Click to flip a cell in the newest row"})]})}export{N as EXAMPLES,lt as default};
