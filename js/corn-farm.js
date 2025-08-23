'use strict';

// ===== API base =====
const qs = new URLSearchParams(location.search);
const API_BASE = (qs.get('api') || localStorage.getItem('orcax_api') || window.location.origin).replace(/\/+$/,'');
localStorage.setItem('orcax_api', API_BASE);
console.log('[OrcaX Corn] API_BASE =', API_BASE);

// ===== User =====
let kakaoId  = qs.get('kakaoId')  || localStorage.getItem('kakaoId');
let nickname = qs.get('nickname') || localStorage.getItem('nickname');
if (!kakaoId || !nickname) {
  nickname = nickname || prompt('닉네임을 입력하세요','범고래X') || 'Guest';
  kakaoId  = kakaoId  || ('K' + Math.random().toString(36).slice(2,10));
  localStorage.setItem('nickname', nickname);
  localStorage.setItem('kakaoId', kakaoId);
}

// ===== Const/Util =====
const PRICES = { salt:10, sugar:20, seed:100 };
const WATER_MAX = 10, FERT_MAX = 10;
const clamp01 = x => Math.max(0, Math.min(1, x));
const $ = s => document.querySelector(s);

function setNet(ok){ $('#netDot')?.classList.toggle('ok', !!ok); }
function showToast(msg){ const t=$('#toast'); if(!t) return; t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2200); }

async function api(path, {method='GET', body=null} = {}){
  const url = `${API_BASE}${path}`;
  const opt = { method, headers: { 'Content-Type':'application/json' } };
  if (body) opt.body = JSON.stringify(body);
  const res = await fetch(url, opt);
  let data=null; try{ data = await res.json(); }catch{}
  if(!res.ok) throw new Error((data && (data.message||data.error)) || res.statusText);
  return data;
}

// 여러 후보 엔드포인트 중 하나 성공할 때까지 시도
async function tryEndpoints(list, body){
  let lastErr;
  for(const p of list){
    try{ return await api(p, {method:'POST', body}); }
    catch(e){ lastErr = e; }
  }
  throw lastErr || new Error('no endpoint');
}

// 이미지 preload 후 성공 시에만 배경 변경(실패하면 기존 유지)
function preload(src){
  return new Promise((resolve, reject)=>{
    const img = new Image();
    img.onload = () => resolve(src);
    img.onerror = reject;
    img.src = src;
  });
}

// ===== init-user =====
async function ensureUser(kakaoId, nickname){
  try { return await api(`/api/init-user?kakaoId=${encodeURIComponent(kakaoId)}&nickname=${encodeURIComponent(nickname)}`); }
  catch { return await api('/api/init-user',{method:'POST', body:{kakaoId,nickname}}); }
}

// ===== robust seed count =====
function readSeedTotal(s){
  const cands = [
    s?.seedKinds?.total, s?.seedTotal, s?.seedsTotal,
    s?.agri?.seedTotal, s?.agri?.seedCorn, s?.user?.agri?.seedCorn,
    s?.seedCorn, s?.seed_corn, s?.seeds, s?.seed, s?.agri?.seeds
  ];
  for (const v of cands) if (v != null) return Number(v)||0;
  return 0;
}

// ===== resources paint =====
function updateResourcesFromSummary(s){
  const inv = s.inventory || {};
  const ag  = s.agri || {};
  const add = s.additives || {};
  const food= s.food || {};
  const wal = s.wallet || {};

  $('#r-seeds').textContent = readSeedTotal(s);
  $('#r-water').textContent = inv.water ?? 0;
  $('#r-fert').textContent  = inv.fertilizer ?? 0;
  $('#r-corn').textContent  = ag.corn ?? 0;
  $('#r-pop').textContent   = food.popcorn ?? 0;
  $('#r-salt').textContent  = add.salt ?? 0;
  $('#r-sugar').textContent = add.sugar ?? 0;
  $('#r-orcx').textContent  = wal.orcx ?? 0;
}

// ===== state helpers =====
function stateKey(v){
  if (!v) return 'idle';
  const s = String(v).toLowerCase();
  if (s.includes('폐경') || s.includes('abandon')) return 'abandon';
  if (s.includes('휴경') || s.includes('idle'))    return 'idle';
  if (s.includes('파종') || s.includes('plant'))   return 'planted';
  if (s.includes('성장') || s.includes('grow'))    return 'growing';
  if (s.includes('수확') || s.includes('harvest')) return 'harvestable';
  return 'idle';
}

