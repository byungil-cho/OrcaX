'use strict';

/* ----------------------- API BASE 관리 ----------------------- */
const qs = new URLSearchParams(location.search);
function normBase(u){ return (u||'').trim().replace(/\/+$/,''); }
let API_BASE = normBase(qs.get('api')) || normBase(localStorage.getItem('orcax_api'));
if (!API_BASE) API_BASE = ''; // 빈 값이면 연결 모달로 유도
function saveAPI(u){ API_BASE = normBase(u); localStorage.setItem('orcax_api', API_BASE); console.log('[API BASE]', API_BASE); }

const PRICES = { salt:10, sugar:20, seed:100 };
const WATER_MAX = 10, FERT_MAX = 10;

const $ = s => document.querySelector(s);
const clamp01 = x => Math.max(0, Math.min(1, x));
function setNet(ok){ $('#netDot')?.classList.toggle('ok', !!ok); }
function toast(m){ const t=$('#toast'); t.textContent=m; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2000); }

/* ----------------------- 유저 ----------------------- */
let kakaoId  = qs.get('kakaoId')  || localStorage.getItem('kakaoId');
let nickname = qs.get('nickname') || localStorage.getItem('nickname');
if (!kakaoId || !nickname){
  nickname = nickname || prompt('닉네임','범고래X') || 'Guest';
  kakaoId  = kakaoId  || ('K' + Math.random().toString(36).slice(2,10));
  localStorage.setItem('nickname', nickname);
  localStorage.setItem('kakaoId', kakaoId);
}

/* ----------------------- API 호출 헬퍼 ----------------------- */
async function api(path, {method='GET', body=null}={}){
  if (!API_BASE) throw new Error('API 미지정');
  const url = `${API_BASE}${path}`;
  const opt = { method, headers:{'Content-Type':'application/json'} };
  if (body) opt.body = JSON.stringify(body);
  const r = await fetch(url, opt);
  let j=null; try{ j = await r.json(); }catch{}
  if(!r.ok) throw new Error((j&& (j.message||j.error)) || r.statusText);
  return j;
}
async function tryAll(paths, body){
  let last;
  for(const p of paths){
    try{ return await api(p, {method:'POST', body}); }
    catch(e){ last=e; }
  }
  throw last || new Error('엔드포인트 없음');
}

/* ----------------------- 연결/인증 ----------------------- */
async function ensureUser(){
  // /api/health 먼저
  await api('/api/health').catch(()=>api('/health')).catch(()=>{ throw new Error('서버 Health 실패'); });
  // init-user (GET -> POST fallback)
  try{
    await api(`/api/init-user?kakaoId=${encodeURIComponent(kakaoId)}&nickname=${encodeURIComponent(nickname)}`);
  }catch{
    await api('/api/init-user',{method:'POST', body:{kakaoId,nickname}});
  }
}

