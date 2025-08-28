'use strict';
/* ----------------------- API BASE ----------------------- */
const qs = new URLSearchParams(location.search);
function normBase(u){ return (u||'').trim().replace(/\/+$/,''); }

// 🚀 강제로 ngrok 주소 기본값
const DEFAULT_API = 'https://climbing-wholly-grouper.jp.ngrok.io';

let API_BASE =
  normBase(qs.get('api')) || 
  normBase(localStorage.getItem('orcax_api')) || 
  DEFAULT_API;

localStorage.setItem('orcax_api', API_BASE);

function saveAPI(u){ 
  API_BASE = normBase(u); 
  localStorage.setItem('orcax_api', API_BASE); 
  console.log('[API BASE]', API_BASE); 
}

const PRICES = { salt:10, sugar:20, seed:100 };
const WATER_MAX = 10, FERT_MAX = 10;

const $ = s => document.querySelector(s);
const clamp01 = x => Math.max(0, Math.min(1, x));
function setNet(ok){ $('#netDot')?.classList.toggle('ok', !!ok); }
function toast(m){ const t=$('#toast'); t.textContent=m; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2000); }

/* ----------------------- RESOURCE HELPERS ----------------------- */
function readSeedTotal(s){
  const c = [
    s?.inventory?.seed,               // ✅ summary.inventory.seed
    s?.seedKinds?.total,
    s?.seedTotal,
    s?.seedsTotal,
    s?.agri?.seedTotal,
    s?.agri?.seedCorn,
    s?.user?.agri?.seedCorn,
    s?.seedCorn,
    s?.seed_corn,
    s?.seeds,
    s?.seed,
    s?.agri?.seeds
  ];
  for (const v of c) if (v!=null) return Number(v)||0;
  return 0;
}

/* ----------------------- MAIN RENDER ----------------------- */
function paintResources(s){
  const inv = s?.inventory || {};
  const wal = s?.wallet || {};

  $('#r-seeds').textContent = readSeedTotal(s);     // ✅ 씨앗 값
  $('#r-water').textContent = inv.water ?? 0;
  $('#r-fert').textContent  = inv.fertilizer ?? 0;
  $('#r-corn').textContent  = s?.agri?.corn ?? 0;
  $('#r-pop').textContent   = s?.food?.popcorn ?? 0;
  $('#r-salt').textContent  = s?.additives?.salt ?? 0;
  $('#r-sugar').textContent = s?.additives?.sugar ?? 0;
  $('#r-orcx').textContent  = wal.orcx ?? 0;        // ✅ 토큰 값
}

// ... 이하 기존 코드 동일 (버튼, 모달, boot(), bind() 등)
/* ----------------------- 유저 ----------------------- */
let kakaoId  = qs.get('kakaoId')  || localStorage.getItem('kakaoId');
let nickname = qs.get('nickname') || localStorage.getItem('nickname');
if (!kakaoId || !nickname){
  nickname = nickname || prompt('닉네임','범고래X') || 'Guest';
  kakaoId  = kakaoId  || ('K' + Math.random().toString(36).slice(2,10));
  localStorage.setItem('nickname', nickname);
  localStorage.setItem('kakaoId', kakaoId);
}

/* ----------------------- API 호출(캐시무시) ----------------------- */
async function api(path, {method='GET', body=null, nocache=false}={}){
  if (!API_BASE) throw new Error('API 미지정');

  const addNoCache = nocache ? (path.includes('?') ? `&_=${Date.now()}` : `?_=${Date.now()}`) : '';
  const url = `${API_BASE}${path}${addNoCache}`;

  const opt = {
    method,
    headers: { 'Content-Type': 'application/json', 'Accept':'application/json' },
    cache: 'no-store'
  };
  if (body) opt.body = JSON.stringify(body);

  const res = await fetch(url, opt);
  if (res.status === 304) throw new Error('서버 응답이 갱신되지 않았습니다(304).');

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};

  if (!res.ok) throw new Error(data?.message || data?.error || res.statusText);
  return data;
}
async function tryAll(paths, body){
  let last;
  for(const p of paths){
    try{ return await api(p, {method:'POST', body, nocache:true}); }
    catch(e){ last=e; }
  }
  throw last || new Error('엔드포인트 없음');
}

/* ----------------------- 연결/인증 ----------------------- */
async function ensureUser(){
  await api('/api/health', { nocache:true })
    .catch(()=>api('/health', { nocache:true }))
    .catch(()=>{ throw new Error('서버 Health 실패'); });

  try{
    await api(`/api/init-user?kakaoId=${encodeURIComponent(kakaoId)}&nickname=${encodeURIComponent(nickname)}`, { nocache:true });
  }catch{
    await api('/api/init-user',{method:'POST', body:{kakaoId,nickname}, nocache:true});
  }
}