// ===== background / mini image =====
function applyBackgroundSafe(k){
  const map = {
    idle:       ['img/bg_winter.png','img/farm_winter.png'],
    planted:    ['img/bg_spring.png','img/farm_spring.png'],
    growing:    ['img/bg_summer.png','img/farm_summer.png'],
    harvestable:['img/bg_autumn.png','img/farm_autumn.png'],
    abandon:    ['img/bg_fallow.png','img/farm_fallow.png']
  };
  const bg = $('#bg');
  if (!bg) return;

  const candidates = map[k] || [];
  if (candidates.length === 0) return;

  // 성공한 것만 적용
  (async ()=>{
    for (const src of candidates){
      try { await preload(src); bg.style.backgroundImage = `url('${src}')`; return; }
      catch { /* skip */ }
    }
    // 모두 실패하면 기존 배경 유지 (아무 것도 하지 않음)
  })();
}

function paintState(sum){
  const percent = Math.max(0, Math.min(100, Number(sum?.growth?.percent ?? 0)));
  $('#gfill')?.style.setProperty('--p', `${percent}%`);
  $('#gnum').textContent = Math.round(percent);

  const k = stateKey(sum?.state || sum?.growth?.state);
  $('#miniCap').textContent = (k==='idle'?'휴경': k==='planted'?'파종': k==='growing'?'성장중': k==='abandon'?'폐경':'수확가능');

  applyBackgroundSafe(k);

  const imgMap = {
    idle:'img/a_corn_winter.png',
    planted:'img/a_corn_04_01.png',
    growing:'img/a_corn_04_04.png',
    harvestable:'img/a_corn_06_04.png',
    abandon:'img/a_corn_fallow.png'
  };
  const mini = $('#miniImg');
  const desired = imgMap[k] || 'img/a_corn_06_01.png';
  if(mini){
    mini.src = desired;
    mini.onerror = () => { mini.src = 'img/a_corn_06_01.png'; };
  }
}

// ===== side bars =====
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

// ===== seed kinds =====
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