/* ----------------------- 요약 로드 & UI 페인트 ----------------------- */
function readSeedTotal(s){
  const c = [s?.seedKinds?.total,s?.seedTotal,s?.seedsTotal,s?.agri?.seedTotal,s?.agri?.seedCorn,s?.user?.agri?.seedCorn,s?.seedCorn,s?.seed_corn,s?.seeds,s?.seed,s?.agri?.seeds];
  for (const v of c) if (v!=null) return Number(v)||0;
  return 0;
}
function paintResources(s){
  const inv=s.inventory||{}, ag=s.agri||{}, add=s.additives||{}, food=s.food||{}, wal=s.wallet||{};
  $('#r-seeds').textContent = readSeedTotal(s);
  $('#r-water').textContent = inv.water ?? 0;
  $('#r-fert').textContent  = inv.fertilizer ?? 0;
  $('#r-corn').textContent  = ag.corn ?? 0;
  $('#r-pop').textContent   = food.popcorn ?? 0;
  $('#r-salt').textContent  = add.salt ?? 0;
  $('#r-sugar').textContent = add.sugar ?? 0;
  $('#r-orcx').textContent  = wal.orcx ?? 0;
}
function stateKey(v){
  const s=(v||'').toString().toLowerCase();
  if (s.includes('폐경')) return 'abandon';
  if (s.includes('휴경')) return 'idle';
  if (s.includes('파종')||s.includes('plant')) return 'planted';
  if (s.includes('성장')) return 'growing';
  if (s.includes('수확')) return 'harvestable';
  return 'idle';
}
function preload(src){ return new Promise((ok,ko)=>{ const i=new Image(); i.onload=()=>ok(src); i.onerror=ko; i.src=src; }); }
function applyBackgroundSafe(k){
  const map={idle:['img/farm_winter.png','img/a_corn_06_01.png'],planted:['img/farm_spring.png','img/a_corn_04_01.png'],growing:['img/farm_summer.png','img/a_corn_04_04.png'],harvestable:['img/farm_autumn.png','img/a_corn_06_04.png'],abandon:['img/farm_fallow.png','img/a_corn_fallow.png']};
  const bg=$('#bg'), list=map[k]||[]; (async()=>{ for(const s of list){ try{ await preload(s); bg.style.backgroundImage=`url('${s}')`; return; }catch{} } })();
}
function paintState(sum){
  const p = Math.max(0,Math.min(100,Number(sum?.growth?.percent??0)));
  $('#gfill').style.setProperty('--p',`${p}%`); $('#gnum').textContent=Math.round(p);
  const k = stateKey(sum?.state||sum?.growth?.state); $('#miniCap').textContent = (k==='idle'?'휴경':k==='planted'?'파종':k==='growing'?'성장중':k==='abandon'?'폐경':'수확가능');
  applyBackgroundSafe(k);
  const imgMap={idle:'img/a_corn_06_01.png',planted:'img/a_corn_04_01.png',growing:'img/a_corn_04_04.png',harvestable:'img/a_corn_06_04.png',abandon:'img/a_corn_fallow.png'};
  const mini=$('#miniImg'); mini.src=imgMap[k]||'img/a_corn_06_01.png'; mini.onerror=()=>mini.src='img/a_corn_06_01.png';
}
function paintBars(sum){
  const inv=sum.inventory||{}; const w=Number(inv.water??0), f=Number(inv.fertilizer??0), g=Math.max(0,Math.min(100,Number(sum?.growth?.percent??0)));
  const wMax=Number(sum?.limits?.waterMax??WATER_MAX), fMax=Number(sum?.limits?.fertMax??FERT_MAX);
  $('#vbar-water').style.setProperty('--p',`${Math.round(clamp01(w/(wMax||WATER_MAX))*100)}%`);
  $('#vbar-fert').style.setProperty('--p',`${Math.round(clamp01(f/(fMax||FERT_MAX))*100)}%`);
  $('#vbar-grow').style.setProperty('--p',`${g}%`);
}
function paintSeedKinds(sum){
  const t=readSeedTotal(sum); const set=(id,n)=>{ const b=$('#'+id); const num=$('#'+id+'-num'); b?.classList.toggle('off',!(n>0)); if(num) num.textContent=n; };
  set('seed-normal',t); set('seed-loan',0); set('seed-over',0);
}
function plantedSeedType(sum){
  const e=(sum?.growth?.seedType||sum?.field?.seedType||sum?.seedType||'').toLowerCase();
  if(['red','loan'].includes(e))return'red'; if(['black','overdue'].includes(e))return'black'; if(['yellow','normal'].includes(e))return'yellow';
  const st=(sum?.state||sum?.growth?.state||'').toLowerCase();
  if(!(st.includes('파종')||st.includes('plant')||st.includes('성장')||st.includes('grow'))) return null;
  const ln=sum.loan||{}; if(ln.status==='overdue')return'black'; if(ln.status==='loan')return'red'; return'yellow';
}
function paintBadge(sum){
  const b=$('#seedBadgeImg'); const t=plantedSeedType(sum);
  if(!t){ b.style.display='none'; return; }
  b.src=t==='red'?'img/corn-red.png':(t==='black'?'img/corn-black.png':'img/corn-yellow.png'); b.style.display='block';
}
function levelSpriteIndex(L){ const cuts=[1,5,10,15,20,25,30,35,40,45,50]; let i=1; for(let k=0;k<cuts.length-1;k++){ if(L>=cuts[k]) i=k+1; } return Math.max(1,Math.min(10,i)); }
function computeLevel(sum){ const xp=(Number(sum?.agri?.corn??0)*10)+(Number(sum?.food?.popcorn??0)*5); const L=Math.max(1,Math.floor(Math.log10(xp+1))+1); const next=Math.pow(10,L)-1, prev=Math.pow(10,L-1)-1; const pct=Math.round((xp-prev)/Math.max(1,(next-prev))*100); return{level:L,percent:Math.max(0,Math.min(100,pct))}; }
function paintLevel(sum){ const {level,percent}=computeLevel(sum); $('#levelNum').textContent=level; $('#hbar-level').style.setProperty('--p',`${percent}%`); $('#charImg').src=`img/a_mark_${levelSpriteIndex(level).toString().padStart(2,'0')}.png`; }

async function loadSummary(){
  const s = await api(`/api/corn/summary?kakaoId=${encodeURIComponent(kakaoId)}`)
              .catch(()=>api(`/api/corn/summary/${encodeURIComponent(kakaoId)}`));
  paintResources(s); paintState(s); paintBars(s); paintSeedKinds(s); paintBadge(s); paintLevel(s);
  $('#nick').textContent='온라인 '+nickname; setNet(true);
  return s;
}

