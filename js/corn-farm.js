'use strict';

/* ===== API ===== */
// ?api=... 없으면: localStorage → 없으면: 같은 오리진
const qs = new URLSearchParams(location.search);
const API_BASE = (qs.get('api') || localStorage.getItem('orcax_api') || window.location.origin).replace(/\/+$/,'');
localStorage.setItem('orcax_api', API_BASE);

/* ===== 사용자 ===== */
let kakaoId  = qs.get('kakaoId')  || localStorage.getItem('kakaoId');
let nickname = qs.get('nickname') || localStorage.getItem('nickname');
if (!kakaoId || !nickname) {
  nickname = nickname || prompt('닉네임을 입력하세요','범고래X') || 'Guest';
  kakaoId  = kakaoId  || ('K' + Math.random().toString(36).slice(2,10));
  localStorage.setItem('nickname', nickname);
  localStorage.setItem('kakaoId', kakaoId);
}

/* ===== 상수/유틸 (서버 무변경 전제) ===== */
const PRICES = { salt:10, sugar:20, seed:100 }; // 서버 설정과 동일하게 유지(소금10/설탕20/씨옥수수100)
const WATER_MAX = 10, FERT_MAX = 10;
const clamp01 = x => Math.max(0, Math.min(1, x));
const $ = sel => document.querySelector(sel);

function setNet(ok){ const d=$('#netDot'); if(d) d.classList.toggle('ok', !!ok); }
function showToast(msg){ const t=$('#toast'); if(!t) return; t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2200); }

async function api(path, {method='GET', body=null} = {}){
  const url = `${API_BASE}${path}`;
  const opt = { method, headers: { 'Content-Type':'application/json' } };
  if (body) opt.body = JSON.stringify(body);
  const res = await fetch(url, opt);
  let data = null; try{ data = await res.json(); }catch{}
  if(!res.ok) throw new Error((data && (data.message||data.error)) || res.statusText);
  return data;
}

/* ===== init-user (엔진 기존 라우트만 사용) ===== */
async function ensureUser(kakaoId, nickname){
  // GET 우선 → 실패 시 POST
  try { return await api(`/api/init-user?kakaoId=${encodeURIComponent(kakaoId)}&nickname=${encodeURIComponent(nickname)}`); }
  catch { return await api('/api/init-user',{method:'POST', body:{kakaoId,nickname}}); }
}

/* ===== 리소스 ===== */
function readSeedTotal(s){
  const cands = [
    s?.seedKinds?.total, s?.seedTotal, s?.seedsTotal,
    s?.agri?.seedTotal, s?.agri?.seedCorn, s?.user?.agri?.seedCorn,
    s?.seedCorn, s?.seed_corn, s?.seeds, s?.seed
  ];
  for (const v of cands) if (v != null) return Number(v)||0;
  return 0;
}

function updateResourcesFromSummary(s){
  const inv = s.inventory || {};
  const ag  = s.agri || {};
  const add = s.additives || {};
  const food= s.food || {};
  const wal = s.wallet || {};

  $('#r-seeds').textContent = readSeedTotal(s);
  $('#r-water').textContent = inv.water ?? 0;          // 공용(users)에서 온 값이면 summary가 채워줌
  $('#r-fert').textContent  = inv.fertilizer ?? 0;     // 동일
  $('#r-corn').textContent  = ag.corn ?? 0;
  $('#r-pop').textContent   = food.popcorn ?? 0;
  $('#r-salt').textContent  = add.salt ?? 0;
  $('#r-sugar').textContent = add.sugar ?? 0;
  $('#r-orcx').textContent  = wal.orcx ?? 0;
}

/* ===== 상태/게이지/미니이미지 ===== */
function stateKey(v){
  if (!v) return 'idle';
  const s = String(v).toLowerCase();
  if (s.includes('휴경') || s.includes('idle')) return 'idle';
  if (s.includes('파종') || s.includes('plant')) return 'planted';
  if (s.includes('성장') || s.includes('grow')) return 'growing';
  if (s.includes('수확') || s.includes('harvest')) return 'harvestable';
  return 'idle';
}
function paintState(sum){
  const percent = Math.max(0, Math.min(100, Number(sum?.growth?.percent ?? 0)));
  $('#gfill')?.style.setProperty('--p', `${percent}%`);
  $('#gnum').textContent = Math.round(percent);

  const k = stateKey(sum?.state || sum?.growth?.state);
  $('#miniCap').textContent = (k==='idle'?'휴경': k==='planted'?'파종': k==='growing'?'성장중':'수확가능');

  const imgMap = {
    idle:'img/a_corn_06_01.png',
    planted:'img/a_corn_04_01.png',
    growing:'img/a_corn_04_04.png',
    harvestable:'img/a_corn_06_04.png'
  };
  const mini = $('#miniImg');
  if(mini) mini.src = imgMap[k] || imgMap.idle;
}

