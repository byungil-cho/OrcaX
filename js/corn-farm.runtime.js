/* corn-farm.runtime.js
 * 디자인 불변. 기능(API 연동/버튼 활성/미니이미지/등급/팝 연동)만 추가.
 */

// ==== 0) BASE 정규화 ====
const DEFAULT_ORIGIN = (localStorage.getItem('orcax:DEFAULT_ORIGIN') 
  || 'https://climbing-wholly-grouper.jp.ngrok.io').replace(/\/+$/,'');

const RAW_ORIGIN  = (localStorage.getItem('orcax:BASE_API') || DEFAULT_ORIGIN).replace(/\/+$/,'');
const BASE_ORIGIN = RAW_ORIGIN.replace(/\/api\/?$/i,'');
const API = (p) => `${BASE_ORIGIN}/api/${String(p||'').replace(/^\/+/,'')}`;

// ==== 1) 공통 fetch ====
async function jfetch(url, { method='GET', query, body, headers } = {}){
  let u = url;
  if (query){
    const qs = new URLSearchParams();
    Object.entries(query).forEach(([k,v]) => { if(v!=null) qs.set(k, String(v)) });
    const q = qs.toString();
    if(q) u += (u.includes('?') ? '&' : '?') + q;
  }
  const opts = { method, headers: Object.assign({ 'Accept':'application/json' }, headers||{}) };
  if (body != null){ opts.headers['Content-Type']='application/json'; opts.body = JSON.stringify(body); }
  const r = await fetch(u, Object.assign(opts, { mode:'cors', cache:'no-store' }));
  const text = await r.text();
  const isJson = (r.headers.get('content-type')||'').includes('application/json');
  const data = text ? (isJson ? JSON.parse(text) : { raw:text }) : {};
  if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}`), { data, status:r.status });
  return data;
}

// ==== 2) 로그인 체크 ====
function getKakaoId(){
  const id = localStorage.getItem('kakao_id') || localStorage.getItem('orcax:kakaoId') || '';
  return id;
}
function ensureLogin(){
  const kakaoId = getKakaoId();
  if (!kakaoId){
    alert('로그인이 필요합니다. (index9.html로 이동)');
    location.href = 'index9.html';
    return false;
  }
  return kakaoId;
}

// ==== 3) DOM Helpers ====
const $ = (sel) => document.querySelector(sel);
function setText(id, v){
  const el = document.getElementById(id);
  if (el) el.textContent = (v ?? '0');
}
function setDisabled(el, disabled){
  if (!el) return;
  el.disabled = !!disabled;
  el.classList.toggle('is-disabled', !!disabled);
}

// ==== 4) 상태 로드 ====
let state = { user:{}, corn:{}, summary:{} };

async function loadAll(){
  const kakaoId = ensureLogin(); if(!kakaoId) return;
  try{
    const [user, summary] = await Promise.all([
      jfetch(API('userdata'), { method:'POST', body:{ kakaoId } }),
      jfetch(API('corn/summary'), { method:'GET', query:{ kakaoId } }),
    ]);
    state.user = user || {};
    state.summary = summary || {};
    state.corn = summary?.corn || {};
    render();
  }catch(err){
    console.error('loadAll error', err);
    showToast('서버 연결 실패', 'error');
  }
}

// ==== 5) 렌더 ====
function isMobile(){
  return (window.matchMedia && matchMedia('(max-width: 640px)').matches) || (window.innerWidth <= 640);
}
function setMiniByGrowth(g){
  let mini = document.getElementById('mini-img') || document.querySelector('img[alt*="작물"]');
  if (!mini) return;
  const base = (g>=100)?'corn_ready.png'
    : (g>=70)?'corn_70.png'
    : (g>=50)?'corn_50.png'
    : (g>=30)?'corn_30.png'
    : (g>0)?'corn_seedling.png'
    : 'corn_empty.png';

  const preferMini = isMobile();
  const srcMini = `./img/a_${base}`;
  const srcFull  = `./img/${base}`;

  // a_버전 우선 사용, 없으면 자동 폴백
  mini.onerror = function(){
    if (mini.getAttribute('data-a-tried') === '1') return; // 이미 폴백됨
    mini.setAttribute('data-a-tried','1');
    mini.src = srcFull;
  };
  mini.setAttribute('data-a-tried', preferMini ? '0' : '1');
  mini.alt = '작물 상태';
  mini.src = preferMini ? srcMini : srcFull;
}
function render(){
  const u = state.user || {};
  const s = state.summary || {};
  const inv = s.inventory || {};
  const corn = s.corn || {};

  // 상단 리소스 수량
  setText('val-seed',      inv.seedCorn ?? inv.seed ?? 0);
  setText('val-water',     u.water ?? s.water ?? 0);
  setText('val-fertil',    u.fertilizer ?? s.fertilizer ?? 0);
  setText('val-corn',      s.cornCount ?? 0);
  setText('val-pop',       inv.popcorn ?? s.popcorn ?? 0);
  setText('val-salt',      inv.salt ?? 0);
  setText('val-sugar',     inv.sugar ?? 0);
  setText('val-token',     u.token ?? s.token ?? 0);

  // 성장도/게이지/미니
  const g = Math.max(0, Math.min(100, Number(corn.growth ?? s.growth ?? 0)));
  const gauge = document.getElementById('growth-bar');
  if (gauge) gauge.style.width = `${g}%`;
  const round = document.getElementById('gauge-round') || document.querySelector('.gauge-round,[data-gauge="round"]');
  if (round){ round.textContent = g; round.style.setProperty('--val', g); }
  setMiniByGrowth(g);

  // 예상 등급 표시
  const plantedAt = (corn.plantedAt || s.plantedAt || u.plantedAt);
  const grade = getCornGrade(plantedAt);
  setText('txt-grade', grade ? `예상 등급: ${gradeLabel(grade)}` : '예상 등급: -');

  // 버튼 활성/비활성
  const btnPlant = document.getElementById('btn-plant')     || [...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='씨앗 심기');
  const btnWater = document.getElementById('btn-water')     || [...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='물 주기');
  const btnFert  = document.getElementById('btn-fertilize') || [...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='거름 주기');
  const btnHarv  = document.getElementById('btn-harvest')   || [...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='수확');
  const btnPop   = document.getElementById('btn-pop')       || [...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='뻥튀기');
  const btnExch  = document.getElementById('btn-exchange')  || [...document.querySelectorAll('button')].find(b=>b.textContent.trim().includes('팝콘'));

  const hasSeed = (inv.seedCorn ?? inv.seed ?? 0) > 0;
  const hasWater = (u.water ?? s.water ?? 0) > 0;
  const hasFertil = (u.fertilizer ?? s.fertilizer ?? 0) > 0;
  const hasPop = (inv.popcorn ?? s.popcorn ?? 0) > 0;
  const readyToHarvest = (g >= 100);

  setDisabled(btnPlant, !(hasSeed && g === 0));          // 빈밭일 때만 심기
  setDisabled(btnWater, !(hasWater && g > 0 && g < 100));
  setDisabled(btnFert,  !(hasFertil && g > 0 && g < 100));
  setDisabled(btnHarv,  !readyToHarvest);
  setDisabled(btnPop,   !hasPop);
  setDisabled(btnExch,  !hasPop);
}

// ==== 5.5) 등급 산정 (A~F, KST 기준) ====
function toKST(date){
  const d = new Date(date);
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  return new Date(utc + 9*60*60000);
}
function getCornGrade(plantedAtIso, now = new Date()){
  try{
    if(!plantedAtIso) return null;
    const plantedKST = toKST(plantedAtIso);
    const nowKST = toKST(now);
    const ms = nowKST - plantedKST;
    if (Number.isNaN(ms) || ms < 0) return null;
    const days = ms / (1000*60*60*24);
    if (days < 5.0) return null;
    if (days < 6.0) return 'A';
    if (days < 7.0) return 'B';
    if (days < 8.0) return 'C';
    if (days < 9.0) return 'D';
    if (days < 10.0) return 'E';
    return 'F';
  }catch(e){ return null; }
}
function gradeLabel(g){
  if (!g) return '-';
  switch(g){
    case 'A': return 'A급';
    case 'B': return 'B급';
    case 'C': return 'C급';
    case 'D': return 'D급';
    case 'E': return 'E급';
    case 'F': return 'F급';
    default: return g;
  }
}

// ==== 6) 액션 ====
async function act(endpoint, body){
  const kakaoId = ensureLogin(); if(!kakaoId) return;
  try{
    await jfetch(API(endpoint), { method:'POST', body: Object.assign({ kakaoId }, body||{}) });
    await loadAll();
  }catch(err){
    const msg = err?.data?.message || `요청 실패: ${endpoint}`;
    showToast(msg, 'error');
    console.warn('act error', endpoint, err);
  }
}
function bindActions(){
  const byText = (t)=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===t);
  (document.getElementById('btn-plant')     || byText('씨앗 심기'))?.addEventListener('click', ()=>act('corn/plant'));
  (document.getElementById('btn-water')     || byText('물 주기'))?.addEventListener('click', ()=>act('corn/water'));
  (document.getElementById('btn-fertilize') || byText('거름 주기'))?.addEventListener('click', ()=>act('corn/fertilize'));
  (document.getElementById('btn-harvest')   || byText('수확'))?.addEventListener('click', ()=>{
    const plantedAt = (state.summary?.corn?.plantedAt || state.summary?.plantedAt || state.user?.plantedAt);
    act('corn/harvest', { gradeHint: getCornGrade(plantedAt) });
  });
  (document.getElementById('btn-pop')       || byText('뻥튀기'))?.addEventListener('click', ()=>act('corn/pop', { tokenCost: 30 }));
  (document.getElementById('btn-exchange')  || byText('팝콘↔거름') || byText('팝콘 ↔ 거름'))?.addEventListener('click', ()=>act('corn/exchange', { type:'popcorn-to-fertilizer', qty:1 }));
}

// ==== 7) UX 보조 ====
function showToast(msg, type){
  try{
    const el = document.getElementById('toast-area');
    if (!el) return alert(msg);
    const d = document.createElement('div');
    d.className = `toast ${type||''}`;
    d.textContent = msg;
    el.appendChild(d);
    setTimeout(() => d.remove(), 2500);
  }catch(e){ alert(msg); }
}

// ==== 8) 초기화 ====
window.addEventListener('DOMContentLoaded', () => {
  bindActions();
  loadAll();
});