/* ----------------------- 도우미 ----------------------- */
function readSeedTotal(s){
  const c = [s?.seedKinds?.total,s?.seedTotal,s?.seedsTotal,s?.agri?.seedTotal,s?.agri?.seedCorn,s?.user?.agri?.seedCorn,s?.seedCorn,s?.seed_corn,s?.seeds,s?.seed,s?.agri?.seeds];
  for (const v of c) if (v!=null) return Number(v)||0;
  return 0;
}

/* ----------------------- 리소스/상태 페인트 ----------------------- */
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

/* ===== 이미지 매퍼 ===== */
const IMG = {
  bg: {
    enter:   'img/farm_01.png',
    fallow:  'img/farm_01.png',
    d1:      'img/farm_03.png',
    d2:      'img/farm_05.png',
    d3:      'img/farm_07.png',
    d4:      'img/farm_09.png',
    harvest: 'img/farm_10.png',
    missed:  'img/farm_12.png'
  },
  sheet: { 1:'06', 2:'04', 3:'03', 4:'02', 5:'01' }
};
function preload(src){ return new Promise((ok,ko)=>{ const i=new Image(); i.onload=()=>ok(src); i.onerror=ko; i.src=src; }); }
async function setBgImage(url){
  const bg = $('#bg'); if(!bg) return;
  try{ await preload(url); bg.style.backgroundImage = `url('${url}')`; }
  catch{ bg.style.backgroundImage = `url('${IMG.bg.fallow}')`; }
}
function pickBackground(s){
  const st = (s?.status||'').toLowerCase();
  const day = Number(s?.day||0);
  if (st==='missed')  return IMG.bg.missed;
  if (st==='harvest') return IMG.bg.harvest;
  if (!day || st==='fallow') return IMG.bg.fallow;
  return [null, IMG.bg.d1, IMG.bg.d2, IMG.bg.d3, IMG.bg.d4][Math.max(1, Math.min(4, day))];
}
function pickMiniSprite(s){
  if (!s || s.status==='fallow') return 'img/a_corn_06_01.png';
  if (s.status==='missed')       return 'img/a_corn_01_05.png';
  const d = Math.max(1, Math.min(5, Number(s.day||1)));
  const sheet = IMG.sheet[d] || '01';
  if (d===5){
    return (s.status==='harvest') ? 'img/a_corn_01_02.png' : 'img/a_corn_01_03.png';
  }
  let k = s.stageIndex;
  if (!k){
    const gp = Math.max(0, Math.min(99, Number(s.growthPercent ?? s?.growth?.percent ?? 0)));
    k = 1 + Math.floor(gp/20);
  }
  k = Math.max(1, Math.min(5, k));
  if (d===3){
    if ((s.fert ?? s?.inventory?.fertilizer ?? 1)===0) return 'img/a_corn_03_04.png';
    if ((s.water?? s?.inventory?.water ?? 1)===0)      return 'img/a_corn_03.png';
  }
  if (d===4){
    if ((s.fert ?? s?.inventory?.fertilizer ?? 1)===0) return 'img/a_corn_02_04.png';
    if ((s.water?? s?.inventory?.water ?? 1)===0)      return 'img/a_corn_02.png';
  }
  return `img/a_corn_${sheet}_${String(k).padStart(2,'0')}.png`;
}
function plantedSeedType(sum){
  const e=(sum?.growth?.seedType||sum?.field?.seedType||sum?.seedType||'').toLowerCase();
  if(['red','loan'].includes(e))   return 'red';
  if(['black','overdue','delinquent'].includes(e)) return 'black';
  if(['yellow','normal'].includes(e)) return 'yellow';
  const st=(sum?.status||sum?.state||'').toLowerCase();
  if(!(st.includes('plant')||st.includes('파종')||st.includes('grow')||st.includes('성장'))) return null;
  const ln=sum.loan||{};
  if(ln.status==='overdue') return 'black';
  if(ln.status==='loan')    return 'red';
  return 'yellow';
}
function paintBadge(sum){
  const b=$('#seedBadgeImg'); const t=plantedSeedType(sum);
  if(!t){ b.style.display='none'; return; }
  b.src = t==='red' ? 'img/corn-red.png' : (t==='black' ? 'img/corn-black.png' : 'img/corn-yellow.png');
  b.style.display='block';
}
function stateText(k){
  if(k==='fallow') return '휴경';
  if(k==='harvest')return '수확기';
  if(k==='missed') return '폐농';
  return '성장중';
}

