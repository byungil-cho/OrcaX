'use strict';

/* ===== API 서버 경로 설정 ===== */
const qs = new URLSearchParams(location.search);
const API_BASE =
  (qs.get('api') || localStorage.getItem('orcax_api') || "https://climbing-wholly-grouper.jp.ngrok.io")
  .replace(/\/+$/,'');
localStorage.setItem('orcax_api', API_BASE);

/* ===== 사용자 식별 ===== */
let kakaoId  = qs.get('kakaoId')  || localStorage.getItem('kakaoId');
let nickname = qs.get('nickname') || localStorage.getItem('nickname');
if (!kakaoId || !nickname) {
  nickname = nickname || prompt('닉네임을 입력하세요','범고래X') || 'Guest';
  kakaoId  = kakaoId  || ('K' + Math.random().toString(36).slice(2,10));
  localStorage.setItem('nickname', nickname);
  localStorage.setItem('kakaoId', kakaoId);
}

/* ===== 서버 상태 불빛 표시 ===== */
function setNet(ok){
  const d=document.getElementById('netDot');
  if(d) d.classList.toggle('ok', !!ok);
}

/* ===== 토스트 ===== */
function showToast(msg){
  const t=document.getElementById('toast');
  if(!t) return;
  t.textContent=msg;
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),2000);
}

/* ===== 공통 fetch ===== */
async function api(path, {method='GET', body=null} = {}){
  const url = `${API_BASE}${path}`;
  const opt = { method, headers: { 'Content-Type':'application/json' } };
  if (body) opt.body = JSON.stringify(body);
  const res = await fetch(url, opt);
  let data=null; try{ data = await res.json(); }catch{}
  if(!res.ok) throw new Error((data && (data.message||data.error)) || res.statusText);
  return data;
}

/* ===== init-user (GET → 실패 시 POST fallback) ===== */
async function ensureUser(kakaoId, nickname){
  try {
    return await api(`/api/init-user?kakaoId=${encodeURIComponent(kakaoId)}&nickname=${encodeURIComponent(nickname)}`);
  } catch(e) {
    return await api('/api/init-user',{method:'POST', body:{kakaoId,nickname}});
  }
}

/* ===== 리소스 렌더링 ===== */
function updateResourcesFromSummary(s){
  const inv = s.inventory || {};
  const ag  = s.agri || {};
  const add = s.additives || {};
  const food= s.food || {};
  const wal = s.wallet || {};

  const seedCount = (ag.seeds ?? s.user?.agri?.seedCorn ?? s.seed ?? 0);

  document.getElementById('r-seeds').textContent = seedCount;
  document.getElementById('r-water').textContent = inv.water ?? 0;
  document.getElementById('r-fert').textContent  = inv.fertilizer ?? 0;
  document.getElementById('r-corn').textContent  = ag.corn ?? 0;
  document.getElementById('r-pop').textContent   = food.popcorn ?? 0;
  document.getElementById('r-salt').textContent  = add.salt ?? 0;
  document.getElementById('r-sugar').textContent = add.sugar ?? 0;
  document.getElementById('r-orcx').textContent  = wal.orcx ?? 0;
}

/* ===== 상태/게이지/미니이미지 ===== */
function paintState(sum){
  const percent = Math.max(0, Math.min(100, Number(sum?.growth?.percent ?? 0)));
  const g = document.getElementById('gfill'); if (g) g.style.setProperty('--p', `${percent}%`);
  const gn = document.getElementById('gnum'); if (gn) gn.textContent = Math.round(percent);

  const state = (sum?.state || sum?.growth?.state || 'idle');
  const mini = document.getElementById('miniImg');
  const cap  = document.getElementById('miniCap');
  if (cap) cap.textContent = (state==='idle'?'휴경': state==='planted'?'파종': state==='growing'?'성장중':'수확가능');

  const imgMap = {
    idle:'img/a_corn_06_01.png',
    planted:'img/a_corn_04_01.png',
    growing:'img/a_corn_04_04.png',
    harvestable:'img/a_corn_06_04.png'
  };
  if(mini) mini.src = imgMap[state] || imgMap.idle;
}

/* ===== 미니 옆 세로 막대 3종 ===== */
const WATER_MAX = 10, FERT_MAX = 10;
const clamp01 = x => Math.max(0, Math.min(1, x));