// ===== planted seed badge =====
function plantedSeedType(sum){
  const explicit = (sum?.growth?.seedType || sum?.field?.seedType || sum?.seedType || '').toLowerCase();
  if (['red','loan'].includes(explicit))      return 'red';
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

// ===== level/character =====
function levelSpriteIndex(level){
  const cuts = [1,5,10,15,20,25,30,35,40,45,50];
  let idx = 1;
  for (let i=0;i<cuts.length-1;i++){ if (level >= cuts[i]) idx = i+1; }
  return Math.max(1, Math.min(10, idx));
}
function computeLevel(sum){
  const xp = (Number(sum?.agri?.corn ?? 0) * 10) + (Number(sum?.food?.popcorn ?? 0) * 5);
  const L  = Math.max(1, Math.floor(Math.log10(xp + 1)) + 1);
  const nextCap = Math.pow(10, L) - 1, prevCap = Math.pow(10, L-1) - 1;
  const pct = Math.round((xp - prevCap) / Math.max(1, (nextCap - prevCap)) * 100);
  return { level: L, percent: Math.max(0, Math.min(100, pct)) };
}
function charSpriteByLevel(level){
  const idx = levelSpriteIndex(level);
  const pad = idx<10?`0${idx}`:`${idx}`;
  return `img/a_mark_${pad}.png`;
}
function paintLevel(sum){
  const { level, percent } = computeLevel(sum);
  $('#levelNum').textContent = level;
  $('#hbar-level')?.style.setProperty('--p', `${percent}%`);
  const ci=$('#charImg'); if(ci) ci.src = charSpriteByLevel(level);
}

// ===== 3-in-1 구매 모달 =====
function openBuyAll(prefill){
  $('#buyAllWallet').textContent = $('#r-orcx').textContent || '0';
  document.querySelectorAll('#buyAllModal .row[data-item]').forEach(r=>{
    const item = r.getAttribute('data-item');
    r.querySelector('.qty').value = (prefill === item) ? 1 : 0;
  });
  updateBuyAllTotals();
  $('#buyAllModal').classList.add('show');
}
function closeBuyAll(){ $('#buyAllModal').classList.remove('show'); }

function updateBuyAllTotals(){
  let total = 0;
  document.querySelectorAll('#buyAllModal .row[data-item]').forEach(r=>{
    const item = r.getAttribute('data-item');
    const price= PRICES[item];
    const qty  = Math.max(0, parseInt(r.querySelector('.qty').value||'0',10));
    const sub  = price * qty;
    r.querySelector('.sub').textContent = sub.toString();
    total += sub;
  });
  $('#buyAllTotal').textContent = total.toString();
}

async function doBuyAll(){
  const lines = [];
  document.querySelectorAll('#buyAllModal .row[data-item]').forEach(r=>{
    const item = r.getAttribute('data-item');
    const qty  = Math.max(0, parseInt(r.querySelector('.qty').value||'0',10));
    if (qty>0) lines.push({item, qty});
  });
  if (lines.length===0) { showToast('수량을 입력하세요'); return; }

  try{
    for (const it of lines){
      // 기본 경로 실패 시 대체 엔드포인트 자동 재시도
      await tryEndpoints(
        [
          '/api/corn/buy',
          `/api/corn/buy-${it.item}`,           // /api/corn/buy-salt
          `/api/corn/${it.item}/buy`            // /api/corn/salt/buy
        ],
        { kakaoId, item: it.item, qty: it.qty }
      );
    }
    showToast('구매 완료');
    closeBuyAll();
    await loadFarm();
  }catch(e){
    console.error('[BUY-ALL FAIL]', e);
    showToast('구매 실패: ' + e.message);
  }
}

// ===== actions =====
async function loadFarm(){
  try{
    await ensureUser(kakaoId, nickname);
    const sum = await api(`/api/corn/summary?kakaoId=${encodeURIComponent(kakaoId)}`);

    updateResourcesFromSummary(sum);
    paintState(sum);
    paintSideBars(sum);
    paintSeedKinds(sum);
    paintPlantedBadge(sum);
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
  // 농장 버튼
  $('#btn-plant').onclick = async ()=>{
    try{ await tryEndpoints(['/api/corn/plant','/api/corn/seed','/api/corn/sow'], {kakaoId}); showToast('씨앗 심기 완료'); await loadFarm(); }
    catch(e){ showToast(e.message); }
  };
  $('#btn-water').onclick = async ()=>{
    try{
      await tryEndpoints(['/api/corn/water','/api/corn/give-water','/api/corn/watering'], {kakaoId});
      showToast('물 주기 완료'); await loadFarm();
    }catch(e){ showToast(e.message); }
  };
  $('#btn-fert').onclick  = async ()=>{
    try{
      await tryEndpoints(['/api/corn/fertilize','/api/corn/fert','/api/corn/give-fert'], {kakaoId});
      showToast('거름 주기 완료'); await loadFarm();
    }catch(e){ showToast(e.message); }
  };
  $('#btn-harv').onclick  = async ()=>{
    try{ const r=await tryEndpoints(['/api/corn/harvest'], {kakaoId}); showToast(`수확 +${r?.gain ?? ''}`); await loadFarm(); }
    catch(e){ showToast(e.message); }
  };
  $('#btn-pop').onclick   = async ()=>{
    try{
      const use = confirm('설탕 사용? (취소=소금)') ? 'sugar' : 'salt';
      const r = await tryEndpoints(['/api/corn/pop','/api/corn/popcorn'], {kakaoId,use});
      showToast(typeof r?.fee!=='undefined' ? `지급 ${r.qty} (공제 ${r.fee})` : `지급 ${r?.qty ?? ''}`);
      await loadFarm();
    }catch(e){ showToast(e.message); }
  };
  $('#btn-ex').onclick    = ()=> showToast('팝콘→거름은 서버 엔진에 맞춰 구현 예정');

  // 구매(통합)
  $('#open-buy-all').onclick = ()=> openBuyAll();

  // 모달 내부 +/-, input, 확인/취소
  const modal = $('#buyAllModal');
  modal.addEventListener('click', (e)=>{
    if (e.target.id === 'buyAllModal') closeBuyAll();
  });
  modal.querySelectorAll('.row[data-item]').forEach(row=>{
    const dec = row.querySelector('.dec');
    const inc = row.querySelector('.inc');
    const qty = row.querySelector('.qty');
    dec.onclick = ()=>{ qty.value = Math.max(0, parseInt(qty.value||'0',10)-1); updateBuyAllTotals(); };
    inc.onclick = ()=>{ qty.value = Math.max(0, parseInt(qty.value||'0',10)+1); updateBuyAllTotals(); };
    qty.addEventListener('input', updateBuyAllTotals);
    qty.addEventListener('keydown', e=>{ if(e.key==='Enter') doBuyAll(); });
  });
  $('#buyAllCancel').onclick = closeBuyAll;
  $('#buyAllOK').onclick     = doBuyAll;
}

document.addEventListener('DOMContentLoaded', ()=>{
  bindEvents();
  loadFarm();
  setInterval(loadFarm, 10000);
});
