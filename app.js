(function(){
  const canvas=document.getElementById("particles-canvas"); if(!canvas) return;
  const ctx=canvas.getContext("2d"), dpr=Math.min(window.devicePixelRatio||1,2);
  let W=0,H=0, particles=[], raf=0, cursor={x:-9999,y:-9999};
  const conf={densityBase:.0001,maxSpeed:.35,size:[1.2,2.4],linkDist:110,linkAlpha:.12};

  function rand(a,b){return a+Math.random()*(b-a)}
  function resize(){
    const w=window.innerWidth, h=window.innerHeight;
    W=canvas.width=Math.floor(w*dpr); H=canvas.height=Math.floor(h*dpr);
    canvas.style.width=w+"px"; canvas.style.height=h+"px";
    const n=Math.floor(W*H*conf.densityBase/(dpr*dpr));
    particles.length=0;
    for(let i=0;i<n;i++){
      particles.push({x:Math.random()*W,y:Math.random()*H,vx:rand(-conf.maxSpeed,conf.maxSpeed),vy:rand(-conf.maxSpeed,conf.maxSpeed),r:rand(conf.size[0],conf.size[1])*dpr});
    }
  }
  function step(){
    ctx.clearRect(0,0,W,H);
    for(const p of particles){
      p.x+=p.vx; p.y+=p.vy;
      if(p.x<0||p.x>W) p.vx*=-1;
      if(p.y<0||p.y>H) p.vy*=-1;
      const dx=p.x-cursor.x, dy=p.y-cursor.y, dd=dx*dx+dy*dy;
      if(dd<19600*dpr*dpr){const ax=-.0008*dx; p.vx+=ax*dx; p.vy+=ax*dy;}
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,2*Math.PI); ctx.fillStyle="rgba(255,255,255,0.6)"; ctx.fill();
    }
    for(let i=0;i<particles.length;i++){
      const a=particles[i];
      for(let j=i+1;j<particles.length;j++){
        const b=particles[j], dx=a.x-b.x, dy=a.y-b.y, d=Math.hypot(dx,dy);
        if(d<conf.linkDist*dpr){
          const alpha=(1-d/(conf.linkDist*dpr))*conf.linkAlpha;
          ctx.strokeStyle=`rgba(124,242,211,${alpha})`; ctx.lineWidth=.7*dpr;
          ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
        }
      }
    }
    raf=requestAnimationFrame(step);
  }
  function move(e){
    if(e.touches&&e.touches[0]){cursor.x=e.touches[0].clientX*dpr; cursor.y=e.touches[0].clientY*dpr;}
    else{cursor.x=(e.clientX??-9999)*dpr; cursor.y=(e.clientY??-9999)*dpr;}
  }
  function leave(){cursor.x=cursor.y=-9999}

  window.addEventListener("resize",resize,{passive:true});
  window.addEventListener("mousemove",move,{passive:true});
  window.addEventListener("touchmove",move,{passive:true});
  window.addEventListener("mouseleave",leave,{passive:true});
  resize(); cancelAnimationFrame(raf); raf=requestAnimationFrame(step);
})();