function paintSideBars(sum){
  const inv = sum.inventory || {};
  const water = Number(inv.water ?? 0);
  const fert  = Number(inv.fertilizer ?? 0);
  const growP = Math.max(0, Math.min(100, Number(sum?.growth?.percent ?? 0)));

  const wMax = Number(sum?.limits?.waterMax ?? WATER_MAX);
  const fMax = Number(sum?.limits?.fertMax  ?? FERT_MAX);

  const wP = Math.round(clamp01(water / (wMax || WATER_MAX)) * 100);
  const fP = Math.round(clamp01(fert  / (fMax || FERT_MAX))  * 100);

  const W = document.getElementById('vbar-water'); if (W) W.style.setProperty('--p', `${wP}%`);
  const F = document.getElementById('vbar-fert');  if (F) F.style.setProperty('--p', `${fP}%`);
  const G = document.getElementById('vbar-grow');  if (G) G.style.setProperty('--p', `${growP}%`);

  const Wn = document.getElementById('vnum-water'); if (Wn) Wn.textContent = water;
  const Fn = document.getElementById('vnum-fert');  if (Fn) Fn.textContent = fert;
  const Gn = document.getElementById('vnum-grow');  if (Gn) Gn.textContent = `${growP}%`;
}

/* ===== 레벨 계산 + 가로바 ===== */
function computeLevel(sum){
  if (sum?.level != null && sum?.levelProgress != null){
    return { level: Number(sum.level)||1, percent: Math.round(Math.max(0,Math.min(100, Number(sum.levelProgress)))) };
  }
  const explicit = sum?.user?.level, explicitPct = sum?.user?.levelProgress;
  if (explicit != null && explicitPct != null){
    return { level: Number(explicit)||1, percent: Math.round(Math.max(0,Math.min(100, Number(explicitPct)))) };
  }
  // 간이 규칙
  const xp = (Number(sum?.agri?.corn ?? 0) * 10) + (Number(sum?.food?.popcorn ?? 0) * 5);
  const L  = Math.max(1, Math.floor(Math.log10(xp + 1)) + 1);
  const nextCap = Math.pow(10, L) - 1;
  const prevCap = Math.pow(10, L-1) - 1;
  const pct = Math.round((xp - prevCap) / Math.max(1, (nextCap - prevCap)) * 100);
  return { level: L, percent: Math.max(0, Math.min(100, pct)) };
}

function paintLevel(sum){
  const { level, percent } = computeLevel(sum);
  const elLv = document.getElementById('levelNum'); if (elLv) elLv.textContent = level;
  const hb = document.getElementById('hbar-level'); if (hb) hb.style.setProperty('--p', `${percent}%`);
}

/* ===== 농장 상태 불러오기 ===== */
async function loadFarm(){
  try{
    await api('/api/health'); setNet(true);
    await ensureUser(kakaoId, nickname);
    const sum = await api(`/api/corn/summary?kakaoId=${encodeURIComponent(kakaoId)}`);

    updateResourcesFromSummary(sum);
    paintState(sum);
    paintSideBars(sum);
    paintLevel(sum);

    const nickEl = document.getElementById('nick'); if (nickEl) nickEl.textContent = nickname;
  }catch(e){
    setNet(false);
    console.error(e);
    showToast('서버 연결 실패: ' + e.message);
  }
}

/* ===== 버튼 이벤트 ===== */
function bindEvents(){
  document.getElementById('btn-plant').onclick = async ()=>{
    try{ await api('/api/corn/plant',{method:'POST', body:{kakaoId}}); showToast('씨앗 심기 완료'); await loadFarm(); }
    catch(e){ showToast(e.message); }
  };
  document.getElementById('btn-water').onclick = ()=> showToast('Corn 엔진: 물 주기 기능 없음');
  document.getElementById('btn-fert').onclick  = ()=> showToast('Corn 엔진: 거름 주기 기능 없음');

  document.getElementById('btn-harv').onclick  = async ()=>{
    try{ const r=await api('/api/corn/harvest',{method:'POST', body:{kakaoId}}); showToast(`수확 +${r.gain}`); await loadFarm(); }
    catch(e){ showToast(e.message); }
  };

  document.getElementById('btn-pop').onclick   = async ()=>{
    try{
      const use = confirm('설탕 사용? (취소=소금)') ? 'sugar' : 'salt';
      const r = await api('/api/corn/pop',{method:'POST', body:{kakaoId,use}});
      showToast(r.result==='popcorn' ? `팝콘 +${r.qty}` : `ORCX +${r.qty}`); await loadFarm();
    }catch(e){ showToast(e.message); }
  };

  // 교환은 팝콘 → 거름만
  document.getElementById('btn-ex').onclick    = async ()=>{
    try{
      const qty = parseInt(prompt('팝콘 → 거름 수량','1')||'1',10);
      if(!(qty>0)) return;
      await api('/api/corn/exchange',{method:'POST', body:{kakaoId,dir:'popcorn->fertilizer',qty}});
      showToast('팝콘→거름 교환 완료'); await loadFarm();
    }catch(e){ showToast(e.message); }
  };
}

/* ===== 초기 실행 ===== */
document.addEventListener('DOMContentLoaded',()=>{
  bindEvents();
  loadFarm();
  setInterval(loadFarm, 10000);
});