/* 진행도/게이지/레벨 */
function paintBars(sum){
  const inv=sum.inventory||{};
  const w=Number(inv.water??sum.water??0), f=Number(inv.fertilizer??sum.fert??0);
  const g=Math.max(0,Math.min(100,Number(sum?.growthPercent ?? sum?.growth?.percent ?? 0)));
  $('#vbar-water').style.setProperty('--p',`${Math.round(clamp01(w/(sum?.limits?.waterMax||WATER_MAX))*100)}%`);
  $('#vbar-fert').style.setProperty('--p',`${Math.round(clamp01(f/(sum?.limits?.fertMax ||FERT_MAX ))*100)}%`);
  $('#vbar-grow').style.setProperty('--p',`${g}%`);
  $('#gfill').style.setProperty('--p',`${g}%`);
  $('#gnum').textContent = Math.round(g);
}
function levelSpriteIndex(L){ const cuts=[1,5,10,15,20,25,30,35,40,45,50]; let i=1; for(let k=0;k<cuts.length-1;k++){ if(L>=cuts[k]) i=k+1; } return Math.max(1,Math.min(10,i)); }
function computeLevel(sum){ const xp=(Number(sum?.agri?.corn??0)*10)+(Number(sum?.food?.popcorn??0)*5); const L=Math.max(1,Math.floor(Math.log10(xp+1))+1); const next=Math.pow(10,L)-1, prev=Math.pow(10,L-1)-1; const pct=Math.round((xp-prev)/Math.max(1,(next-prev))*100); return{level:L,percent:Math.max(0,Math.min(100,pct))}; }
function paintLevel(sum){ const {level,percent}=computeLevel(sum); $('#levelNum').textContent=level; $('#hbar-level').style.setProperty('--p',`${percent}%`); $('#charImg').src=`img/a_mark_${levelSpriteIndex(level).toString().padStart(2,'0')}.png`; }

/* 배경/미니/상태 문구 적용 */
async function paintFront(sum){
  await setBgImage(pickBackground(sum));
  const mini = $('#miniImg'); if (mini) mini.src = pickMiniSprite(sum);
  const stKey = (sum?.status||sum?.state||'fallow').toLowerCase();
  $('#miniCap').textContent = stateText(stKey.includes('fallow')?'fallow':(stKey.includes('harvest')?'harvest':(stKey.includes('missed')?'missed':'growing')));
  paintBadge(sum);
}

/* 요약 로드 */
async function loadSummary(){
  const s = await api(`/api/corn/summary?kakaoId=${encodeURIComponent(kakaoId)}`, { nocache:true })
              .catch(()=>api(`/api/corn/summary/${encodeURIComponent(kakaoId)}`, { nocache:true }));
  paintResources(s);
  await paintFront(s);
  paintBars(s);
  paintLevel(s);
  $('#nick').textContent='온라인 '+nickname;
  setNet(true);
  return s;
}

/* ----------------------- 구매 ----------------------- */
function openBuyAll(pref){
  $('#buyAllWallet').textContent=$('#r-orcx').textContent||'0';
  document.querySelectorAll('#buyAllModal .row[data-item]').forEach(r=>{
    const item=r.dataset.item;
    const q = r.querySelector('.qty');
    const s = r.querySelector('.sub');
    if (q) q.value = (pref===item)?1:0;
    if (s) s.textContent = '0';
  });
  updateBuyAllTotals();
  $('#buyAllModal').classList.add('show');
}
function closeBuyAll(){ $('#buyAllModal').classList.remove('show'); }
function updateBuyAllTotals(){
  let tot=0;
  document.querySelectorAll('#buyAllModal .row[data-item]').forEach(r=>{
    const item=r.dataset.item, price=PRICES[item];
    const qty=Math.max(0,parseInt(r.querySelector('.qty')?.value||'0',10));
    const sub=price*qty;
    r.querySelector('.sub').textContent=sub;
    tot+=sub;
  });
  $('#buyAllTotal').textContent=tot;
}
async function doBuyAll(){
  const lines=[];
  document.querySelectorAll('#buyAllModal .row[data-item]').forEach(r=>{
    const item=r.dataset.item;
    const qty=Math.max(0,parseInt(r.querySelector('.qty')?.value||'0',10));
    if(qty>0) lines.push({item,qty});
  });
  if(!lines.length) return toast('수량을 입력하세요');

 // ✅ 기존 doBuyAll 함수 내부의 try 블록 수정
try{
  for(const it of lines){
    await api('/api/corn/buy-additive', {
      method:'POST',
      body: { kakaoId, item:it.item, qty:it.qty },
      nocache:true
    });
  }
  toast('구매 완료');
  closeBuyAll();
  await loadSummary();
}catch(e){
  console.error(e);
  toast('구매 실패: '+e.message);
}
}
/* ---------------- 행동 ---------------- */