/* ===== 세로 막대 ===== */
function paintSideBars(sum){
  const inv = sum.inventory || {};
  const water = Number(inv.water ?? 0);
  const fert  = Number(inv.fertilizer ?? 0);
  const growP = Math.max(0, Math.min(100, Number(sum?.growth?.percent ?? 0)));

  const wMax = Number(sum?.limits?.waterMax ?? WATER_MAX);
  const fMax = Number(sum?.limits?.fertMax  ?? FERT_MAX);

  const wP = Math.round(clamp01(water / (wMax || WATER_MAX)) * 100);
  const fP = Math.round(clamp01(fert  / (fMax || FERT_MAX))  * 100);

  $('#vbar-water')?.style.setProperty('--p', `${wP}%`);
  $('#vbar-fert') ?.style.setProperty('--p', `${fP}%`);
  $('#vbar-grow') ?.style.setProperty('--p', `${growP}%`);
}

/* ===== 씨앗 3종(인벤토리) → 항상 노란 씨앗만 활성 ===== */
function paintSeedKinds(sum){
  const total = readSeedTotal(sum);
  const set = (id, n) => {
    const box = document.getElementById(id);
    const num = document.getElementById(id+'-num');
    if (!box || !num) return;
    box.classList.toggle('off', !(n>0));
    num.textContent = n;
  };
  set('seed-normal', total);
  set('seed-loan',   0);
  set('seed-over',   0);
}

/* ===== 심어진 씨앗 배지 (노/빨/검) ===== */
function plantedSeedType(sum){
  const explicit = (sum?.growth?.seedType || sum?.field?.seedType || sum?.seedType || '').toLowerCase();
  if (['red','loan'].includes(explicit))   return 'red';
  if (['black','overdue'].includes(explicit)) return 'black';
  if (['yellow','normal'].includes(explicit)) return 'yellow';

  const st = (sum?.state || sum?.growth?.state || '').toLowerCase();
  if (!(st.includes('파종') || st.includes('plant') || st.includes('성장') || st.includes('grow'))) return null;

  const loan = sum.loan || {};
  if (loan.status === 'overdue') return 'black';
  if (loan.status === 'loan')    return 'red';
  return 'yellow';
}
function paintPlantedBadge(sum){
  const badge = $('#seedBadgeImg');
  if (!badge) return;
  const t = plantedSeedType(sum);
  if (!t){ badge.style.display='none'; return; }
  badge.src = t==='red' ? 'img/corn-red.png' : (t==='black' ? 'img/corn-black.png' : 'img/corn-yellow.png');
  badge.style.display = 'block';
  badge.onerror = ()=>{ badge.style.display='none'; };
}

/* ===== 레벨/캐릭터(간이 산식) ===== */
function computeLevel(sum){
  const xp = (Number(sum?.agri?.corn ?? 0) * 10) + (Number(sum?.food?.popcorn ?? 0) * 5);
  const L  = Math.max(1, Math.floor(Math.log10(xp + 1)) + 1);
  const nextCap = Math.pow(10, L) - 1, prevCap = Math.pow(10, L-1) - 1;
  const pct = Math.round((xp - prevCap) / Math.max(1, (nextCap - prevCap)) * 100);
  return { level: L, percent: Math.max(0, Math.min(100, pct)) };
}
function charSpriteByLevel(level){ const n=Math.max(1,Math.min(10,Math.floor(level))); const pad=n<10?`0${n}`:`${n}`; return `img/a_mark_${pad}.png`; }
function paintLevel(sum){
  const { level, percent } = computeLevel(sum);
  $('#levelNum').textContent = level;
  $('#hbar-level')?.style.setProperty('--p', `${percent}%`);
  const ci=$('#charImg'); if(ci) ci.src = charSpriteByLevel(level);
}

