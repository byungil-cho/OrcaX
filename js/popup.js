/* ====== 고정 서버 주소 (주인님 지침) ====== */
const API_BASE = 'https://climbing-wholly-grouper.jp.ngrok.io';

/* ====== 상태 ====== */
const S = {
  kakaoId: localStorage.getItem('kakaoId') || '',
  user: null,
  serverOk: false,
  earnedSession: 0,   // 세션 누적 토큰(표시용)
  popping: false
};

/* ====== DOM 유틸 ====== */
const $ = id => document.getElementById(id);
const set = (id, v) => ($(id).textContent = v);

/* ====== 서버 핑 ====== */
async function pingServer(){
  try{
    const r = await fetch(API_BASE + '/api/ping', { cache:'no-store' });
    if(r.ok){ S.serverOk = true; $('dot').className='dot ok'; $('svtxt').textContent='✅ 서버 연결됨'; return; }
    throw 0;
  }catch(e){
    S.serverOk = false; $('dot').className='dot bad'; $('svtxt').textContent='❌ 서버 끊김';
  }
}

/* ====== 유저 상태 불러오기 (닉네임 보강) ====== */
async function loadUser(){
  const box = $('resultBox');
  if(!S.kakaoId){ paintUser(null); box.textContent='카카오 로그인 정보가 없습니다.'; return; }
  try{
    const res = await fetch(API_BASE + '/api/corn/userdata', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ kakaoId:S.kakaoId })
    });
    const data = await res.json();
    if(!data) throw 0;
    S.user = data; paintUser(data);
    checkReady();
  }catch(e){
    paintUser(null); box.textContent='❌ 유저 정보를 불러오지 못했습니다.';
  }
}

/* ====== 화면 그리기 ====== */
function paintUser(u){
  set('kakaoId', S.kakaoId || '-');
  const nick = u?.nickname || u?.profile?.nickname || localStorage.getItem('nickname') || '-';
  set('nickname', nick);

  const orcx  = Number(u?.wallet?.orcx ?? 0);
  const salt  = Number(u?.inventory?.salt ?? 0);
  const sugar = Number(u?.inventory?.sugar ?? 0);
  const corn  = Number(u?.inventory?.corn ?? 0);
  const pop   = Number(u?.products?.popcorn ?? 0);

  set('v-orcx', orcx); set('v-salt', salt); set('v-sugar', sugar); set('v-corn', corn); set('v-pop', pop);

  const color = (u?.inventory?.cornColor || 'yellow').toLowerCase();
  set('cornColorText', color);
  $('cornImg').src = ({
    black:'https://byungil-cho.github.io/OrcaX/img/corn-black.png',
    red:'https://byungil-cho.github.io/OrcaX/img/corn-red.png',
    yellow:'https://byungil-cho.github.io/OrcaX/img/corn-yellow.png'
  }[color]) || 'https://byungil-cho.github.io/OrcaX/img/corn-yellow.png';

  // 누적/합계 박스 갱신
  set('v-earned-session', S.earnedSession);
  set('v-wallet', orcx);
  set('v-total', orcx + S.earnedSession);
}

/* ====== 실행 가능(재료 + 서버) ====== */
function checkReady(){
  const salt  = Number(S.user?.inventory?.salt ?? 0);
  const sugar = Number(S.user?.inventory?.sugar ?? 0);
  const corn  = Number(S.user?.inventory?.corn ?? 0);
  const ok = salt>=1 && sugar>=1 && corn>=1 && S.serverOk && !S.popping;
  $('btnRun').disabled = !ok;
  $('resultBox').textContent = ok
    ? '✅ 준비 완료. 뻥튀기를 실행할 수 있습니다.'
    : `❌ 재료/서버 부족 — 소금:${salt} 설탕:${sugar} 옥수수:${corn} / 서버:${S.serverOk?'✅':'❌'}`;
}