// 씨앗 심기
async function actPlant(){
  await api('/api/corn/plant', {
    method:'POST',
    body:{ kakaoId },
    nocache:true
  });
  toast('씨앗 심기 완료');
  await loadSummary();
}

// 물 주기
async function actWater(){
  await api('/api/user/inventory/use', {
    method:'POST',
    body:{ kakaoId, type:'water', amount:1 },
    nocache:true
  });
  toast('물 주기 완료');
  await loadSummary();
}

// 거름 주기
async function actFert(){
  await api('/api/user/inventory/use', {
    method:'POST',
    body:{ kakaoId, type:'fertilizer', amount:1 },
    nocache:true
  });
  toast('거름 주기 완료');
  await loadSummary();
}

// 설탕 사용
async function actSugar(){
  await api('/api/corn/use-additive', {
    method:'POST',
    body:{ kakaoId, type:'sugar', amount:1 },
    nocache:true
  });
  toast('설탕 사용 완료');
  await loadSummary();
}

// 소금 사용
async function actSalt(){
  await api('/api/corn/use-additive', {
    method:'POST',
    body:{ kakaoId, type:'salt', amount:1 },
    nocache:true
  });
  toast('소금 사용 완료');
  await loadSummary();
}

// 수확
async function actHarvest(){
  await api('/api/corn/harvest', {
    method:'POST',
    body:{ kakaoId },
    nocache:true
  });
  toast('수확 완료');
  await loadSummary();
}

// 뻥튀기 (팝콘 만들기)
async function actPop(){
  await api('/api/corn/pop', {
    method:'POST',
    body:{ kakaoId },
    nocache:true
  });
  toast('뻥튀기 완료');
  await loadSummary();
}

/* ----------------------- 연결 모달 ----------------------- */
function openApi(){ $('#apiInput').value = API_BASE || ''; $('#apiModal').classList.add('show'); }
function closeApi(){ $('#apiModal').classList.remove('show'); }

/* ----------------------- 부트스트랩 ----------------------- */
async function boot(){
  if (!API_BASE){
    // 수정: 무조건 모달 강제 오픈
    console.warn('[BOOT] API_BASE 없음 → 연결 모달 열기');
    openApi(); 
    setNet(false); 
    return;
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
  const on = (id, handler) => {
    const el = document.getElementById(id);
    if (el) el.onclick = handler;
    else console.warn('[MISSING]', id);
  };

  // 액션 버튼
  on('btn-plant', () => actPlant().then(loadSummary).catch(e=>toast(e.message)));
  on('btn-water', () => actWater().then(loadSummary).catch(e=>toast(e.message)));
  on('btn-fert',  () => actFert().then(loadSummary).catch(e=>toast(e.message)));
  on('btn-harv',  () => actHarvest().then(loadSummary).catch(e=>toast(e.message)));
  on('btn-pop',   () => actPop().then(loadSummary).catch(e=>toast(e.message)));
  on('btn-ex',    () => toast('팝콘→거름은 서버 엔진 규칙에 맞게 후속 연결'));

  // 구매 모달
  on('open-buy-all', () => openBuyAll());
  on('buyAllCancel', () => closeBuyAll());
  on('buyAllOK',     () => doBuyAll());

  // 구매 모달 내부 수량 증감
  document.querySelectorAll('#buyAllModal .row[data-item]').forEach(r=>{
    const dec=r.querySelector('.dec'), inc=r.querySelector('.inc'), qty=r.querySelector('.qty');
    dec?.addEventListener('click', ()=>{ qty.value=Math.max(0,parseInt(qty.value||'0',10)-1); updateBuyAllTotals(); });
    inc?.addEventListener('click', ()=>{ qty.value=Math.max(0,parseInt(qty.value||'0',10)+1); updateBuyAllTotals(); });
    qty?.addEventListener('input', updateBuyAllTotals);
  });

  // API 모달
  on('btn-api', openApi);
  on('apiCancel', closeApi);
  on('apiSave', ()=>{ saveAPI($('#apiInput').value); closeApi(); boot(); });
}

/* ----------------------- MAIN ----------------------- */
document.addEventListener('DOMContentLoaded', () => { bind(); boot(); });