document.addEventListener("DOMContentLoaded",function(){
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));

  const configToggle=$("#config-toggle"), luxToggle=$("#lux-toggle"), modeSelect=$("#mode-select"), dpiSelect=$("#dpi-select"), activateBtn=$("#activate-btn");
  const fixRungToggle=$("#fix-rung-toggle"), nheTamToggle=$("#nhe-tam-toggle"), lockDauToggle=$("#lock-dau-toggle");
  const cnMasterToggle=$("#cn-master-toggle"), antiRungProToggle=$("#anti-rung-pro"), aimAssistPlusToggle=$("#aim-assist-plus");
  const announce=$("#announce-bar"), announceClose=$("#announce-close");
  const menuBtn=$("#special-menu-btn"), menu=$("#special-menu"), backdrop=$("#modal-backdrop"), menuClose=$("#modal-close"), info=$("#modal-infobox"), infoClose=$("#infobox-close"), applyBtn=$("#modal-apply");
  const f1=$("#f-anti-shake"), f2=$("#f-aim-assist"), f3=$("#f-touch-boost"), f4=$("#f-pro-mode");
  const footer=$("#site-footer");

  const notice=$("#site-notice"), noticeList=$("#notice-list"), nClose=$("#notice-close"), nOk=$("#notice-ok"), n3h=$("#notice-3h"), nBackdrop=$("#notice-backdrop");
  let gameModalTimer=0;
  let gameModal=null;
  const ANDROID=/Android/i.test(navigator.userAgent);
  const IOS=/iPhone|iPad|iPod/i.test(navigator.userAgent);
  const FF_PLAY="https://play.google.com/store/apps/details?id=com.dts.freefireth";
  const FFM_PLAY="https://play.google.com/store/apps/details?id=com.dts.freefiremax";
  const FF_APPSTORE="https://apps.apple.com/vn/app/free-fire/id1300146617";
  const FFM_APPSTORE="https://apps.apple.com/vn/app/free-fire-max/id1480516829";

  const store={
    get(k,def){try{const v=localStorage.getItem(k);return v===null?def:JSON.parse(v)}catch(e){return def}},
    set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}
  };

  function toast(msg){
    let el=document.querySelector(".toast");
    if(!el){el=document.createElement("div");el.className="toast";el.setAttribute("role","status");el.setAttribute("aria-live","polite");document.body.appendChild(el)}
    el.textContent=msg; el.classList.add("show"); clearTimeout(toast._t); toast._t=setTimeout(()=>el.classList.remove("show"),2200);
  }
  function pulse(el){el&&el.animate([{transform:"scale(1)"},{transform:"scale(1.03)"},{transform:"scale(1)"}],{duration:260,easing:"ease-out"})}
  const RETICLE_CLASS="hide-center-reticle";
  function ensureReticleStyle(){
    if(document.getElementById("reticle-style")) return;
    const style=document.createElement("style");
    style.id="reticle-style";
    style.textContent="."+RETICLE_CLASS+" #ui_center_lock_nudge{display:none!important;}";
    document.head.appendChild(style);
  }
  let reticleObserver=null;
  function hideCenterReticleFallback(){
    const el=document.getElementById("ui_center_lock_nudge");
    if(el){el.style.display="none"; return;}
    const cx=window.innerWidth/2, cy=window.innerHeight/2;
    const stack=document.elementsFromPoint(cx,cy);
    for(const node of stack){
      if(!(node instanceof HTMLElement)) continue;
      if(node===document.body||node===document.documentElement) continue;
      if(node.id==="particles-canvas") continue;
      if(node.closest&&node.closest(".container")) continue;
      node.style.display="none";
      return;
    }
    document.querySelectorAll("body *").forEach((node)=>{
      if(!(node instanceof HTMLElement)) return;
      const rect=node.getBoundingClientRect();
      if(rect.width>80||rect.height>80||rect.width<4||rect.height<4) return;
      const dx=Math.abs((rect.left+rect.width/2)-cx);
      const dy=Math.abs((rect.top+rect.height/2)-cy);
      if(dx>3||dy>3) return;
      const cs=getComputedStyle(node);
      if(cs.position!=="fixed"&&cs.position!=="absolute") return;
      node.style.display="none";
    });
  }
  function setCenterReticleHidden(on){
    ensureReticleStyle();
    document.body.classList.toggle(RETICLE_CLASS,!!on);
    if(on){
      hideCenterReticleFallback();
      if(!reticleObserver){
        reticleObserver=new MutationObserver(()=>hideCenterReticleFallback());
        reticleObserver.observe(document.body,{childList:true,subtree:true});
      }
    }else if(reticleObserver){
      reticleObserver.disconnect();
      reticleObserver=null;
    }
  }

  (function(){
    const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return;
    const ctx=new AC(), vol=0.32;
    function chime(){
      if(ctx.state==="suspended") ctx.resume();
      const now=ctx.currentTime;
      function note(freq,dt,dur){
        const o=ctx.createOscillator(), g=ctx.createGain();
        o.type="sine"; o.frequency.value=freq; o.connect(g); g.connect(ctx.destination);
        const t0=now+dt, t1=t0+dur;
        g.gain.setValueAtTime(0,t0); g.gain.linearRampToValueAtTime(vol,t0+0.01); g.gain.exponentialRampToValueAtTime(0.0001,t1);
        o.start(t0); o.stop(t1+0.02);
      }
      note(1568,0.00,0.12); note(1976,0.08,0.12);
    }
    function bind(el,ev){ if(el) el.addEventListener(ev,chime,{passive:true}); }
    bind(configToggle,"change"); bind(luxToggle,"change"); bind(activateBtn,"click"); bind(applyBtn,"click");
    bind(f1,"change"); bind(f2,"change"); bind(f3,"change"); bind(f4,"change");
    bind($("#cm-btn-ram"),"click"); bind($("#cm-btn-cpu"),"click"); bind($("#cm-btn-fps"),"click");
    $$(".toggle-label,.btn-primary,.special-menu-btn").forEach(el=>el.addEventListener("click",chime,{passive:true}));
  })();

  function reflect(){
    $$(".toggle-switch").forEach(sw=>{
      const input=sw.querySelector(".toggle-input"), item=sw.closest(".function-item");
      if(!input||!item) return;
      item.dataset.state=input.checked?"on":"off";
      item.style.borderColor=input.checked?"rgba(34,197,94,.6)":"rgba(255,255,255,.06)";
    });
  }
  function runAction(key,on){
    const actions=window.PanelActions||{};
    const entry=actions[key];
    if(!entry) return;
    const fn=on?entry.on:entry.off;
    if(typeof fn==="function") fn();
  }
  function applyMode(v){document.body.dataset.mode=v}
  function applyDpi(v){document.body.dataset.dpi=v}
  function label(v){if(v==="muot-ma")return"Mượt Mà"; if(v==="cao-cap")return"Cao Cấp"; if(v==="tieu-chuan")return"Tiêu Chuẩn"; return v}

  function restore(){
    const ce=store.get("config-enabled",false), le=store.get("lux-enabled",false), m=store.get("mode","muot-ma"), d=store.get("dpi","1.0");
    const fr=store.get("fix-rung-enabled",false), nt=store.get("nhe-tam-enabled",false), ld=store.get("lock-dau-enabled",false);
    const cm=store.get("cn-master-enabled",false), ar=store.get("anti-rung-pro-enabled",false), ap=store.get("aim-assist-plus-enabled",false);
    if(configToggle) configToggle.checked=!!ce;
    if(luxToggle) luxToggle.checked=!!le;
    if(fixRungToggle) fixRungToggle.checked=!!fr;
    if(nheTamToggle) nheTamToggle.checked=!!nt;
    if(lockDauToggle) lockDauToggle.checked=!!ld;
    if(cnMasterToggle) cnMasterToggle.checked=!!cm;
    if(antiRungProToggle) antiRungProToggle.checked=!!ar;
    if(aimAssistPlusToggle) aimAssistPlusToggle.checked=!!ap;
    if(modeSelect) modeSelect.value=m;
    if(dpiSelect) dpiSelect.value=d;
    applyMode(m); applyDpi(d); reflect();
    if(configToggle) runAction("config",configToggle.checked);
    if(luxToggle) runAction("lux",luxToggle.checked);
    if(fixRungToggle) runAction("fixRung",fixRungToggle.checked);
    if(nheTamToggle) runAction("nheTam",nheTamToggle.checked);
    if(lockDauToggle) runAction("lockDau",lockDauToggle.checked);
    if(nheTamToggle) setCenterReticleHidden(nheTamToggle.checked);

    const a1=store.get("feat-anti-shake",false),a2=store.get("feat-aim-assist",false),a3=store.get("feat-touch-boost",false),a4=store.get("feat-pro-mode",false);
    if(f1) f1.checked=!!a1; if(f2) f2.checked=!!a2; if(f3) f3.checked=!!a3; if(f4) f4.checked=!!a4;
  }

  function showBar(){announce&&announce.classList.remove("hidden")}
  function hideBar(){announce&&announce.classList.add("hidden"); store.set("announcement-dismissed",true)}

  function setFooter(){
    const b64="QCAyMDI1IELhuqNuIHF1eeG7gW4gREVWIENISSBDVU9ORw==";
    function dec(s){const bin=atob(s), arr=[]; for(let i=0;i<bin.length;i++) arr.push("%"+("00"+bin.charCodeAt(i).toString(16)).slice(-2)); return decodeURIComponent(arr.join("")); }
    if(footer) footer.textContent=dec(b64);
  }
  function openNotice(){buildNotice(); notice.classList.remove("hidden"); notice.setAttribute("aria-hidden","false")}
  function closeNotice(){notice.classList.add("hidden"); notice.setAttribute("aria-hidden","true")}
  function closeNotice3h(){store.set("notice-until",Date.now()+3*60*60*1000); closeNotice()}
  function maybeShowNotice(){const until=store.get("notice-until",0); if(Date.now()>Number(until)) openNotice()}

  function openMenu(){menu&&menu.classList.remove("hidden"); menu&&menu.setAttribute("aria-hidden","false"); toast("FUNCTION PANEL ĐÃ MỞ"); if(!store.get("menuNoticeSeen",false)){openNotice(); store.set("menuNoticeSeen",true)}}
  function closeMenu(){menu&&menu.classList.add("hidden"); menu&&menu.setAttribute("aria-hidden","true")}
  function hideInfo(){info&&info.classList.add("hidden")}
  function showNotification(message){
    toast(message);
  }
  function playLaunchTone(){
    try{
      const AC=window.AudioContext||window.webkitAudioContext;
      if(!AC) return;
      const ctx=new AC(), o=ctx.createOscillator(), g=ctx.createGain(), t=ctx.currentTime;
      o.type="sine"; o.frequency.value=1100;
      g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(.18,t+.02); g.gain.exponentialRampToValueAtTime(.001,t+.16);
      o.connect(g).connect(ctx.destination); o.start(t); o.stop(t+.17);
    }catch(e){}
  }
  function openSupportModal(){}
  function closeSupportModal(){}
  function openFreeFire(){
    showNotification("Launching Free Fire...");
    playLaunchTone();
    setTimeout(()=>{window.location.href="freefireth://";},500);
  }
  function openFreeFireMax(){
    showNotification("Launching Free Fire MAX...");
    playLaunchTone();
    setTimeout(()=>{window.location.href="freefiremax://";},500);
  }
  if(typeof window!=="undefined"){
    Object.assign(window,{openFreeFire,openFreeFireMax,openSupportModal,closeSupportModal});
  }
  function ensureGameModal(){
    if(gameModal) return gameModal;
    const wrap=document.createElement("div");
    wrap.id="game-modal";
    wrap.className="modal hidden";
    wrap.setAttribute("aria-hidden","true");
    wrap.innerHTML=
      '<div class="modal-backdrop" id="game-modal-backdrop"></div>'+
      '<div class="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="game-modal-title">'+
        '<div class="modal-header">'+
          '<h3 id="game-modal-title"><i class="fas fa-gamepad"></i> Chọn phiên bản</h3>'+
          '<button class="modal-close" id="game-modal-close" aria-label="Đóng"><i class="fas fa-times"></i></button>'+
        '</div>'+
        '<div class="modal-body">'+
          '<div class="feature-list">'+
            '<button class="btn-primary" id="game-ff">Free Fire</button>'+
            '<button class="btn-primary" id="game-ffmax">Free Fire Max</button>'+
          '</div>'+
        '</div>'+
      '</div>';
    document.body.appendChild(wrap);
    const close=()=>{wrap.classList.add("hidden"); wrap.setAttribute("aria-hidden","true")};
    $("#game-modal-backdrop",wrap)?.addEventListener("click",close);
    $("#game-modal-close",wrap)?.addEventListener("click",close);
    $("#game-ff",wrap)?.addEventListener("click",()=>{close(); openFreeFire();});
    $("#game-ffmax",wrap)?.addEventListener("click",()=>{close(); openFreeFireMax();});
    gameModal=wrap;
    return wrap;
  }
  function openGameModal(){
    const wrap=ensureGameModal();
    wrap.classList.remove("hidden");
    wrap.setAttribute("aria-hidden","false");
  }

   if(configToggle) configToggle.addEventListener("change",()=>{store.set("config-enabled",configToggle.checked); reflect(); runAction("config",configToggle.checked); toast(configToggle.checked?"AIMLOCK : ON":"AIMLOCK : OFF")});
  if(luxToggle)    luxToggle.addEventListener("change",()=>{store.set("lux-enabled",luxToggle.checked); reflect(); runAction("lux",luxToggle.checked); toast(luxToggle.checked?"FEATHER AIM : ON":"FEATHER AIM : OFF")});
  if(fixRungToggle) fixRungToggle.addEventListener("change",()=>{store.set("fix-rung-enabled",fixRungToggle.checked); reflect(); runAction("fixRung",fixRungToggle.checked); toast(fixRungToggle.checked?"HEADSHOT FIX : ON":"HEADSHOT FIX : OFF")});
  if(nheTamToggle) nheTamToggle.addEventListener("change",()=>{store.set("nhe-tam-enabled",nheTamToggle.checked); reflect(); runAction("nheTam",nheTamToggle.checked); setCenterReticleHidden(nheTamToggle.checked); toast(nheTamToggle.checked?"SHAKE FIX : ON":"SHAKE FIX : OFF")});
  if(lockDauToggle) lockDauToggle.addEventListener("change",()=>{store.set("lock-dau-enabled",lockDauToggle.checked); reflect(); runAction("lockDau",lockDauToggle.checked); toast(lockDauToggle.checked?"DRIFT FIX : ON":"DRIFT FIX : OFF")});
  if(cnMasterToggle) cnMasterToggle.addEventListener("change",()=>{store.set("cn-master-enabled",cnMasterToggle.checked); reflect(); toast(cnMasterToggle.checked?" SENSIVITY BOOSTER : ON":"SENSIVITY BOOSTER : OFF")});
  if(antiRungProToggle) antiRungProToggle.addEventListener("change",()=>{store.set("anti-rung-pro-enabled",antiRungProToggle.checked); reflect(); toast(antiRungProToggle.checked?"SCREEN BOOSTER : ON":"SCREEN BOOSTER : OFF")});
  if(aimAssistPlusToggle) aimAssistPlusToggle.addEventListener("change",()=>{store.set("aim-assist-plus-enabled",aimAssistPlusToggle.checked); reflect(); toast(aimAssistPlusToggle.checked?"ANCHOR AIM : ON":"ANCHOR AIM : OFF")});
  $$(".toggle-input").forEach(input=>{
    input.addEventListener("change",reflect);
  });
  if(modeSelect)   modeSelect.addEventListener("change",()=>{store.set("mode",modeSelect.value); applyMode(modeSelect.value); toast("Chế Độ : "+label(modeSelect.value))});
  if(dpiSelect)    dpiSelect.addEventListener("change",()=>{store.set("dpi",dpiSelect.value); applyDpi(dpiSelect.value); toast("DPI PANEL IOS : "+dpiSelect.value+"x")});
  if(activateBtn)  activateBtn.addEventListener("click",()=>{
    const s=[
      "DPI PANEL IOS: "+(configToggle&&configToggle.checked?"ON":"OFF"),
      "BUFF DPI X150: "+(luxToggle&&luxToggle.checked?"ON":"OFF"),
      "Mode: "+label(modeSelect&&modeSelect.value),
      "DPI PANEL IOS : "+(dpiSelect&&dpiSelect.value)+"x"
    ].join(" | ");
    toast("PANEL IOS ON | "+s); pulse(activateBtn);
    toast("Vui Lòng Chờ 2 Giây...");
    clearTimeout(gameModalTimer);
    gameModalTimer=setTimeout(openGameModal,2000);
  });

  if(announceClose) announceClose.addEventListener("click",hideBar);
  if(menuBtn)       menuBtn.addEventListener("click",openMenu);
  if(backdrop)      backdrop.addEventListener("click",closeMenu);
  if(menuClose)     menuClose.addEventListener("click",closeMenu);
  if(infoClose)     infoClose.addEventListener("click",hideInfo);
  if(applyBtn)      applyBtn.addEventListener("click",()=>{store.set("feat-anti-shake",!!f1&&f1.checked);store.set("feat-aim-assist",!!f2&&f2.checked);store.set("feat-touch-boost",!!f3&&f3.checked);store.set("feat-pro-mode",!!f4&&f4.checked); toast("ĐÃ ÁP DỤNG TINH CHỈNH FUNCTION PANEL"); closeMenu()});

  if(nClose)   nClose.addEventListener("click",closeNotice);
  if(nOk)      nOk.addEventListener("click",closeNotice);
  if(n3h)      n3h.addEventListener("click",closeNotice3h);
  if(nBackdrop)nBackdrop.addEventListener("click",closeNotice);

  (function(){
    const ann=document.getElementById("announce-bar")||document.querySelector(".announce");
    if(ann&&ann.classList.contains("hidden")) ann.style.display="none";
    const mc=document.querySelector(".main-content");
    if(mc){
      const first=mc.firstElementChild;
      if(first&&first.classList.contains("section")){
        first.style.marginTop="0"; first.style.paddingTop="12px";
      }
    }
  })();

  if(!store.get("announcement-dismissed",false)) showBar();
  setFooter(); restore(); maybeShowNotice();
});

