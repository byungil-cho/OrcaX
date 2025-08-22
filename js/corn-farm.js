'use strict';

/* ===== 서버 상태 불빛 표시 ===== */
function setNet(ok){
  const d=document.getElementById('netDot');
  if(d) d.classList.toggle('ok', !!ok);
}

/* ===== 자원 및 상태 업데이트 ===== */
function updateResources(data){
  document.getElementById('r-seeds').textContent = data.seeds ?? 0;
  document.getElementById('r-water').textContent = data.water ?? 0;
  document.getElementById('r-fert').textContent = data.fertilizer ?? 0;
  document.getElementById('r-corn').textContent = data.corn ?? 0;
  document.getElementById('r-pop').textContent = data.popcorn ?? 0;
  document.getElementById('r-salt').textContent = data.salt ?? 0;
  document.getElementById('r-sugar').textContent = data.sugar ?? 0;
  document.getElementById('r-orcx').textContent = data.token ?? 0;
}

/* ===== 토스트 메시지 ===== */
function showToast(msg){
  const t=document.getElementById('toast');
  if(!t) return;
  t.textContent=msg;
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),2000);
}

/* ===== 농장 상태 불러오기 ===== */
async function loadFarm(){
  try{
    const res=await fetch('/api/farm/status'); // 실제 API 엔드포인트로 교체 필요
    if(!res.ok) throw new Error('서버 오류');
    const data=await res.json();
    setNet(true);
    updateResources(data);
    document.getElementById('nick').textContent=data.nickname || '(알 수 없음)';
  }catch(e){
    setNet(false);
    console.error(e);
  }
}

/* ===== 버튼 이벤트 ===== */
function bindEvents(){
  document.getElementById('btn-plant').onclick=()=>showToast('씨앗 심기!');
  document.getElementById('btn-water').onclick=()=>showToast('물 주기!');
  document.getElementById('btn-fert').onclick=()=>showToast('거름 주기!');
  document.getElementById('btn-harv').onclick=()=>showToast('수확!');
  document.getElementById('btn-pop').onclick=()=>showToast('뻥튀기!');
  document.getElementById('btn-ex').onclick=()=>showToast('팝콘↔거름 교환!');
}

/* ===== 초기 실행 ===== */
document.addEventListener('DOMContentLoaded',()=>{
  bindEvents();
  loadFarm();
  setInterval(loadFarm,10000); // 10초마다 상태 갱신
});
