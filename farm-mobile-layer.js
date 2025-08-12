
/*! farm-mobile-layer.v1.2.js | UI-only: mobile header/bottombar + transparent glass rail (no events) */
(function(){
  'use strict';
  var mq = window.matchMedia('(max-width:900px)');
  if(!mq.matches) return; // phones only

  // Inject CSS once
  if(!document.getElementById('__mobileLayerCSS__')){
    var st = document.createElement('style'); st.id='__mobileLayerCSS__';
    st.textContent = `
    .top, .bank { display:none !important; }
    #gateBackdrop{ display:none !important; }

    #mHdr{
      position:fixed; left:10px; right:10px; top:10px; z-index:9999;
      display:flex; align-items:center; justify-content:space-between; gap:8px;
      padding:6px 10px; border-radius:14px; background:rgba(0,0,0,.30); border:1px solid rgba(255,255,255,.22); color:#fff; font-size:13px;
    }
    #mHdr .who{ font-weight:800; overflow:hidden; text-overflow:ellipsis; max-width:48vw; }
    #mHdr .pill{ display:inline-flex; align-items:center; gap:6px; padding:3px 8px; border-radius:999px; border:1px solid rgba(255,255,255,.22); background:rgba(0,0,0,.28); font-size:12px; }
    #mHdr .dot{ width:8px; height:8px; border-radius:999px; background:#ef4444 } #mHdr .dot.ok{ background:#25d366 }

    #mBar{
      position:fixed; left:10px; right:10px; bottom:10px; z-index:9999;
      display:grid; grid-template-columns:repeat(4,1fr); gap:6px; padding:8px; border-radius:14px; background:rgba(0,0,0,.30); border:1px solid rgba(255,255,255,.22);
    }
    #mBar .mbtn{ border:1px solid rgba(255,255,255,.22); background:rgba(0,0,0,.18); color:#fff; border-radius:10px; padding:8px 6px; font-size:12px; line-height:1; }

    #glassRail{ position:fixed; left:10px; right:10px; top:56px; bottom:60px; z-index:9998; display:none; }
    html.glass-on #glassRail{ display:block; }
    #glassBackdrop{ position:absolute; inset:0; background:transparent; }
    #glassInner{
      position:absolute; left:50%; transform:translateX(-50%); width:min(560px, 96%); height:100%;
      overflow-y:auto; overflow-x:hidden; -webkit-overflow-scrolling:touch;
      background:transparent; border:1px solid rgba(255,255,255,.14); border-radius:18px;
      box-shadow: 0 0 0 1px rgba(255,255,255,.04) inset; padding:6px 8px calc(72px + env(safe-area-inset-bottom));
      display:flex; flex-direction:column;
    }

    /* Close at top-right (reliably clickable) */
    #glassClose{
      position:sticky; top:6px; align-self:flex-end; margin:0 6px 4px 0; z-index:3;
      display:inline-flex; align-items:center; justify-content:center;
      width:30px; height:30px; border-radius:999px; border:1px solid rgba(255,255,255,.22);
      background:rgba(0,0,0,.28); color:#fff; backdrop-filter:none;
    }

    /* Mini centered at top */
    #gMini{ position:sticky; top:6px; z-index:2; display:flex; justify-content:center; padding:4px 2px; }
    #gMini .mini-wrap{
      position:static !important; display:grid !important; grid-template-columns:auto 1fr auto; gap:10px; align-items:center;
      width:min(520px, 96%); margin:0 auto;
      border:1px solid rgba(255,255,255,.18); border-radius:14px; background:rgba(0,0,0,.18); padding:10px;
    }
    #gMini .mini{ width:160px; height:160px; object-fit:cover; border-radius:12px; }

    #gStage{ display:flex; flex-direction:column; gap:12px; padding-top:6px; }
    #gStage .panel, #gStage #gate .card, #gStage #shop{ position:static !important; width:100% !important; transform:none !important; display:block !important; }

    /* Gate bars slimmer */
    #gStage #gate .card{ display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1.2fr); gap:12px; align-items:center; }
    #gStage #gate .bars{ max-width:50%; }
    #gStage #gate .bar{ width:50% !important; max-width:12px; }
    `;
    document.head.appendChild(st);
  }

  // Build header/bottom/rail if missing
  if(!document.getElementById('mHdr')){
    var hdr=document.createElement('div'); hdr.id='mHdr';
    hdr.innerHTML='<span class="who" id="mWho"></span><span style="display:flex;gap:8px;align-items:center"><span class="pill">🪙 <b id="mTok">0</b></span><span class="pill">🍿 <b id="mPop">0</b></span><span class="pill"><span id="mDot" class="dot"></span> <span id="mNet">오프라인</span></span></span>';
    document.body.appendChild(hdr);
    var bar=document.createElement('div'); bar.id='mBar';
    bar.innerHTML='<button class="mbtn" data-tgt="FARM">농사짓기</button><button class="mbtn" data-tgt="GATE">성장게이트</button><button class="mbtn" data-tgt="SHOP">구매/첨가물</button><button class="mbtn" data-tgt="SYNC">동기화</button>';
    document.body.appendChild(bar);
  }
  if(!document.getElementById('glassRail')){
    var rail=document.createElement('div'); rail.id='glassRail';
    rail.innerHTML='<div id="glassBackdrop" tabindex="-1"></div><div id="glassInner"><button id="glassClose" aria-label="닫기">✕</button><div id="gMini"></div><div id="gStage"></div></div>';
    document.body.appendChild(rail);
  }

  // Header values refresh (no click handlers here)
  function readInv(){ try{ return JSON.parse(localStorage.getItem('potato_inv')||localStorage.getItem('potatoInv')||'{}'); }catch(e){ return {}; } }
  function syncHdr(){
    var name = localStorage.getItem('nickname') || localStorage.getItem('kakaoNickname') || '';
    var inv  = readInv();
    var who = document.getElementById('mWho'); if(who) who.textContent = name || '(로그인 필요)';
    var tok = document.getElementById('mTok'); if(tok) tok.textContent = inv.token ?? 0;
    var pop = document.getElementById('mPop'); if(pop) pop.textContent = inv.popcorn ?? 0;
    var ok = document.getElementById('netDot')?.classList.contains('ok') || false;
    var dot = document.getElementById('mDot'); if(dot) dot.classList.toggle('ok', !!ok);
    var net = document.getElementById('mNet'); if(net) net.textContent = ok ? '온라인' : '오프라인';
  }
  syncHdr(); setInterval(syncHdr, 1000);
})();