(function(){
  const $=(id)=>document.getElementById(id);
  const consoleEl=$("cm-console");
  const cpuCanvas=$("cm-cpu-canvas");
  const ramCanvas=$("cm-ram-canvas");
  if(!consoleEl||!cpuCanvas||!ramCanvas) return;
  const cpuCtx=cpuCanvas.getContext("2d");
  const ramCtx=ramCanvas.getContext("2d");
  const hasPerfMem=!!(performance&&performance.memory&&performance.memory.usedJSHeapSize);
  $("cm-ram-src").textContent="Auto";

  function fmtMB(bytes){
    if(typeof bytes!=="number"||!isFinite(bytes)) return "--";
    return (bytes/(1024*1024)).toFixed(1)+" MB";
  }
  function clamp(v,min,max){return Math.max(min,Math.min(max,v))}
  function nowTime(){
    const d=new Date();
    const hh=String(d.getHours()).padStart(2,"0");
    const mm=String(d.getMinutes()).padStart(2,"0");
    const ss=String(d.getSeconds()).padStart(2,"0");
    return `${hh}:${mm}:${ss}`;
  }
  function log(msg,level="t"){
    const line=document.createElement("div");
    line.className="cm-logline cm-"+level;
    const time=document.createElement("span");
    time.className="cm-time";
    time.textContent=`[${nowTime()}] `;
    const text=document.createElement("span");
    text.className="cm-msg";
    text.textContent=msg;
    line.appendChild(time);
    line.appendChild(text);
    consoleEl.appendChild(line);
    consoleEl.scrollTop=consoleEl.scrollHeight;
    return line;
  }
  function setLineText(line,msg){
    const time=line.querySelector(".cm-time");
    const text=line.querySelector(".cm-msg");
    if(!time||!text){
      line.textContent=`[${nowTime()}] ${msg}`;
      return;
    }
    time.textContent=`[${nowTime()}] `;
    text.textContent=msg;
  }

  let junk=[];
  let busyWorkEnabled=false;
  let lockedFps=false;
  const targetFps=30;
  let cleanCpuStart=0;
  let cleanRamStart=0;
  const cleanEffectMs=3200;

  const N=180;
  const cpuSeries=Array(N).fill(0);
  const ramSeries=Array(N).fill(0);

  function drawWave(ctx,series,colorStroke,labelY){
    const w=ctx.canvas.width, h=ctx.canvas.height;
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle="rgba(0,0,0,0.18)";
    ctx.fillRect(0,0,w,h);
    ctx.strokeStyle="rgba(255,255,255,0.08)";
    ctx.lineWidth=1;
    ctx.beginPath();
    for(let i=1;i<=5;i++){
      const y=(h*i)/6;
      ctx.moveTo(0,y); ctx.lineTo(w,y);
    }
    for(let i=1;i<=10;i++){
      const x=(w*i)/11;
      ctx.moveTo(x,0); ctx.lineTo(x,h);
    }
    ctx.stroke();
    ctx.strokeStyle=colorStroke;
    ctx.lineWidth=2;
    ctx.beginPath();
    for(let i=0;i<series.length;i++){
      const x=(w*i)/(series.length-1);
      const y=h-(series[i]*(h-10))-5;
      if(i===0) ctx.moveTo(x,y);
      else ctx.lineTo(x,y);
    }
    ctx.stroke();
    ctx.fillStyle="rgba(255,255,255,0.85)";
    ctx.font="bold 12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";
    ctx.fillText(labelY,10,18);
  }

  let lastFrame=performance.now();
  let fps=0;
  let fpsSMA=0;
  let frameCount=0;
  let fpsWindowStart=performance.now();

  function estimateCpuLoadFromDelta(deltaMs){
    const ideal=16.67;
    const ratio=deltaMs/ideal;
    return clamp((ratio-0.9)/2.0,0,1);
  }
  function waveJitter(base,t,amp1,amp2,f1,f2,phase){
    const n=amp1*Math.sin(t*f1+phase)+amp2*Math.sin(t*f2+phase*0.6);
    return clamp(base+n,0,1);
  }
  function applyCleanEffect(value,t,startedAt){
    if(!startedAt) return value;
    const p=clamp((t-startedAt)/cleanEffectMs,0,1);
    if(p>=1) return value;
    const dip=p<0.3?0.05:0.05+(p-0.3)/0.7*(value-0.05);
    return clamp(dip,0,1);
  }

  function getRamValue01(t){
    if(hasPerfMem){
      const used=performance.memory.usedJSHeapSize;
      const limit=performance.memory.jsHeapSizeLimit||(used*1.2);
      const v=clamp(used/limit,0,1);
      $("cm-heap-used").textContent=fmtMB(used);
      $("cm-heap-limit").textContent=fmtMB(limit);
      const vWave=waveJitter(v,t,0.03,0.015,1.7,4.3,0.9);
      $("cm-ram-text").textContent=`${(vWave*100).toFixed(0)}%`;
      return vWave;
    }
    $("cm-heap-used").textContent="N/A";
    $("cm-heap-limit").textContent="N/A";
    const vSim=clamp(0.38+0.22*Math.sin(t*1.2+0.5)+0.08*Math.sin(t*2.9+1.1),0,1);
    $("cm-ram-text").textContent=`${(vSim*100).toFixed(0)}%`;
    return vSim;
  }

  let progressTimer=0;
  function getProgressDurationMs(){
    return 5000;
  }
  const codeLines={
    ram:[
      "mem::scan_pages()",
      "heap::compact()",
      "vm::gc_step()",
      "cache::drop_unused()",
      "mem::reclaim_blocks()",
      "alloc::defrag()",
      "mem::zero_fill()",
      "heap::sweep()",
      "mem::pressure_estimate()",
      "arena::trim()",
      "pool::rebalance()",
      "heap::coalesce()",
      "mmu::prefetch()",
      "pager::optimize()",
      "alloc::fastpath()"
    ],
    cpu:[
      "cpu::stabilize_clock()",
      "core::scheduler_tick()",
      "thread::rebalance()",
      "cpu::cooldown_profile()",
      "core::boost_limits()",
      "task::yield()",
      "pipeline::flush()",
      "irq::normalize()",
      "core::perf_sample()",
      "cpu::freq_curve()",
      "task::prioritize()",
      "core::load_balance()",
      "prefetch::warm()",
      "cpu::latency_tune()",
      "core::dispatch_opt()"
    ],
    fps:[
      "render::lock_vsync()",
      "frame::cap_rate()",
      "gfx::present_sync()",
      "timing::set_budget()",
      "frame::stable_clock()",
      "render::pipeline_reset()",
      "fps::limit_apply()",
      "vsync::adaptive()",
      "frame::queue_trim()",
      "gfx::swapchain_ready()",
      "render::frame_pacing()",
      "timing::drift_fix()",
      "frame::deadline_calc()",
      "vsync::phase_align()",
      "render::gpu_sync()"
    ]
  };
  const codeTokens={
    mod:["mem","heap","vm","cache","alloc","cpu","core","task","thread","gfx","render","frame","timing","vsync","io","net","sched","irq","bus","perf","trace"],
    verb:["scan","compact","sweep","rebalance","stabilize","optimize","normalize","flush","prefetch","warm","align","cap","tune","commit","probe","sample","resolve","sync"],
    obj:["pages","blocks","clock","pipeline","queue","budget","freq","latency","swapchain","frame","heap","gc","pacer","scheduler","targets","buffers","pools"],
    tag:["OK","PASS","READY","SYNC","LOCK","DONE","STABLE","OKAY"]
  };
  function randFrom(list){return list[Math.floor(Math.random()*list.length)]}
  function hex(n=4){return Math.floor(Math.random()*Math.pow(16,n)).toString(16).padStart(n,"0")}
  function genCodeLine(type){
    const list=codeLines[type]||codeLines.ram;
    const base=list[Math.floor(Math.random()*list.length)];
    const m=randFrom(codeTokens.mod);
    const v=randFrom(codeTokens.verb);
    const o=randFrom(codeTokens.obj);
    const t=randFrom(codeTokens.tag);
    const a=randFrom(codeTokens.mod);
    const b=randFrom(codeTokens.obj);
    const c=randFrom(codeTokens.tag);
    const pid=hex(2);
    const thr=hex(2);
    const mix=Math.random();
    if(mix<0.4) return `${base} :: ${m}.${v}(${o}) => ${a}.${v}(${b}) [${c}]`;
    if(mix<0.75) return `${m}::${v}_${o} [0x${hex(3)}:${pid}] thr:${thr} ${t}`;
    return `op.${m}.${v}(${o}) -> ${t} | trace:${a}.${v}(${b})`;
  }
  function pickRamLevel(){
    const levels=["g","w","e"];
    return levels[Math.floor(Math.random()*levels.length)];
  }
  function runProgress(label,type,opts={}){
    const lineLevel=opts.lineLevel||"g";
    const codeLevel=opts.codeLevel||"g";
    if(progressTimer) clearInterval(progressTimer);
    const line=log(`${label}: [--------------------] 0%`,lineLevel);
    const duration=getProgressDurationMs();
    const start=performance.now();
    const spins=["|","/","-","\\"];
    let si=0;
    let tick=0;
    progressTimer=setInterval(()=>{
      const elapsed=performance.now()-start;
      const pct=clamp(elapsed/duration,0,1);
      const p=Math.round(pct*100);
      const filled=Math.round(pct*20);
      const bar="["+"#".repeat(filled)+"-".repeat(20-filled)+"]";
      const spin=spins[si++%spins.length];
      setLineText(line,`${label} ${spin} ${bar} ${p}%`);
      consoleEl.scrollTop=consoleEl.scrollHeight;
      const code=genCodeLine(type);
      const level=typeof codeLevel==="function"?codeLevel():codeLevel;
      log(code,level);
      tick++;
      if(p>=100){
        clearInterval(progressTimer);
        progressTimer=0;
        setLineText(line,`${label} o" ${bar} 100%`);
      }
    },100);
  }
  $("cm-btn-ram").addEventListener("click",()=>{
    const before=junk.length;
    junk=[];
    cpuSeries.fill(0);
    ramSeries.fill(0);
    cleanRamStart=performance.now();
    log(`Dọn RAM (nội bộ trang): đã xoá ${before} khối dữ liệu giả lập + reset đồ thị.`,"i");
    runProgress("D?n RAM","ram",{codeLevel:pickRamLevel});
  });
  $("cm-btn-cpu").addEventListener("click",()=>{
    busyWorkEnabled=false;
    cleanCpuStart=performance.now();
    log("Dọn CPU (nội bộ trang): tắt tác vụ giả lập gây tải CPU.","i");
    runProgress("D?n CPU","cpu",{codeLevel:pickRamLevel});
  });
  $("cm-btn-fps").addEventListener("click",()=>{
    lockedFps=!lockedFps;
    $("cm-btn-fps").textContent=`Lock FPS: ${lockedFps?"ON":"OFF"}`;
    $("cm-btn-fps").classList.toggle("is-on",lockedFps);
    $("cm-mode-now").textContent=lockedFps?`Locked ${targetFps}`:"Unlocked";
    log(lockedFps?`Bật lock FPS ở ${targetFps} FPS.`:"Tắt lock FPS (requestAnimationFrame chạy tự do).","i");
    runProgress(lockedFps?"Lock FPS":"Unlock FPS","fps",{codeLevel:pickRamLevel});
  });
  cpuCanvas.addEventListener("dblclick",()=>{
    busyWorkEnabled=!busyWorkEnabled;
    log(busyWorkEnabled?"Bật giả lập tải CPU (demo). Double-click lại để tắt.":"Tắt giả lập tải CPU.",busyWorkEnabled?"w":"i");
  });

  function doBusyWork(ms=6){
    const start=performance.now();
    let x=0;
    while(performance.now()-start<ms){
      x=Math.sin(x+Math.random());
    }
    return x;
  }

  let lastTick=performance.now();
  function loop(t){
    const delta=t-lastFrame;
    lastFrame=t;
    frameCount++;
    const elapsed=t-fpsWindowStart;
    if(elapsed>=500){
      fps=(frameCount*1000)/elapsed;
      fpsWindowStart=t;
      frameCount=0;
      fpsSMA=fpsSMA?(fpsSMA*0.7+fps*0.3):fps;
      $("cm-fps-now").textContent=fpsSMA.toFixed(1);
    }
    if(busyWorkEnabled){
      doBusyWork(8);
      if(Math.random()<0.06){
        junk.push(new Array(50000).fill(Math.random()));
        if(junk.length>20) junk.shift();
      }
    }
    if(t-lastTick>=50){
      lastTick=t;
      const tSec=t/1000;
      let cpuLoad=waveJitter(estimateCpuLoadFromDelta(delta),tSec,0.05,0.02,2.6,6.2,0.2);
      cpuLoad=applyCleanEffect(cpuLoad,t,cleanCpuStart);
      cpuSeries.push(cpuLoad);
      cpuSeries.shift();
      let ramV=getRamValue01(tSec);
      ramV=applyCleanEffect(ramV,t,cleanRamStart);
      ramSeries.push(ramV);
      ramSeries.shift();
      $("cm-cpu-text").textContent=`${(cpuLoad*100).toFixed(0)}%`;
      drawWave(cpuCtx,cpuSeries,"rgba(85,255,176,0.95)","CPU Wave");
      drawWave(ramCtx,ramSeries,"rgba(106,166,255,0.95)","RAM Wave");
    }
    if(lockedFps){
      const interval=1000/targetFps;
      setTimeout(()=>requestAnimationFrame(loop),Math.max(0,interval-(performance.now()-t)));
    }else{
      requestAnimationFrame(loop);
    }
  }

  log("Khởi động monitor. Double-click lên chart CPU để bật/tắt giả lập tải CPU.","t");
  requestAnimationFrame(loop);
})();
(function(){
  var OFF_KEYS=[
  "config-enabled",
  "lux-enabled",
  "fix-rung-enabled",
  "nhe-tam-enabled",
  "lock-dau-enabled",
  "cn-master-enabled",
  "anti-rung-pro-enabled",
  "aim-assist-plus-enabled",
  "feat-anti-shake",
  "feat-aim-assist",
  "feat-touch-boost",
  "feat-pro-mode"
];
  var STATE_KEYS=["config-enabled","lux-enabled","fix-rung-enabled","nhe-tam-enabled","lock-dau-enabled","feat-anti-shake","feat-aim-assist","feat-touch-boost","feat-pro-mode"];
  var DEF={mode:"muot-ma",dpi:"1.0"};
  function G(k,d){try{var v=localStorage.getItem(k);return v===null?d:JSON.parse(v)}catch(e){return d}}
  function S(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}
  function off(){
    OFF_KEYS.forEach(function(k){S(k,false)});
    S("mode",DEF.mode); S("dpi",DEF.dpi);
  }
  function reflect(){
    STATE_KEYS.forEach(function(k){
      var id=k.replace("-enabled","-toggle");
      var el=document.querySelector("#"+id);
      if(el) el.checked=!!G(k,false);
    });
    ["#f-anti-shake","#f-aim-assist","#f-touch-boost","#f-pro-mode"].forEach(function(s,i){
      var el=document.querySelector(s);
      if(!el) return;
      var key=["feat-anti-shake","feat-aim-assist","feat-touch-boost","feat-pro-mode"][i];
      el.checked=!!G(key,false);
    });
    var m=document.querySelector("#mode-select"),d=document.querySelector("#dpi-select");
    if(m) m.value=G("mode",DEF.mode); if(d) d.value=G("dpi",DEF.dpi);
    document.querySelectorAll(".toggle-switch").forEach(function(sw){
      var i=sw.querySelector(".toggle-input"),it=sw.closest(".function-item");
      if(!i||!it) return; it.dataset.state=i.checked?"on":"off"; it.style.borderColor=i.checked?"rgba(34,197,94,.6)":"rgba(255,255,255,.06)";
    });
  }
  window.addEventListener("pagehide",off);
  window.addEventListener("beforeunload",off);
  document.addEventListener("visibilitychange",function(){ if(document.visibilityState==="hidden") off(); });
  window.addEventListener("pageshow",function(){ reflect(); });
})();

