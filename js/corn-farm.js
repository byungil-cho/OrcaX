'use strict';

/* ===== API 서버 경로 설정 =====
   - URL에 ?api=https://<ngrok> 붙이면 자동 인식
   - 없으면 로컬스토리지 → 마지막 기본값 순으로 사용 */
const qs = new URLSearchParams(location.search);
const API_BASE =
  (qs.get('api') || localStorage.getItem('orcax_api') || "https://climbing-wholly-grouper.jp.ngrok.io")
  .replace(/\/+$/,'');
localStorage.setItem('orcax_api', API_BASE);

/* ===== 사용자 식별 (쿼리 → 저장값 → 프롬프트) ===== */
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

/* ===== 리소스 렌더링 ===== */
function updateResourcesFromSummary(s){
  const inv = s.inventory || {};
  const ag  = s.agri || {};
  const add = s.additives || {};
  const food= s.food || {};
  const wal = s.wallet || {};

  // 씨앗 필드 보수적 매핑 (ag.seeds, user.agri.seedCorn, s.seed 다 지원)
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

/* ===== 농장 상태 불러오기 ===== */
async function loadFarm(){
  try{
    // 1) 서버 핑
    await api('/api/health');
    setNet(true);

    // 2) 유저 보장 (users + corn_data 동시 upsert)
    await ensureUser(kakaoId, nickname);

    // 3) 요약
    const sum = await api(`/api/corn/summary?kakaoId=${encodeURIComponent(kakaoId)}`);
    updateResourcesFromSummary(sum);
    document.getElementById('nick').textContent = nickname;
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

  // 물/거름 기능은 현재 corn 엔진 미지원
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

  // 교환은 팝콘 → 거름만 허용
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
