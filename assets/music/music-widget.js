var MusicWidget=function(o){"use strict";class m{constructor(){this.listeners={}}on(t,e){const i=this.listeners[t]??new Set;return i.add(e),this.listeners[t]=i,()=>this.off(t,e)}off(t,e){var i;(i=this.listeners[t])==null||i.delete(e)}emit(t,e){var i;(i=this.listeners[t])==null||i.forEach(s=>s(e))}}class g{constructor(){this.tracks=[],this.order=[],this.cursor=-1,this.shuffle=!1,this.repeat="off"}setTracks(t){this.tracks=t,this.rebuildOrder(),this.cursor=t.length>0?0:-1}getTracks(){return this.tracks}get length(){return this.tracks.length}get currentIndex(){return this.cursor===-1?-1:this.order[this.cursor]}get currentTrack(){const t=this.currentIndex;return t===-1?null:this.tracks[t]??null}setShuffle(t){if(this.shuffle===t)return;const e=this.currentIndex;this.shuffle=t,this.rebuildOrder(e)}setRepeat(t){this.repeat=t}jumpTo(t){const e=this.order.indexOf(t);return e===-1?!1:(this.cursor=e,!0)}next(t=!1){return this.tracks.length===0?null:!t&&this.repeat==="one"?this.currentTrack:this.cursor+1<this.order.length?(this.cursor+=1,this.currentTrack):this.repeat==="all"||t?(this.shuffle&&this.rebuildOrder(),this.cursor=this.order.length>0?0:-1,this.currentTrack):null}previous(){return this.tracks.length===0?null:this.cursor>0?(this.cursor-=1,this.currentTrack):this.repeat==="all"?(this.cursor=this.order.length-1,this.currentTrack):this.currentTrack}rebuildOrder(t=-1){const e=this.tracks.map((i,s)=>s);if(this.shuffle)for(let i=e.length-1;i>0;i-=1){const s=Math.floor(Math.random()*(i+1));[e[i],e[s]]=[e[s],e[i]]}if(this.order=e,t!==-1){const i=this.order.indexOf(t);this.cursor=i===-1?0:i}}}class f extends m{constructor(){super(),this.playlist=new g,this.wantsPlaying=!1,this.audio=new Audio,this.audio.preload="metadata",this.bindAudioEvents()}bindAudioEvents(){this.audio.addEventListener("play",()=>this.emit("play",void 0)),this.audio.addEventListener("pause",()=>this.emit("pause",void 0)),this.audio.addEventListener("timeupdate",()=>{this.emit("timeupdate",{currentTime:this.audio.currentTime,duration:Number.isFinite(this.audio.duration)?this.audio.duration:0})}),this.audio.addEventListener("volumechange",()=>{this.emit("volumechange",{volume:this.audio.volume,muted:this.audio.muted})}),this.audio.addEventListener("ended",()=>{this.emit("ended",void 0),this.advance(!1)}),this.audio.addEventListener("error",()=>{var t;this.emit("error",{message:((t=this.audio.error)==null?void 0:t.message)??"Playback error",track:this.playlist.currentTrack})})}load(t,e=0){if(this.playlist.setTracks(t),this.emit("queuechange",{tracks:t}),t.length===0){this.audio.removeAttribute("src"),this.emit("trackchange",{track:null,index:-1});return}this.playlist.jumpTo(Math.min(Math.max(e,0),t.length-1)),this.loadCurrentTrack()}loadCurrentTrack(t=this.wantsPlaying){const e=this.playlist.currentTrack;this.emit("trackchange",{track:e,index:this.playlist.currentIndex}),e&&(this.audio.src=e.src,this.audio.load(),t&&this.audio.play().catch(()=>{}))}play(){this.wantsPlaying=!0,this.audio.play().catch(t=>{this.emit("error",{message:String(t),track:this.playlist.currentTrack})})}pause(){this.wantsPlaying=!1,this.audio.pause()}toggle(){this.audio.paused?this.play():this.pause()}advance(t){if(!this.playlist.next(t)){this.wantsPlaying=!1,this.emit("trackchange",{track:null,index:-1});return}this.loadCurrentTrack(t?this.wantsPlaying:!0)}next(){this.advance(!0)}previous(){if(this.audio.currentTime>3){this.seek(0);return}this.playlist.previous()&&this.loadCurrentTrack(this.wantsPlaying)}playAt(t){this.playlist.jumpTo(t)&&(this.wantsPlaying=!0,this.loadCurrentTrack(!0))}seek(t){this.audio.currentTime=Math.max(0,Math.min(t,this.audio.duration||t))}setVolume(t){this.audio.volume=Math.max(0,Math.min(1,t))}setMuted(t){this.audio.muted=t}setShuffle(t){this.playlist.setShuffle(t)}setRepeat(t){this.playlist.setRepeat(t)}getState(){return{track:this.playlist.currentTrack,index:this.playlist.currentIndex,isPlaying:!this.audio.paused,currentTime:this.audio.currentTime,duration:Number.isFinite(this.audio.duration)?this.audio.duration:0,volume:this.audio.volume,muted:this.audio.muted,shuffle:this.playlist.shuffle,repeat:this.playlist.repeat}}destroy(){this.audio.pause(),this.audio.removeAttribute("src"),this.audio.load()}}const y=`
:host {
  all: initial;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --mp-bg: #1c1c1e;
  --mp-bg-hover: #26262a;
  --mp-border: #2c2c30;
  --mp-text: #f2f2f5;
  --mp-text-dim: #9a9aa2;
  --mp-accent: #6c5ce7;
  color-scheme: dark;
}

* {
  box-sizing: border-box;
}

.dock {
  position: fixed;
  z-index: 2147483000;
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 280px;
}

.dock[data-position="bottom-right"] { bottom: 20px; right: 20px; align-items: flex-end; }
.dock[data-position="bottom-left"] { bottom: 20px; left: 20px; align-items: flex-start; }
.dock[data-position="top-right"] { top: 20px; right: 20px; align-items: flex-end; }
.dock[data-position="top-left"] { top: 20px; left: 20px; align-items: flex-start; }

.card {
  width: 100%;
  background: var(--mp-bg);
  border: 1px solid var(--mp-border);
  border-radius: 14px;
  padding: 12px;
  color: var(--mp-text);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
}

.card-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.art,
.art-placeholder {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  object-fit: cover;
  flex-shrink: 0;
}

.art-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--mp-bg-hover);
  color: var(--mp-text-dim);
}

.meta {
  min-width: 0;
  flex: 1;
}

.title {
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.artist {
  font-size: 11px;
  color: var(--mp-text-dim);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.buttons {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

button.icon {
  background: none;
  border: none;
  color: var(--mp-text);
  cursor: pointer;
  font-size: 15px;
  padding: 6px;
  border-radius: 6px;
  line-height: 1;
}

button.icon:hover {
  background: var(--mp-bg-hover);
}

.progress-track {
  margin-top: 10px;
  height: 3px;
  border-radius: 2px;
  background: var(--mp-border);
  overflow: hidden;
  cursor: pointer;
}

.progress-fill {
  height: 100%;
  background: var(--mp-accent);
  width: 0%;
}

.badge {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--mp-text-dim);
  margin-bottom: 6px;
}

/* Toast */
.toast {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  background: var(--mp-bg);
  border: 1px solid var(--mp-border);
  border-radius: 12px;
  padding: 10px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
}

.toast-entering {
  animation: mp-slide-in 0.35s ease-out;
}

.toast-leaving {
  animation: mp-slide-out 0.35s ease-in forwards;
}

.dock[data-position$="left"] .toast-entering { animation-name: mp-slide-in-left; }
.dock[data-position$="left"] .toast-leaving { animation-name: mp-slide-out-left; }

@keyframes mp-slide-in {
  from { transform: translateX(120%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
@keyframes mp-slide-out {
  from { transform: translateX(0); opacity: 1; }
  to { transform: translateX(120%); opacity: 0; }
}
@keyframes mp-slide-in-left {
  from { transform: translateX(-120%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
@keyframes mp-slide-out-left {
  from { transform: translateX(0); opacity: 1; }
  to { transform: translateX(-120%); opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .toast-entering, .toast-leaving { animation: none; }
}

.toast-eyebrow {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--mp-accent);
  font-weight: 600;
}

.toast-title {
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.toast-artist {
  font-size: 11px;
  color: var(--mp-text-dim);
}

.hint {
  font-size: 11px;
  color: var(--mp-text-dim);
  text-align: center;
  padding: 4px 0 0;
}
`,x=["bottom-right","bottom-left","top-right","top-left"],l=4500;function v(r){return Array.isArray(r)&&r.every(t=>t&&typeof t=="object"&&typeof t.id=="string"&&typeof t.title=="string"&&typeof t.src=="string")}class d extends HTMLElement{constructor(){super(),this.engine=new f,this.unsubscribers=[],this.seenFirstTrackChange=!1,this.toastTimers=[],this.root=this.attachShadow({mode:"open"})}static get observedAttributes(){return["playlist-src","position","accent"]}connectedCallback(){this.render(),this.bindEngineEvents(),this.loadPlaylist()}disconnectedCallback(){this.unsubscribers.forEach(t=>t()),this.toastTimers.forEach(t=>window.clearTimeout(t)),this.engine.destroy()}attributeChangedCallback(t,e,i){e!==i&&(t==="position"&&this.dockEl&&(this.dockEl.dataset.position=this.getPosition()),t==="accent"&&this.root.host&&this.style.setProperty("--mp-accent",i||"#6c5ce7"),t==="playlist-src"&&this.dockEl&&this.loadPlaylist())}getPosition(){const t=this.getAttribute("position");return t&&x.includes(t)?t:"bottom-right"}render(){const t=document.createElement("style");t.textContent=y;const e=document.createElement("div");e.className="dock",e.dataset.position=this.getPosition();const i=document.createElement("div");i.id="toast-slot",e.appendChild(i);const s=document.createElement("div");s.className="card",s.innerHTML=`
      <div class="badge">Now playing</div>
      <div class="card-row">
        <div class="art-placeholder" id="art">&#9834;</div>
        <div class="meta">
          <div class="title" id="title">Loading playlist&hellip;</div>
          <div class="artist" id="artist"></div>
        </div>
        <div class="buttons">
          <button class="icon" data-action="prev" title="Previous">&#9198;</button>
          <button class="icon" data-action="toggle" title="Play">&#9654;</button>
          <button class="icon" data-action="next" title="Next">&#9197;</button>
        </div>
      </div>
      <div class="progress-track" id="progress-track"><div class="progress-fill" id="progress-fill"></div></div>
      <div class="hint" id="hint"></div>
    `,e.appendChild(s),this.root.replaceChildren(t,e),this.dockEl=e,this.toastSlotEl=i,this.artEl=s.querySelector("#art"),this.titleEl=s.querySelector("#title"),this.artistEl=s.querySelector("#artist"),this.toggleBtn=s.querySelector('[data-action="toggle"]'),this.progressFillEl=s.querySelector("#progress-fill"),this.progressTrackEl=s.querySelector("#progress-track"),this.hintEl=s.querySelector("#hint");const n=this.getAttribute("accent");n&&this.style.setProperty("--mp-accent",n),s.querySelector('[data-action="toggle"]').addEventListener("click",()=>this.engine.toggle()),s.querySelector('[data-action="next"]').addEventListener("click",()=>this.engine.next()),s.querySelector('[data-action="prev"]').addEventListener("click",()=>this.engine.previous()),this.progressTrackEl.addEventListener("click",a=>{const u=this.progressTrackEl.getBoundingClientRect(),b=(a.clientX-u.left)/u.width,p=this.engine.getState().duration;p>0&&this.engine.seek(b*p)})}async loadPlaylist(){const t=this.getAttribute("playlist-src");if(!t){this.titleEl.textContent="Missing playlist-src attribute";return}try{const e=new URL(t,document.baseURI).toString(),i=await fetch(e);if(!i.ok)throw new Error(`HTTP ${i.status}`);const s=await i.json();if(!v(s))throw new Error("Playlist JSON must be an array of {id, title, src}");this.engine.load(s,0),this.hintEl.textContent=s.length===0?"Playlist is empty":""}catch(e){this.titleEl.textContent="Couldn't load playlist",this.hintEl.textContent=e instanceof Error?e.message:String(e)}}bindEngineEvents(){this.unsubscribers.push(this.engine.on("trackchange",({track:t})=>{this.updateNowPlaying(t),t&&this.seenFirstTrackChange&&this.showToast(t),this.seenFirstTrackChange=!0}),this.engine.on("play",()=>{this.toggleBtn.innerHTML="&#9208;",this.toggleBtn.title="Pause"}),this.engine.on("pause",()=>{this.toggleBtn.innerHTML="&#9654;",this.toggleBtn.title="Play"}),this.engine.on("timeupdate",({currentTime:t,duration:e})=>{const i=e>0?t/e*100:0;this.progressFillEl.style.width=`${i}%`}),this.engine.on("error",({message:t})=>{this.hintEl.textContent=t}))}buildArtEl(t,e){if(t){const s=document.createElement("img");return s.className=e,s.src=t,s.alt="",s}const i=document.createElement("div");return i.className=`${e==="art"?"art-placeholder":e}`,i.textContent="♪",i}updateNowPlaying(t){this.titleEl.textContent=(t==null?void 0:t.title)??"Nothing queued",this.artistEl.textContent=(t==null?void 0:t.artist)??"";const e=this.buildArtEl(t==null?void 0:t.artwork,"art");e.id="art",this.artEl.replaceWith(e),this.artEl=e}showToast(t){this.toastTimers.forEach(a=>window.clearTimeout(a)),this.toastTimers=[];const e=document.createElement("div");e.className="toast toast-entering",e.setAttribute("role","status"),e.setAttribute("aria-live","polite"),e.appendChild(this.buildArtEl(t.artwork,"art"));const i=document.createElement("div");i.className="meta";const s=document.createElement("div");s.className="toast-eyebrow",s.textContent="Now playing",i.appendChild(s);const n=document.createElement("div");if(n.className="toast-title",n.textContent=t.title,i.appendChild(n),t.artist){const a=document.createElement("div");a.className="toast-artist",a.textContent=t.artist,i.appendChild(a)}e.appendChild(i),this.toastSlotEl.replaceChildren(e),this.toastTimers.push(window.setTimeout(()=>e.classList.replace("toast-entering","toast-leaving"),l),window.setTimeout(()=>e.remove(),l+400))}}customElements.get("music-widget")||customElements.define("music-widget",d);const c=document.currentScript;function h(r){const t=r==null?void 0:r.dataset.playlist;if(!t||document.querySelector("music-widget"))return;const e=document.createElement("music-widget");e.setAttribute("playlist-src",t),r!=null&&r.dataset.position&&e.setAttribute("position",r.dataset.position),r!=null&&r.dataset.accent&&e.setAttribute("accent",r.dataset.accent),document.body.appendChild(e)}return document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>h(c)):h(c),o.MusicWidgetElement=d,Object.defineProperty(o,Symbol.toStringTag,{value:"Module"}),o}({});
