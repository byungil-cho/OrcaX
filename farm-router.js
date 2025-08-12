
/*! farm-router.v1.2.js | Robust hash router for mobile rail & desktop dock */
(function(){
  'use strict';
  const qs = (s, r=document) => r.querySelector(s);
  const isMobile = () => window.matchMedia('(max-width:900px)').matches;

  function moveInto(target, nodes){
    const frag=document.createDocumentFragment();
    nodes.forEach(n => { if(n) frag.appendChild(n); });
    target.appendChild(frag);
  }
  function hardHide(){
    const s=qs('#shop'); if(s) s.style.display='none';
    const g=qs('#gate'); if(g) g.style.display='none';
  }
  function ensureMini(){
    const gMini=qs('#gMini'); if(!gMini) return;
    const mw=qs('.mini-wrap'); if(mw && mw.parentElement!==gMini){ gMini.appendChild(mw); }
  }

  function viewFarm(stage){ moveInto(stage, [qs('.hud-left .panel'), qs('.hud-right .panel')]); }
  function viewGate(stage){ const d=qs('.hud-left .gate-dock'); const g=qs('#gate'); moveInto(stage, [d,g]); if(g){ g.style.display='block'; } if(typeof window.updateGateFace==='function'){ try{ window.updateGateFace(); }catch(_){ } } }
  function viewShop(stage){ const s=qs('#shop'); if(s){ s.style.display='block'; moveInto(stage, [s]); } }

  const Router = {
    current: null,
    nav(to){
      if(to===this.current){ this.close(); return; }
      this.open(to);
      if(location.hash!=='#/'+to) history.pushState({},'', '#/'+to);
    },
    open(to){
      this.current = to;
      hardHide();
      if(isMobile()){
        const rail=qs('#glassRail'), stage=qs('#gStage');
        if(!rail || !stage){ console.warn('[router] mobile rail missing'); return; }
        while(stage.firstChild){ stage.removeChild(stage.firstChild); }
        ensureMini();
        if(to==='farm') viewFarm(stage);
        if(to==='gate') viewGate(stage);
        if(to==='shop') viewShop(stage);
        document.documentElement.classList.add('glass-on');
      }else{
        let dock=qs('#pcFarmDock'); let stage=qs('#pcStage');
        if(!dock){ dock=document.createElement('div'); dock.id='pcFarmDock'; dock.innerHTML='<div class="pc-dock"><button class="pc-close" aria-label="닫기">✕</button><div id="pcStage"></div></div>'; document.body.appendChild(dock); stage=qs('#pcStage'); }
        while(stage.firstChild){ stage.removeChild(stage.firstChild); }
        if(to==='farm') viewFarm(stage);
        if(to==='gate') viewGate(stage);
        if(to==='shop') viewShop(stage);
        dock.classList.add('show');
      }
    },
    close(){
      // Always remove glass-on and empty stages
      document.documentElement.classList.remove('glass-on');
      const ms=qs('#gStage'); if(ms){ while(ms.firstChild){ ms.removeChild(ms.firstChild); } }
      const pd=qs('#pcFarmDock'); if(pd){ pd.classList.remove('show'); }
      const ps=qs('#pcStage'); if(ps){ while(ps.firstChild){ ps.removeChild(ps.firstChild); } }
      this.current=null; hardHide();
      if(location.hash!=='#/home') history.replaceState({}, '', '#/home');
    },
    routeFromHash(){
      const h=(location.hash||'#/home').toLowerCase();
      if(h.startsWith('#/farm')) return 'farm';
      if(h.startsWith('#/gate')) return 'gate';
      if(h.startsWith('#/shop')) return 'shop';
      return 'home';
    },
    sync(){
      const r=this.routeFromHash();
      if(r==='home'){ this.close(); } else { this.open(r); }
    },
    start(){
      if(this._started) return; this._started=true;

      // Force first-load to home (prevents stale '#/farm' on messenger browsers)
      if(!sessionStorage.getItem('FR_INIT')){
        sessionStorage.setItem('FR_INIT','1');
        history.replaceState({},'', '#/home');
        document.documentElement.classList.remove('glass-on');
      }

      const mbar=qs('#mBar');
      if(mbar && !mbar._r){
        mbar.addEventListener('click', (e)=>{
          const b=e.target.closest('.mbtn'); if(!b) return;
          const t=(b.getAttribute('data-tgt')||'').toLowerCase();
          if(t==='sync'){ if(typeof window.loadFromServer==='function'){ try{ window.loadFromServer(); }catch(_){ } } return; }
          if(t) this.nav(t.toLowerCase());
        }, false);
        mbar._r=true;
      }
      const hook=()=>{
        const bd=qs('#glassBackdrop'); const x1=qs('#glassClose'); const x2=qs('#pcFarmDock .pc-close');
        if(bd && !bd._r){ bd.addEventListener('click', ()=>this.close(), false); bd._r=true; }
        if(x1 && !x1._r){ x1.addEventListener('click', ()=>this.close(), false); x1._r=true; }
        if(x2 && !x2._r){ x2.addEventListener('click', ()=>this.close(), false); x2._r=true; }
      };
      hook();
      const mo=new MutationObserver(hook); mo.observe(document.body, {childList:true, subtree:true});
      document.addEventListener('keydown', (e)=>{ if(e.key==='Escape'){ this.close(); } }, false);
      window.addEventListener('hashchange', ()=>this.sync(), false);
      window.addEventListener('popstate',  ()=>this.sync(), false);
      this.sync();
    }
  };
  window.FarmRouter = Router;
  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded', ()=>Router.start(), {once:true}); } else { Router.start(); }
})();