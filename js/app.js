/* Corn Farm App Logic (KST 08:00~23:00 운영, 3시간 x 5 구간) */
const POTATO_FARM_URL = 'https://byungil-cho.github.io/OrcaX/index9.html';
const $ = (id)=>document.getElementById(id);
function nowKST(){ const now=new Date(); return new Date(now.getTime() + (9*60 + now.getTimezoneOffset())*60000); }
function isOperatingHoursKST(d=nowKST()){ const h=d.getHours(), m=d.getMinutes(); const t=h+m/60; return (t>=8 && t<23); }
function getSlotKST5(d=nowKST()){ const h=d.getHours(), m=d.getMinutes(); const t=h+m/60;
  if(t>=8&&t<11)return 1; if(t>=11&&t<14)return 2; if(t>=14&&t<17)return 3; if(t>=17&&t<20)return 4; if(t>=20&&t<23)return 5; return 0; }
function applyTimeOverlay5(){ const el=$('todTint'); const s=getSlotKST5(); el.className=s?('tod-'+s):''; el.style.display=s?'block':'none'; }
const SEASONS=['winter_fallow','spring','summer','autumn','winter_rest'];
function currentSeason(){ const ov=localStorage.getItem('seasonOverride'); if(ov&&SEASONS.includes(ov)) return ov;
  let start=localStorage.getItem('seasonStartKST'); if(!start){ const d=nowKST(); d.setHours(0,0,0,0); start=d.toISOString(); localStorage.setItem('seasonStartKST',start); }
  const base=new Date(start), now=nowKST(); const days=Math.floor((now-base)/(24*60*60*1000)); return SEASONS[days%5]; }
function loadState(){ try{ return Object.assign({g:70,w:3,f:3,c:0,phase:'GROW',salt:0,sugar:0,sel:'salt',harvests:0,level:1}, JSON.parse(localStorage.getItem('corn_state')||'{}')); }catch{ return {g:70,w:3,f:3,c:0,phase:'GROW',salt:0,sugar:0,sel:'salt',harvests:0,level:1}; } }
function saveState(){ try{ localStorage.setItem('corn_state', JSON.stringify(S)); }catch{} }
let S=loadState();
function getPotatoInv(){ let inv={water:0,fertilizer:0,salt:0,sugar:0,token:0,popcorn:0}; try{ inv=Object.assign(inv, JSON.parse(localStorage.getItem('potato_inv')||'{}')); }catch(e){} for(const k of Object.keys(inv)) if(typeof inv[k]!=='number') inv[k]=0; return inv; }
function setPotatoInv(inv){ try{ localStorage.setItem('potato_inv', JSON.stringify(inv)); }catch(e){} }
const BG_BY_GAUGE=[{max:29,file:'img/farm_05.png',label:'초기(0-29)'},{max:49,file:'img/farm_07.png',label:'초중기(30-49)'},{max:69,file:'img/farm_09.png',label:'중기(50-69)'},{max:89,file:'img/farm_10.png',label:'후기(70-89)'},{max:100,file:'img/farm_12.png',label:'수확(90-100)'}];
const MINI_BY_SEASON={ winter_fallow:['img/corn_0_01_01.png','img/corn_0_01_02.png','img/corn_0_01_03.png','img/corn_0_01_04.png','img/corn_0_01_05.png'],
  spring:['img/corn_06_01.png','img/corn_06_02.png','img/corn_04_01.png','img/corn_04_02.png','img/corn_04_04.png'],
  summer:['img/corn_02_01.png','img/corn_02_02.png','img/corn_02_03.png','img/corn_03_01.png','img/corn_03_03.png'],
  autumn:['img/corn_03_04.png','img/corn_01_01.png','img/corn_01_02.png','img/corn_01_03.png','img/corn_01_04.png'],
  winter_rest:['img/corn_0_01_01.png','img/corn_0_01_02.png','img/corn_0_01_03.png','img/corn_0_01_04.png','img/corn_0_01_05.png'], };
