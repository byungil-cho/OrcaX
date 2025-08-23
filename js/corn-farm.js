/* corn-farm.runtime.js
 * 연결·상태·버튼 활성화·미니이미지 복구 통합 스크립트
 * 디자인 불변. HTML에는 버튼/요소에 id만 부여하면 됩니다.
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
  // 프로젝트 표준 키 사용
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
function render(){
  const u = state.user || {};
  const s = state.summary || {};
  const inv = s.inventory || {};
  const corn = s.corn || {};

  // 상단 리소스 수량 반영 (id는 자유, 있으면 반영됨)
  setText('val-seed',      inv.seedCorn ?? inv.seed ?? 0);
  setText('val-water',     u.water ?? s.water ?? 0);
  setText('val-fertil',    u.fertilizer ?? s.fertilizer ?? 0);
  setText('val-corn',      s.cornCount ?? 0);
  setText('val-pop',       inv.popcorn ?? s.popcorn ?? 0);
  setText('val-salt',      inv.salt ?? 0);
  setText('val-sugar',     inv.sugar ?? 0);
  setText('val-token',     u.token ?? s.token ?? 0);

  // 미니 이미지 & 게이지
  const g = Math.max(0, Math.min(100, Number(corn.growth ?? s.growth ?? 0)));
  const mini = document.getElementById('mini-img');
  if (mini){
    mini.alt = '작물 상태';
    mini.src = (g >= 100) ? './img/corn_ready.png'
      : (g >= 70) ? './img/corn_70.png'
      : (g >= 50) ? './img/corn_50.png'
      : (g >= 30) ? './img/corn_30.png'
      : (g >  0 ) ? './img/corn_seedling.png'
      : './img/corn_empty.png';
  }
  const gauge = document.getElementById('growth-bar');
  if (gauge) gauge.style.width = `${g}%`;

  // 버튼 활성/비활성
  const btnPlant = document.getElementById('btn-plant');
  const btnWater = document.getElementById('btn-water');
  const btnFert  = document.getElementById('btn-fertilize');
  const btnHarv  = document.getElementById('btn-harvest');
  const btnPop   = document.getElementById('btn-pop');
  const btnExch  = document.getElementById('btn-exchange');

  const hasSeed = (inv.seedCorn ?? inv.seed ?? 0) > 0;
  const hasWater = (u.water ?? s.water ?? 0) > 0;
  const hasFertil = (u.fertilizer ?? s.fertilizer ?? 0) > 0;
  const hasPop = (inv.popcorn ?? s.popcorn ?? 0) > 0;
  const readyToHarvest = (g >= 100);

  setDisabled(btnPlant, !hasSeed || g > 0);          // 빈 밭일 때만 심기
  setDisabled(btnWater, !hasWater || g <= 0 || g >= 100);
  setDisabled(btnFert,  !hasFertil || g <= 0 || g >= 100);
  setDisabled(btnHarv,  !readyToHarvest);
  setDisabled(btnPop,   !hasPop);                    // 팝콘 있을 때만
  setDisabled(btnExch,  !hasPop);                    // 1:1 교환 기본

  // 상태 텍스트 (있으면)
  setText('txt-status', readyToHarvest ? '수확 가능' : (g>0 ? `성장 중 (${g}%)` : '빈 밭'));
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

// 버튼 연결
function bindActions(){
  const map = [
    ['#btn-plant',     () => act('corn/plant')],
    ['#btn-water',     () => act('corn/water')],
    ['#btn-fertilize', () => act('corn/fertilize')],
    ['#btn-harvest',   () => act('corn/harvest')],
    ['#btn-pop',       () => act('corn/pop', { tokenCost: 30 })],
    ['#btn-exchange',  () => act('corn/exchange', { type:'popcorn-to-fertilizer', qty:1 })],
  ];
  for (const [sel, fn] of map){
    const el = document.querySelector(sel);
    if (el) el.onclick = fn;
  }
}

// ==== 7) UX 보조 ====
function showToast(msg, type){
  // 최소 보장용. 디자인 변경 없이 alert 대체
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