(() => {
  const block = (event) => {
    const key = (event.key || "").toUpperCase();
    const blockKey =
      key === "F12" ||
      key === "F11" ||
      (event.ctrlKey && event.shiftKey && ["I", "C", "J", "K"].includes(key)) ||
      (event.ctrlKey && key === "U");
    if (blockKey) {
      event.preventDefault();
      event.stopPropagation();
    }
  };
  document.addEventListener("keydown", block, true);
  document.addEventListener("keypress", block, true);
  document.addEventListener("contextmenu", (e) => e.preventDefault(), true);

  let locked = false;
  const lockUi = () => {
    if (locked) return;
    locked = true;
    const shield = document.createElement("div");
    shield.setAttribute("role", "presentation");
    shield.style.cssText =
      "position:fixed;inset:0;background:#04050b;z-index:9999;color:#f1f5f9;display:flex;align-items:center;justify-content:center;font-family:Inter,system-ui,sans-serif;font-size:15px;letter-spacing:0.3px;text-align:center;padding:24px;";
    shield.textContent = "Devtools blocked.";
    document.body.innerHTML = "";
    document.body.appendChild(shield);
  };

  const detect = () => {
    const gapW = Math.abs(window.outerWidth - window.innerWidth) > 160;
    const gapH = Math.abs(window.outerHeight - window.innerHeight) > 160;
    if (gapW || gapH) lockUi();
  };
  setInterval(detect, 900);
  window.addEventListener("resize", detect, true);
})();
log(`<span class="info">render::lock_vsync()</span> :: <span class="ok">DONE</span>`);
log(`<span class="trace">trace:sched.optimize(gc)</span>`);
log(`<span class="lock">Lock FPS: ON</span>`);