/* ===== 구매 모달 ===== */
let buyItem = null;
function openBuy(item){
  buyItem = item;
  $('#buyTitle').textContent = ({salt:'🧂 소금 구매', sugar:'🍬 설탕 구매', seed:'🌽 씨옥수수 구매'})[item];
  $('#buyPrice').textContent = `${PRICES[item]} ORCX / 개`;
  $('#buyQty').value = 1;
  $('#buyTotal').textContent = `${PRICES[item]} ORCX`;
  $('#buyModal').classList.add('show');
}
function closeBuy(){ $('#buyModal').classList.remove('show'); }
function updateBuyTotal(){
  const q = Math.max(1, parseInt($('#buyQty').value || '1',10));
  $('#buyQty').value = q;
  if (buyItem) $('#buyTotal').textContent = `${PRICES[buyItem]*q} ORCX`;
}
async function doBuy(){
  const qty = Math.max(1, parseInt($('#buyQty').value || '1',10));
  try{
    await api('/api/corn/buy',{method:'POST', body:{ kakaoId, item:buyItem, qty }});
    showToast('구매 완료');
    closeBuy();
    await loadFarm();
  }catch(e){
    showToast('구매 실패: ' + e.message);
    closeBuy();
  }
}

/* ===== 동작 ===== */
async function loadFarm(){
  try{
    await ensureUser(kakaoId, nickname);        // 감자/보리 공용 users 컬렉션 초기화
    const sum = await api(`/api/corn/summary?kakaoId=${encodeURIComponent(kakaoId)}`); // 옥수수 엔진 요약

    updateResourcesFromSummary(sum);  // (users + corn_data 합산 요약)
    paintState(sum);
    paintSideBars(sum);
    paintSeedKinds(sum);              // 인벤토리는 노란 씨앗만 활성
    paintPlantedBadge(sum);           // 심긴 씨앗 배지(노/빨/검)
    paintLevel(sum);

    const nickEl = $('#nick'); if (nickEl) nickEl.textContent = '온라인 ' + nickname;
    setNet(true);
  }catch(e){
    setNet(false);
    console.error(e);
    showToast('서버 연결 실패: ' + e.message);
  }
}

function bindEvents(){
  $('#btn-plant').onclick = async ()=>{
    try{ await api('/api/corn/plant',{method:'POST', body:{kakaoId}}); showToast('씨앗 심기 완료'); await loadFarm(); }
    catch(e){ showToast(e.message); }
  };
  $('#btn-water').onclick = ()=> showToast('물 주기는 감자/공용 자원입니다');
  $('#btn-fert').onclick  = ()=> showToast('거름 주기는 감자/공용 자원입니다');

  $('#btn-harv').onclick  = async ()=>{
    try{ const r=await api('/api/corn/harvest',{method:'POST', body:{kakaoId}}); showToast(`수확 +${r.gain} (씨앗:${r.seedType||'-'})`); await loadFarm(); }
    catch(e){ showToast(e.message); }
  };

  $('#btn-pop').onclick   = async ()=>{
    try{
      const use = confirm('설탕 사용? (취소=소금)') ? 'sugar' : 'salt';
      const r = await api('/api/corn/pop',{method:'POST', body:{kakaoId,use}});
      // 서버가 fee/seedType을 주면 표시, 없으면 지급량만 표시
      if (typeof r.fee !== 'undefined' || r.seedType){
        showToast(`지급 ${r.qty} (공제 ${r.fee ?? '?'} , 씨앗 ${r.seedType ?? '?'})`);
      } else {
        showToast(`지급 ${r.qty}`);
      }
      await loadFarm();
    }catch(e){ showToast(e.message); }
  };

  $('#btn-ex').onclick    = ()=> showToast('팝콘→거름은 서버 엔진에 맞춰 별도 구현');

  // 구매
  $('#buy-salt').onclick  = ()=>openBuy('salt');
  $('#buy-sugar').onclick = ()=>openBuy('sugar');
  $('#buy-seed').onclick  = ()=>openBuy('seed');
  $('#buyQty').addEventListener('input', updateBuyTotal);
  $('#buyCancel').onclick = closeBuy;
  $('#buyOK').onclick     = doBuy;

  // 초기에 배지는 숨김
  const badge = $('#seedBadgeImg'); if (badge) badge.style.display='none';
}

document.addEventListener('DOMContentLoaded', ()=>{
  bindEvents();
  loadFarm();
  // 10초 주기 새로고침 (엔진 실시간 반영)
  setInterval(loadFarm, 10000);
});
