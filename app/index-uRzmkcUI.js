import{r as g,j as I}from"./index-Bh2kYhKk.js";import{u as J,T as X}from"./ToyTools-B2CPq8Ow.js";import{T as Y,c as Z,a as L,b as K}from"./ToyPanel-DIhlcKcY.js";import{u as Q,a as U,O as V,c as _,s as ee,d as te,t as ne}from"./OxToy-DJJezaoh.js";const q={small:{W:48,H:30,label:"Small · 48 × 30"},medium:{W:64,H:40,label:"Medium · 64 × 40"},large:{W:96,H:60,label:"Large · 96 × 60"}},C=4,re=Float32Array.from([0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5],s=>(s+.5)/16),D=`// Runs for every cell of the grid, every frame.
//   x, y   the cell, from 0 up to WIDTH and HEIGHT
//   t      the frame, from 0 up to FRAMES
// WIDTH, HEIGHT and FRAMES are filled in for you.
// Return how bright the cell is, from 0 (dark) to 9.

`,N=[{id:"ripples",label:"Ripples",code:`${D}fn shade(x, y, t) -> Int {
    let dx = x - WIDTH / 2
    let dy = y - HEIGHT / 2
    let d = sqrt((dx * dx + dy * dy) as Float) as Int

    # rings every 10 cells, moving out one ring per loop
    return (d + 100 - t * 10 / FRAMES) % 10
}
`},{id:"interference",label:"Two sources",code:`${D}fn dist(x, y, cx, cy) -> Int {
    let dx = x - cx
    let dy = y - cy
    return sqrt((dx * dx + dy * dy) as Float) as Int
}

fn shade(x, y, t) -> Int {
    let gap = WIDTH / 6
    let a = dist(x, y, WIDTH / 2 - gap, HEIGHT / 2)
    let b = dist(x, y, WIDTH / 2 + gap, HEIGHT / 2)
    let wave = t * 8 / FRAMES

    # where the rings from both line up, it's bright
    let v = (a + wave) % 8 + (b + wave) % 8
    return v * 9 / 14
}
`},{id:"diamonds",label:"Diamonds",code:`${D}fn shade(x, y, t) -> Int {
    let d = abs(x - WIDTH / 2) + abs(y - HEIGHT / 2)
    return (d + 100 - t * 10 / FRAMES) % 10
}
`},{id:"checker",label:"Checker wave",code:`${D}fn shade(x, y, t) -> Int {
    let size = 6
    # shift each row a little further each frame
    let shift = (y / size) * t
    let cx = (x + shift) / size
    let cy = y / size
    if (cx + cy) % 2 == 0 {
        return 9
    }
    return 1
}
`},{id:"sunset",label:"Sunset",code:`${D}fn shade(x, y, t) -> Int {
    let horizon = HEIGHT * 3 / 5
    let sx = x - WIDTH / 2
    let sy = y - horizon + 2

    # the sun: a disc sitting on the horizon
    if y < horizon && sx * sx + sy * sy < 150 {
        return 9
    }
    # sky: darker the higher you look
    if y < horizon {
        return y * 6 / horizon
    }
    # sea: stripes that shimmer frame to frame
    if (y + t + x / 7) % 3 == 0 && abs(sx) < (y - horizon) * 2 {
        return 7
    }
    return 1
}
`},{id:"blank",label:"Start from scratch",code:`${D}fn shade(x, y, t) -> Int {
    # a gradient from left to right; make it yours
    return x * 10 / WIDTH
}
`}];function se(s,d,a,i){return`${s.replace(/\bWIDTH\b/g,d).replace(/\bHEIGHT\b/g,a).replace(/\bFRAMES\b/g,i)}

fn main() {
    for t in range(0, ${i}) {
        for y in range(0, ${a}) {
            let line = "@"
            for x in range(0, ${d}) {
                line = line + " " + (shade(x, y, t) as String)
            }
            print(line)
        }
    }
}
`}function oe(s,d,a,i){if(s.length<i*a)return{error:`expected ${i*a} rows of output but got ${s.length}`};const u=[];for(let o=0;o<i;o++){const r=new Float32Array(d*a);for(let m=0;m<a;m++){const n=s[o*a+m].split(" ");for(let l=0;l<d;l++){const b=ne(n[l+1]);if(Number.isNaN(b))return{error:`shade(${l}, ${m}, ${o}) returned ${n[l+1]}; it needs to return a number.`};r[m*d+l]=Math.min(9,Math.max(0,b))}}u.push(r)}return{frames:u}}function ae({ctx:s,ink:d,reduced:a,wake:i}){let u=0,o=0;const r=document.createElement("canvas"),m=r.getContext("2d");let n=[],l=[],b=0,T=0,z="",S=!a,W=8,F=0,y=0,$=()=>{};function A(){const t=d(),[c,p,k]=t.split(",").map(Number),M=b*C,e=T*C;r.width=M,r.height=e,l=n.map(f=>{const x=m.createImageData(M,e),w=x.data;for(let h=0;h<e;h++){const H=Math.floor(h/C)*b;for(let E=0;E<M;E++){const R=f[H+Math.floor(E/C)]/9,v=(h*M+E)*4;w[v]=c,w[v+1]=p,w[v+2]=k,w[v+3]=R>re[(h&3)*4+(E&3)]?255:0}}return x}),z=t}function j(){if(s.clearRect(0,0,u,o),!l.length)return;d()!==z&&A(),m.putImageData(l[y],0,0);const t=16,c=Math.min((u-t*2)/r.width,(o-t*2)/r.height),p=r.width*c,k=r.height*c;s.imageSmoothingEnabled=!1,s.drawImage(r,(u-p)/2,(o-k)/2,p,k)}return{resize(t,c){u=t,o=c},frame(t,c){S&&n.length>1&&(F+=c*W,y=Math.floor(F)%n.length),j(),$({frame:y})},down(t){n.length&&(y=(y+(t.button===2?n.length-1:1))%n.length,F=y,i())},running:()=>S&&n.length>1,onStats(t){$=t},setFrames(t,c,p){n=t,b=c,T=p,y=Math.min(y,n.length-1),A(),i()},setFps(t){W=t},play(t){S=t,i()}}}function ue(){const{canvasRef:s,toyRef:d}=J(ae),a=window.matchMedia("(prefers-reduced-motion: reduce)").matches,[i,u]=g.useState("ripples"),[o,r]=g.useState(N[0].code),[m,n]=g.useState({kind:"running",text:"Loading Oxidized…"}),[l,b]=g.useState([]),[T,z]=g.useState("medium"),[S,W]=g.useState(8),[F,y]=g.useState(8),[$,A]=g.useState(!a),[j,t]=g.useState(0),c=Q(),p=()=>d.current;async function k(e,f,x){var P;const w=_(e,["shade"]);if(w)return n({kind:"error",text:w});const{W:h,H}=q[f];n({kind:"running",text:`Drawing ${h*H*x} cells…`});const E=performance.now(),R=await c(se(e,h,H,x),{timeout:1e4});if(!R)return;const{data:v,printed:B}=ee(R.out||[]);if(b(B),!R.ok)return n(te(R));const G=oe(v,h,H,x);if(G.error)return n({kind:"error",text:G.error});(P=p())==null||P.setFrames(G.frames,h,H);const O=Math.round(performance.now()-E);t(O),n({kind:"ok",text:`Drew ${x} frame${x>1?"s":""} of ${h} × ${H} in ${O} ms`})}const M=U(JSON.stringify([o,T,S]),()=>k(o,T,S),900);return I.jsxs(V,{code:o,onCode:e=>(r(e),u("edited")),examples:N,example:i,onExample:e=>{const f=N.find(x=>x.id===e);f&&(u(e),r(f.code))},onRun:M,status:m,printed:l,children:[I.jsx("canvas",{ref:s,className:"fill-canvas"}),I.jsxs(Y,{children:[I.jsx(Z,{label:"Grid",value:T,options:Object.entries(q).map(([e,f])=>({value:e,label:f.label})),onChange:z}),I.jsx(L,{label:"Frames",value:S,min:1,max:16,onChange:W}),I.jsx(L,{label:"Playback",value:F,min:1,max:24,onChange:e=>{var f;return y(e),(f=p())==null?void 0:f.setFps(e)},format:e=>e+" fps"}),I.jsx(K,{items:[["Last run",j?j+" ms":"–"]]})]}),I.jsx(X,{tools:[{id:"play",label:$?"Pause":"Play",onClick:()=>{var e;return A(!$),(e=p())==null?void 0:e.play(!$)}}],hint:"Click to step a frame"})]})}export{N as EXAMPLES,ue as default};
