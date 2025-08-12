
/*! farm-router.v1.js | hash-based router for OrcaX Corn Farm
   - Mobile: uses #glassRail/#gMini/#gStage (v11+). Opens one view at a time.
   - Desktop: uses right-side #pcFarmDock with #pcStage (v12+). If missing, creates a minimal dock.
   - No server/auth changes. Safe in Kakao/Naver in-app webviews.
*/
(function(){
  'use strict';

  const qs  = (s, r=document) => r.querySelector(s);
  const qsa = (s, r=document) => Array.from(r.querySelectorAll(s));
  const isMobile = () => window.matchMedia('(max-width:900px)').matches;

  // ---------- Stage helpers ----------
  function getStages(){
    return {
      rail: qs('#glassRail'),
      gMini: qs('#gMini'),
      gStage: qs('#gStage'),
      pcDock: qs('#pcFarmDock'),
      pcStage: qs('#pcStage')
    };
  }
  function ensureDesktopDock(){
    let {pcDock, pcStage} = getStages();
    if(pcDock && pcStage) return {pcDock, pcStage};

    // Create a minimal right-side dock if not present
    pcDock = document.createElement('div'); pcDock.id = 'pcFarmDock';
    pcDock.innerHTML = '<div class="pc-dock"><button class="pc-close" aria-label="닫기">✕</button><div id="pcStage"></div></div>';
    document.body.appendChild(pcDock);
    pcStage = qs('#pcStage');

    // Minimal styles if host page doesn't have them
    if(!qs('#__routerDockStyle__')){
      const st = document.createElement('style'); st.id='__routerDockStyle__';
      st.textContent = `
        #pcFarmDock{ position:fixed; inset:0; z-index:9998; pointer-events:none; display:none; }
        #pcFarmDock.show{ display:block; }
        #pcFarmDock .pc-dock{ position:absolute; top:96px; right:24px; bottom:24px; width:min(520px, 32vw);
          background:transparent; border:1px solid rgba(255,255,255,.14); border-radius:16px;
          box-shadow:0 0 0 1px rgba(255,255,255,.04) inset, 0 12px 28px rgba(0,0,0,.25);
          overflow:auto; padding:10px; transform:translateX(16px); opacity:0; transition:transform .18s ease, opacity .18s ease;
          pointer-events:auto; }
        #pcFarmDock.show .pc-dock{ transform:translateX(0); opacity:1; }
        #pcFarmDock .pc-close{ position:sticky; top:6px; margin-left:auto; display:inline-flex; align-items:center; justify-content:center; width:30px; height:30px;
          border-radius:999px; border:1px solid rgba(255,255,255,.22); background:rgba(0,0,0,.25); color:#fff; z-index:2; }
        #pcStage .panel{ position:static !important; width:100% !important; transform:none !important; display:block !important; }
      `;
      document.head.appendChild(st);
    }
    pcDock.querySelector('.pc-close').addEventListener('click', Router.close, {passive:true});
    return {pcDock, pcStage};
  }

  // Move nodes into target safely (no clone)
  function moveInto(target, nodes){
    const frag = document.createDocumentFragment();
    nodes.forEach(n => { if(n) frag.appendChild(n); });
    target.appendChild(frag);
  }

  // Hide original modal blocks to avoid double-visibility
  function hardHideOriginals(){
    const shop = qs('#shop'); if(shop) shop.style.display='none';
    const gate = qs('#gate'); if(gate) gate.style.display='none';
  }

  // Ensure mini wraps inside mobile rail top
  function ensureMiniTop(){
    const {gMini} = getStages();
    if(!gMini) return;
    const mw = qs('.mini-wrap');
    if(mw && mw.parentElement !== gMini) gMini.appendChild(mw);
  }

  // ---------- Views ----------
  function viewFarm(stageEl){
    const L = qs('.hud-left .panel');
    const R = qs('.hud-right .panel');
    moveInto(stageEl, [L, R]);
  }
  function viewGate(stageEl){
    const dock = qs('.hud-left .gate-dock');
    const gate = qs('#gate');
    moveInto(stageEl, [dock, gate]);
    if(gate){ gate.style.display = 'block'; }
    if(typeof window.updateGateFace === 'function'){ try{ window.updateGateFace(); }catch(_){} }
  }
  function viewShop(stageEl){
    const shop = qs('#shop');
    if(shop){ shop.style.display='block'; moveInto(stageEl, [shop]); }
  }

  // ---------- Router core ----------
  const Router = {
    current: null, // 'home' | 'farm' | 'gate' | 'shop'
    navigate(to){
      if(to === this.current){ this.close(); return; }
      this.open(to);
      // update hash without scrolling
      if(location.hash !== '#/'+to){
        history.pushState({}, '', '#/'+to);
      }
    },
    open(to){
      this.current = to;
      hardHideOriginals();
      if(isMobile()){
        const {rail, gStage} = getStages();
        if(!rail || !gStage){ console.warn('[router] mobile rail not found'); return; }
        // clear
        while(gStage.firstChild){ gStage.removeChild(gStage.firstChild); }
        ensureMiniTop();
        if(to==='farm') viewFarm(gStage);
        if(to==='gate') viewGate(gStage);
        if(to==='shop') viewShop(gStage);
        document.documentElement.classList.add('glass-on');
      }else{
        const {pcDock, pcStage} = ensureDesktopDock();
        // clear
        while(pcStage.firstChild){ pcStage.removeChild(pcStage.firstChild); }
        if(to==='farm') viewFarm(pcStage);
        if(to==='gate') viewGate(pcStage);
        if(to==='shop') viewShop(pcStage);
        pcDock.classList.add('show');
      }
    },
    close(){
      if(this.current === null) return;
      if(isMobile()){
        document.documentElement.classList.remove('glass-on');
        const {gStage} = getStages();
        if(gStage){ while(gStage.firstChild){ gStage.removeChild(gStage.firstChild); } }
      }else{
        const {pcDock, pcStage} = ensureDesktopDock();
        pcDock.classList.remove('show');
        if(pcStage){ while(pcStage.firstChild){ pcStage.removeChild(pcStage.firstChild); } }
      }
      this.current = null;
      hardHideOriginals();
      // set hash to home without adding history
      if(location.hash !== '#/home'){
        history.replaceState({}, '', '#/home');
      }
    },
    routeFromHash(){
      const h = (location.hash || '#/home').toLowerCase();
      if(h.startsWith('#/farm')) return 'farm';
      if(h.startsWith('#/gate')) return 'gate';
      if(h.startsWith('#/shop')) return 'shop';
      return 'home';
    },
    sync(){
      const r = this.routeFromHash();
      if(r==='home'){ this.close(); } else { this.open(r); }
    },
    start(){
      if(this._started) return; this._started=true;
      window.addEventListener('hashchange', ()=>this.sync(), {passive:true});
      window.addEventListener('popstate', ()=>this.sync(), {passive:true});

      // Bridge existing buttons
      const mbar = qs('#mBar');
      if(mbar && !mbar._router){
        mbar.addEventListener('click', (e)=>{
          const b = e.target.closest('.mbtn'); if(!b) return;
          const tgt = (b.getAttribute('data-tgt')||'').toLowerCase();
          if(tgt==='sync'){ if(typeof window.loadFromServer==='function'){ try{ window.loadFromServer(); }catch(_){} } return; }
          if(tgt==='farm') this.navigate('farm');
          if(tgt==='gate') this.navigate('gate');
          if(tgt==='shop') this.navigate('shop');
        }, {passive:true});
        mbar._router=true;
      }
      const pcBtn = qs('#pcFarmBtn');
      if(pcBtn && !pcBtn._router){
        pcBtn.addEventListener('click', ()=>this.navigate('farm'), {passive:true});
        pcBtn._router=true;
      }

      // Close when backdrop/X pressed (mobile rail & desktop dock)
      const closeHooks = ()=>{
        const backdrop = qs('#glassBackdrop');
        const x1 = qs('#glassClose');
        const x2 = qs('#pcFarmDock .pc-close');
        if(backdrop && !backdrop._router){ backdrop.addEventListener('click', ()=>this.close(), {passive:true}); backdrop._router=true; }
        if(x1 && !x1._router){ x1.addEventListener('click', ()=>this.close(), {passive:true}); x1._router=true; }
        if(x2 && !x2._router){ x2.addEventListener('click', ()=>this.close(), {passive:true}); x2._router=true; }
      };
      closeHooks();
      const mo = new MutationObserver(closeHooks);
      mo.observe(document.body, {childList:true, subtree:true});

      // ESC to close
      document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') this.close(); }, {passive:true});

      // Initial sync
      this.sync();
    }
  };

  // Expose for debugging
  window.FarmRouter = Router;

  // Auto-start when DOM is ready
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', ()=>Router.start(), {once:true});
  }else{
    Router.start();
  }
})();