function idxByGauge(g){ if(g<=29)return 0; if(g<=49)return 1; if(g<=69)return 2; if(g<=89)return 3; return 4; }
function pickRow(list,val){ return list.find(r=>val<=r.max)||list[list.length-1]; }
function toast(msg){ const t=$('toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),1400); }
function setPauseUI(on){ ['btnW','btnF','harv','pop','tick'].forEach(id=>{ const el=$(id); if(el) el.disabled=on; }); const b=$('pauseBanner'); if(b) b.style.display=on?'block':'none'; }
function applyBG(){ const season=currentSeason(); if(season.startsWith('winter')){ $('bg').style.backgroundImage="url('img/farm_03.png')"; $('gState').textContent='WINTER'; }
  else { const row=pickRow(BG_BY_GAUGE,S.g); $('bg').style.backgroundImage=`url('${row.file}')`; $('gState').textContent=row.label.toUpperCase(); } }
function applyMini(){ const season=currentSeason(); const imgs=MINI_BY_SEASON[season]||MINI_BY_SEASON.spring; const idx=idxByGauge(S.g); $('mini').src=imgs[idx]; $('miniCap').textContent=`${season.replace('_','/')} · ${S.g.toFixed(0)}%`; }
function renderGate(){ const resPct=x=>Math.max(0,Math.min(100,x*20)); $('fillW').style.height=resPct(S.w)+'%'; $('fillF').style.height=resPct(S.f)+'%'; $('fillG').style.height=Math.max(0,Math.min(100,S.g))+'%'; }
function renderRes(){ $('w').textContent=S.w; $('f').textContent=S.f; $('c').textContent=S.c; $('saltCount').textContent=S.salt; $('sugarCount').textContent=S.sugar; $('pickSalt').classList.toggle('sel',S.sel==='salt'); $('pickSugar').classList.toggle('sel',S.sel==='sugar'); $('pop').disabled=!(S.c>=1&&(S.salt>=1||S.sugar>=1)); }
function renderBank(){ const inv=getPotatoInv(); $('bankToken').textContent=inv.token; $('bankPop').textContent=inv.popcorn; }
function renderAll(){ $('gVal').textContent=S.g.toFixed(0); $('gauge').style.background=`conic-gradient(var(--accent) ${Math.max(0,Math.min(100,S.g))}%, rgba(255,255,255,.15) 0)`; applyBG(); applyMini(); renderGate(); renderRes(); renderBank(); applyTimeOverlay5(); }
const RATE_GROW=+1.0, RATE_WARN=-1.0, RATE_DANGER=-2.0; const GROW_MULT5={1:1.00,2:1.08,3:1.05,4:0.97,5:0.93};
function withTimeMultiplier(baseDelta){ const s=getSlotKST5(); if(!s) return 0; return baseDelta*(GROW_MULT5[s]||1); }
function tick(){ if(!isOperatingHoursKST()){ renderAll(); setPauseUI(true); return; } setPauseUI(false);
  if(S.phase==='STUBBLE'){ renderAll(); return; } const resPct=x=>Math.max(0,Math.min(100,x*20)); const wPct=resPct(S.w), fPct=resPct(S.f);
  let d=RATE_GROW; if(wPct<50&&fPct<50)d=RATE_DANGER; else if(wPct<50||fPct<50)d=RATE_WARN; S.g=Math.max(0,Math.min(100,S.g+withTimeMultiplier(d))); saveState(); renderAll(); }
function give(t){ if(t==='w'&&S.w>0){S.w--; S.g=Math.min(100,S.g+5);} else if(t==='f'&&S.f>0){S.f--; S.g=Math.min(100,S.g+5);} saveState(); renderAll(); }
function harvest(){ if(S.g<100) return; S.c+=5+Math.floor(Math.random()*3); S.g=0; S.phase='STUBBLE'; S.harvests++; const newLevel=1+Math.floor(S.harvests/3); S.level=Math.max(S.level,Math.min(99,newLevel)); saveState(); renderAll(); }
const POP_RATE=0.6, TOKEN_DROP=[1,2,3,5], POP_DROP=[1,2]; const rndPick=arr=>arr[Math.floor(Math.random()*arr.length)];
function popCorn(){ if(S.c<1){alert('옥수수가 없습니다.'); return;} const need=S.sel, other=need==='salt'?'sugar':'salt';
  if(S[need]<1){ if(S[other]>=1){ S.sel=other; renderRes(); alert('선택한 첨가물이 없어 다른 첨가물을 사용합니다.'); } else { if(confirm('첨가물이 없습니다. 감자 농장으로 이동할까요?')) location.href=POTATO_FARM_URL; return; } }
  S.c-=1; S[S.sel]-=1; const inv=getPotatoInv(); if(Math.random()<POP_RATE){ const amt=rndPick(POP_DROP); inv.popcorn+=amt; toast(`🍿 팝콘 +${amt}`); } else { const amt=rndPick(TOKEN_DROP); inv.token+=amt; toast(`🪙 토큰 +${amt}`); }
  setPotatoInv(inv); saveState(); renderAll(); }
window.addEventListener('load', ()=>{
  $('bg').style.backgroundImage="url('img/farm_05.png')"; renderAll(); setInterval(tick,5000);
  (function scheduleWake(){ const now=nowKST(); let wake=new Date(now); wake.setHours(8,0,0,0); if(now>=wake) wake.setDate(wake.getDate()+1);
    setTimeout(()=>{ setPauseUI(false); renderAll(); }, wake-now); })();
  $('btnW').onclick=()=>give('w'); $('btnF').onclick=()=>give('f'); $('tick').onclick=tick; $('harv').onclick=harvest; $('pop').onclick=popCorn;
  $('pickSalt').onclick=()=>{ S.sel='salt'; saveState(); renderRes(); }; $('pickSugar').onclick=()=>{ S.sel='sugar'; saveState(); renderRes(); };
  $('syncPotato').onclick=()=>{ const inv=getPotatoInv(); S.w=inv.water??S.w; S.f=inv.fertilizer??S.f; S.salt=inv.salt??S.salt; S.sugar=inv.sugar??S.sugar; saveState(); renderAll(); toast('감자 저장소와 동기화 완료'); };
  const gate=$('gate'), bd=$('gateBackdrop'); $('btnGate').onclick=()=>{ const open=!gate.classList.contains('open'); gate.classList.toggle('open',open); bd.classList.toggle('show',open); $('btnGate').setAttribute('aria-expanded',open?'true':'false'); };
  $('closeGate').onclick=()=>{ gate.classList.remove('open'); bd.classList.remove('show'); $('btnGate').setAttribute('aria-expanded','false'); };
  bd.onclick=()=>{ gate.classList.remove('open'); bd.classList.remove('show'); $('btnGate').setAttribute('aria-expanded','false'); };
  window.addEventListener('keydown',e=>{ if(e.key==='Escape'){ gate.classList.remove('open'); bd.classList.remove('show'); $('btnGate').setAttribute('aria-expanded','false'); } });
});
const ASSETS=[ 'img/farm_03.png','img/farm_05.png','img/farm_07.png','img/farm_09.png','img/farm_10.png','img/farm_12.png',
  'img/corn_06_01.png','img/corn_06_02.png','img/corn_06_03.png','img/corn_06_04.png','img/corn_04_01.png','img/corn_04_02.png','img/corn_04_03.png','img/corn_04_04.png',
  'img/corn_03_01.png','img/corn_03_02.png','img/corn_03_03.png','img/corn_03_04.png','img/corn_02_01.png','img/corn_02_02.png','img/corn_02_03.png','img/corn_02_04.png',
  'img/corn_01_01.png','img/corn_01_02.png','img/corn_01_03.png','img/corn_01_04.png','img/corn_0_01_01.png','img/corn_0_01_02.png','img/corn_0_01_03.png','img/corn_0_01_04.png','img/corn_0_01_05.png',
  'img/mark_01.png','img/mark_02.png','img/mark_03.png','img/mark_04.png','img/mark_05.png','img/mark_06.png','img/mark_07.png','img/mark_08.png','img/mark_09.png','img/mark_10.png' ];
document.addEventListener('click', (e)=>{ if(e.target && e.target.id==='btnOffline'){ if(!navigator.serviceWorker?.controller){ alert('서비스워커 초기화 중입니다. 잠시 후 다시 시도하세요.'); return; }
  navigator.serviceWorker.controller.postMessage({ type:'PRECACHE', assets:ASSETS }); alert('이미지 에셋을 오프라인에 저장합니다. (한 번만 실행하면 됩니다)'); } });
