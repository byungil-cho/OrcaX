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

function bind() {
  const on = (id, handler) => {
    const el = document.getElementById(id);
    if (el) el.onclick = handler;
    else console.warn('[MISSING]', id);
  };
/* ===============================
   Corn Image Mapper (r8)
   - 스펙: 엔진_05_종합_12_img.html
   =============================== */

const IMG = {
  // 배경 (계절/상태)
  bg: {
    enter: 'img/farm_00.png',   // 처음 접속
    fallow: 'img/farm_01.png',  // 휴농(씨앗 없음)
    d1: 'img/farm_03.png',      // 1일차
    d2: 'img/farm_05.png',      // 2일차
    d3: 'img/farm_07.png',      // 3일차
    d4: 'img/farm_09.png',      // 4일차
    harvest: 'img/farm_10.png', // 5일차 (수확기)
    missed: 'img/farm_12.png'   // 수확 시기 놓침/폐농
  },

  // 옥수수 미니 스프라이트(날짜별 시트 prefix)
  // day1=06, day2=04, day3=03, day4=02, day5+=01
  sheet: { 1: '06', 2: '04', 3: '03', 4: '02', 5: '01' },

  // 레벨 → 캐릭터 이미지
  avatar(level=1){
    if (level >= 50) return 'img/a_mark_08.png';
    if (level >= 40) return 'img/a_mark_07.png';
    if (level >= 30) return 'img/a_mark_06.png';
    if (level >= 20) return 'img/a_mark_05.png';
    if (level >= 10) return 'img/a_mark_04.png';
    if (level >= 5)  return 'img/a_mark_03.png';
    if (level >= 2)  return 'img/a_mark_02.png';
    return 'img/a_mark_01.png';
  }
};

/** 안전한 이미지 적용 (404 대비) */
async function setBgImage(url){
  const bg = document.getElementById('bg');
  if (!bg) return;
  // 프리로드 후 적용
  try {
    await new Promise((res, rej)=>{
      const im = new Image();
      im.onload = res; im.onerror = rej;
      im.src = url;
    });
    bg.style.backgroundImage = `url('${url}')`;
    bg.style.backgroundPosition = 'center';
    bg.style.backgroundSize = 'cover';
    bg.style.backgroundRepeat = 'no-repeat';
  } catch {
    // 폴백: 휴농
    bg.style.backgroundImage = `url('${IMG.bg.fallow}')`;
  }
}

/** 배경 선택 로직 */
function pickBackground(s) {
  // s.status: 'fallow'|'growing'|'harvest'|'missed' 등 사용 가정
  // s.day: 0(없음)~N
  if (!s || !s.day || s.status === 'fallow') return IMG.bg.fallow;
  if (s.status === 'missed') return IMG.bg.missed;     // 폐농/수확창구 지남
  if (s.status === 'harvest') return IMG.bg.harvest;   // 수확 가능
  const d = Math.max(1, Math.min(4, s.day));           // 1~4일차
  return [null, IMG.bg.d1, IMG.bg.d2, IMG.bg.d3, IMG.bg.d4][d];
}

/** 미니 스프라이트 선택 (게이지/부족상태 반영)
 *  - s.day: 1~ (5일차 이상은 01 시트)
 *  - s.stageIndex: 1~5 (하루 5구간), 없으면 growthPercent로 환산
 *  - s.water: 0~3, s.fert: 0/1 (또는 잔량)
 *  - s.status: 'fallow'|'growing'|'harvest'|'missed'
 */
function pickMiniSprite(s) {
  // 휴농/폐농 처리
  if (!s || s.status === 'fallow') return 'img/a_corn_06_01.png'; // 씨 심기 전
  if (s.status === 'missed') return 'img/a_corn_01_05.png';       // 눈사람

  // day별 시트 prefix
  const d = Math.max(1, Math.min(5, s.day || 1));
  const sheet = IMG.sheet[d] || '01';

  // 수확 윈도우 (5일차~)
  if (d === 5) {
    if (s.status === 'harvest') return 'img/a_corn_01_02.png'; // A급 수확 대기
    // harvest 아님: 품질 B~D 가정
    return 'img/a_corn_01_03.png';
  }

  // 하루 5구간: stageIndex 없으면 growthPercent로 환산
  let k = s.stageIndex;
  if (!k) {
    const gp = Math.max(0, Math.min(99, s.growthPercent ?? 0));
    k = 1 + Math.floor(gp / 20); // 0~99% → 1~5
  }
  k = Math.max(1, Math.min(5, k));

  // 3/4일차는 부족 상태 전용 이미지가 있음
  if (d === 3) {
    if (s.fert === 0) return 'img/a_corn_03_04.png'; // 거름 부족
    if (s.water === 0) return 'img/a_corn_03.png';   // 물 부족
  }
  if (d === 4) {
    if (s.fert === 0) return 'img/a_corn_02_04.png';
    if (s.water === 0) return 'img/a_corn_02.png';
  }

  // 일반 케이스
  return `img/a_corn_${sheet}_${String(k).padStart(2,'0')}.png`;
}

/** 정면 적용: 배경 / 미니 / 캐릭터 / 게이지 */
function applyFrontImages(summary){
  // 1) 배경
  const bgUrl = pickBackground(summary);
  setBgImage(bgUrl);

  // 2) 미니
  const mini = document.getElementById('mini-corn'); // <img id="mini-corn">
  if (mini) mini.src = pickMiniSprite(summary);

  // 3) 캐릭터(레벨)
  const avatar = document.getElementById('avatar-img'); // <img id="avatar-img">
  if (avatar) avatar.src = IMG.avatar(summary?.level ?? 1);

  // 4) 세로 게이지 (💧물, 🌿거름, 🌱성장)
  const gWater = document.getElementById('g-water');
  const gFert  = document.getElementById('g-fert');
  const gGrow  = document.getElementById('g-grow');

  // 물: 0~3칸 → 0, 33, 66, 100%
  if (gWater) {
    const w = Math.max(0, Math.min(3, summary?.water ?? 0));
    gWater.style.setProperty('--val', String([0,33,66,100][w]));
  }
  // 거름: 0/1 또는 퍼센트로 들어오면 0~100
  if (gFert) {
    let f = summary?.fert ?? 0;
    if (f <= 1) f = f*100;
    gFert.style.setProperty('--val', String(Math.max(0,Math.min(100,f))));
  }
  // 성장: 하루 5구간 → 0,20,40,60,80,100
  if (gGrow) {
    let k = summary?.stageIndex;
    if (!k) {
      const gp = summary?.growthPercent ?? 0;
      k = 1 + Math.floor(Math.max(0,Math.min(99,gp))/20);
    }
    const perc = Math.max(0, Math.min(100, (k-1)*20));
    gGrow.style.setProperty('--val', String(perc));
  }

  // 5) 씨앗 3종 상태 뱃지(노/빨/검) : id=seed-badge-normal|loan|delin
  const has = (id)=>document.getElementById(id);
  if (has('seed-badge-normal')) {
    ['seed-badge-normal','seed-badge-loan','seed-badge-delin'].forEach(id=>{
      const el = document.getElementById(id);
      if (!el) return;
      el.style.opacity = 0.2;
    });
    const badgeId = (summary?.seedType==='delinquent')
      ? 'seed-badge-delin'
      : (summary?.seedType==='loan' ? 'seed-badge-loan' : 'seed-badge-normal');
    const active = document.getElementById(badgeId);
    if (active) active.style.opacity = 1;
  }
}

  // 액션 버튼들 (없으면 경고만 찍고 넘어감)
  on('btn-plant', () => actPlant().then(loadSummary).catch(e => toast(e.message)));
  on('btn-water', () => actWater().then(loadSummary).catch(e => toast(e.message)));
  on('btn-fert',  () => actFert().then(loadSummary).catch(e => toast(e.message)));
  on('btn-harv',  () => actHarvest().then(loadSummary).catch(e => toast(e.message)));
  on('btn-pop',   () => actPop().then(loadSummary).catch(e => toast(e.message)));
  on('btn-ex',    () => toast('팝콘→거름은 서버 엔진 규칙에 맞게 후속 연결'));

  // 구매(통합) 모달
  on('open-buy-all', () => openBuyAll());
  on('buyAllCancel', () => closeBuyAll());
  on('buyAllOK',     () => doBuyAll());

  // 모달 내부 행 바인딩 (없으면 경고만)
  const rows = document.querySelectorAll('#buyAllModal .row[data-item]');
  if (rows.length === 0) console.warn('[MISSING] buyAllModal rows');

  rows.forEach(r => {
    const dec = r.querySelector('.dec');
    const inc = r.querySelector('.inc');
    const qty = r.querySelector('.qty');

    if (dec && qty) dec.addEventListener('click', () => {
      qty.value = Math.max(0, parseInt(qty.value || '0', 10) - 1);
      updateBuyAllTotals();
    });
    if (inc && qty) inc.addEventListener('click', () => {
      qty.value = Math.max(0, parseInt(qty.value || '0', 10) + 1);
      updateBuyAllTotals();
    });
    if (qty) qty.addEventListener('input', updateBuyAllTotals);
  });

  // API 연결 모달
  on('btn-api',   () => openApi());
  on('apiCancel', () => closeApi());
  on('apiSave',   async () => {
    const v = document.getElementById('apiInput')?.value.trim();
    if (!v || !/^https?:\/\//.test(v)) return toast('http(s):// 로 시작해야 합니다');
    saveAPI(v);
    closeApi();
    boot();
  });
}

document.addEventListener('DOMContentLoaded', ()=>{
  bind();
  boot();
  // 주기적 갱신
  setInterval(async ()=>{ if(API_BASE) { try{ await loadSummary(); setNet(true); }catch{ setNet(false); } } }, 10000);
});