/* ----------------------- 구매(통합) ----------------------- */
function openBuyAll(pref){ $('#buyAllWallet').textContent=$('#r-orcx').textContent||'0'; document.querySelectorAll('#buyAllModal .row[data-item]').forEach(r=>{ const item=r.dataset.item; r.querySelector('.qty').value=(pref===item)?1:0; r.querySelector('.sub').textContent='0'; }); updateBuyAllTotals(); $('#buyAllModal').classList.add('show'); }
function closeBuyAll(){ $('#buyAllModal').classList.remove('show'); }
function updateBuyAllTotals(){ let tot=0; document.querySelectorAll('#buyAllModal .row[data-item]').forEach(r=>{ const item=r.dataset.item, price=PRICES[item], qty=Math.max(0,parseInt(r.querySelector('.qty').value||'0',10)); const sub=price*qty; r.querySelector('.sub').textContent=sub; tot+=sub; }); $('#buyAllTotal').textContent=tot; }
async function doBuyAll(){
  const lines=[]; document.querySelectorAll('#buyAllModal .row[data-item]').forEach(r=>{ const item=r.dataset.item, qty=Math.max(0,parseInt(r.querySelector('.qty').value||'0',10)); if(qty>0) lines.push({item,qty}); });
  if(!lines.length) return toast('수량을 입력하세요');
  try{
    for(const it of lines){
      await tryAll(
        ['/api/corn/buy', `/api/corn/buy-${it.item}`, `/api/corn/${it.item}/buy`],
        {kakaoId, item:it.item, qty:it.qty}
      );
    }
    toast('구매 완료'); closeBuyAll(); await loadSummary();
  }catch(e){ console.error(e); toast('구매 실패: '+e.message); }
}

/* ----------------------- 행동 ----------------------- */
async function actPlant(){ await tryAll(['/api/corn/plant','/api/corn/seed','/api/corn/sow'], {kakaoId}); toast('씨앗 심기 완료'); }
async function actWater(){ await tryAll(['/api/corn/water','/api/corn/give-water','/api/corn/watering'], {kakaoId}); toast('물 주기 완료'); }
async function actFert(){  await tryAll(['/api/corn/fertilize','/api/corn/fert','/api/corn/give-fert'], {kakaoId}); toast('거름 주기 완료'); }
async function actHarvest(){ const r=await tryAll(['/api/corn/harvest'], {kakaoId}); toast('수확 완료'); }
async function actPop(){ const use=confirm('설탕 사용? (취소=소금)')?'sugar':'salt'; const r=await tryAll(['/api/corn/pop','/api/corn/popcorn'], {kakaoId,use}); toast('뻥튀기 처리 완료'); }

/* ----------------------- 연결 모달 ----------------------- */
function openApi(){ $('#apiInput').value = API_BASE || ''; $('#apiModal').classList.add('show'); }
function closeApi(){ $('#apiModal').classList.remove('show'); }

/* ----------------------- 부트스트랩 ----------------------- */
async function boot(){
  // API가 없거나 health 실패 시 연결 모달
  if (!API_BASE){
    openApi(); setNet(false); return;
  }
  try{
    await ensureUser();
    await loadSummary();
  }catch(e){
    console.warn('[BOOT FAIL]', e.message);
    setNet(false);
    openApi();
  }
}

function bind(){
  // 액션
  $('#btn-plant').onclick = ()=> actPlant().then(loadSummary).catch(e=>toast(e.message));
  $('#btn-water').onclick = ()=> actWater().then(loadSummary).catch(e=>toast(e.message));
  $('#btn-fert').onclick  = ()=> actFert().then(loadSummary).catch(e=>toast(e.message));
  $('#btn-harv').onclick  = ()=> actHarvest().then(loadSummary).catch(e=>toast(e.message));
  $('#btn-pop').onclick   = ()=> actPop().then(loadSummary).catch(e=>toast(e.message));
  $('#btn-ex').onclick    = ()=> toast('팝콘→거름은 서버 엔진 규칙에 맞게 후속 연결');

  // 구매 모달
  $('#open-buy-all').onclick = ()=> openBuyAll();
  $('#buyAllCancel').onclick = closeBuyAll;
  $('#buyAllOK').onclick     = doBuyAll;
  document.querySelectorAll('#buyAllModal .row').forEach(r=>{
    const dec=r.querySelector('.dec'), inc=r.querySelector('.inc'), q=r.querySelector('.qty');
    dec.onclick=()=>{ q.value=Math.max(0,parseInt(q.value||'0',10)-1); updateBuyAllTotals(); };
    inc.onclick=()=>{ q.value=Math.max(0,parseInt(q.value||'0',10)+1); updateBuyAllTotals(); };
    q.addEventListener('input', updateBuyAllTotals);
    q.addEventListener('keydown', e=>{ if(e.key==='Enter') doBuyAll(); });
  });

  // API 모달
  $('#btn-api').onclick = openApi;
  $('#apiCancel').onclick = closeApi;
  $('#apiSave').onclick = async ()=>{
    const v=$('#apiInput').value.trim();
    if(!/^https?:\/\//.test(v)) return toast('http(s):// 로 시작해야 합니다');
    saveAPI(v);
    closeApi();
    boot();
  };
}

document.addEventListener('DOMContentLoaded', ()=>{
  bind();
  boot();
  // 주기적 갱신
  setInterval(async ()=>{ if(API_BASE) { try{ await loadSummary(); setNet(true); }catch{ setNet(false); } } }, 10000);
});