/* ====== 풍선말(토큰) ====== */
function balloon(text){
  const card = $('card');
  const b = document.createElement('div');
  b.className = 'balloon';
  b.textContent = `+${Number(text).toLocaleString()} `;
  const x = 40 + Math.random()* (card.clientWidth - 120);
  const y = card.clientHeight - 120;
  b.style.left = x + 'px';
  b.style.top  = y + 'px';
  card.appendChild(b);
  // 애니메이션
  const dy = -60 - Math.random()*40;
  const dur = 800 + Math.random()*400;
  b.animate([{transform:'translateY(0)', opacity:1},{transform:`translateY(${dy}px)`, opacity:0}], {duration:dur, easing:'ease-out'});
  setTimeout(()=> b.remove(), dur);
}

/* ====== 1개씩 연속 팝(랜덤 토큰은 서버가 판정) ====== */
async function runPungBatch(){
  if(!S.serverOk) return toast('서버 오프라인입니다.');
  if(!S.kakaoId)  return toast('카카오 로그인 필요');
  if(S.popping)   return;

  try{
    S.popping = true;
    $('btnRun').disabled = true;

    // 현재 가능한 최대 횟수 = min(소금, 설탕, 옥수수)
    const salt  = Number(S.user?.inventory?.salt ?? 0);
    const sugar = Number(S.user?.inventory?.sugar ?? 0);
    const corn  = Number(S.user?.inventory?.corn ?? 0);
    let times = Math.min(salt, sugar, corn);

    if(times <= 0) { checkReady(); return; }

    $('resultBox').textContent = '🍿 뻥튀기 진행 중…';

    // 1개씩 순차 실행 — 매번 서버가 랜덤 토큰을 계산/저장해서 반환
    for(let i=0; i<times; i++){
      const one = await pungOnce();     // {token, user, message}
      if(!one) break;

      // 세션 누적/표시
      const t = Number(one.token||0);
      if(t>0){
        S.earnedSession += t;
        balloon(t);
      }

      // 최신 상태 반영
      if(one.user) S.user = one.user;
      paintUser(S.user);

      // 진행 문구
      $('resultBox').innerHTML = `🎉 축하합니다. <b>${t.toLocaleString()}</b> 토큰을 획득했습니다. <span class="muted">${one.message||''}</span>`;
      await sleep(250); // 너무 빠르면 풍선말이 겹쳐 보임
      // 다음 회차 가능 여부 갱신
      checkReady();
      if($('btnRun').disabled) break;
    }
  }catch(e){
    toast('뻥튀기 처리 중 오류가 발생했습니다.');
  }finally{
    S.popping = false;
    checkReady();
  }
}

/* ====== 1회 실행 요청 ====== */
async function pungOnce(){
  const res = await fetch(API_BASE + '/api/corn/pung', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ kakaoId:S.kakaoId, count:1 })   // 서버는 1개 처리, 재료 차감+랜덤 보상+저장 후 최신 상태 반환
  });
  if(!res.ok){
    const t = await res.text().catch(()=> '');
    toast('실행 실패: ' + (t||res.status));
    return null;
  }
  const data = await res.json();
  // 기대 응답:
  // { ok:true, message:"...", result:{ token:랜덤값, popcorn:1 }, user:{...최신...} }
  return {
    token: Number(data?.result?.token ?? 0),
    user:  data?.user || null,
    message: data?.message || ''
  };
}

/* ====== 기타 ====== */
function toast(m){ $('resultBox').textContent = '❌ ' + m; }
const sleep = ms => new Promise(r=>setTimeout(r, ms));

/* ====== 이벤트 ====== */
$('btnRun').addEventListener('click', runPungBatch);
$('btnReload').addEventListener('click', ()=>{ pingServer(); loadUser(); });

/* ====== 시작 ====== */
(async function init(){
  set('kakaoId', S.kakaoId||'-');
  await pingServer();
  await loadUser();
  checkReady();
})();
