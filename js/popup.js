/* ===== 고정 서버 주소 ===== */
const API_BASE = 'https://climbing-wholly-grouper.jp.ngrok.io';

/* ===== 상태 ===== */
const S = {
  kakaoId: localStorage.getItem('kakaoId') || '',
  raw: null,          // 서버 원본
  user: null,         // 정규화된 뷰 모델
  serverOk: false,
  earnedSession: 0,
  popping: false
};

/* ===== DOM 유틸 ===== */
const $ = id => document.getElementById(id);
const set = (id, v) => ($(id).textContent = v);
const n = v => Number.isFinite(Number(v)) ? Number(v) : 0;
const g = (o, path) => path.split('.').reduce((a,k)=> (a && a[k] !== undefined ? a[k] : undefined), o);

/* ===== 서버 핑 ===== */
async function pingServer(){
  try{
    const r = await fetch(API_BASE + '/api/ping', { cache:'no-store' });
    if(r.ok){ S.serverOk = true; $('dot').className='dot ok'; $('svtxt').textContent='✅ 서버 연결됨'; return; }
    throw 0;
  }catch(e){
    S.serverOk = false; $('dot').className='dot bad'; $('svtxt').textContent='❌ 서버 끊김';
  }
}

/* ===== 유저 불러오기 ===== */
async function loadUser(){
  const box = $('resultBox');
  if(!S.kakaoId){ paint(null); box.textContent='카카오 로그인 정보가 없습니다.'; return; }
  try{
    const res = await fetch(API_BASE + '/api/corn/userdata', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ kakaoId:S.kakaoId })
    });
    const data = await res.json();
    if(!data) throw 0;
    S.raw = data;
    S.user = normalizeUser(data);
    paint(S.user);
    checkReady();
  }catch(e){
    paint(null); $('resultBox').textContent='❌ 유저 정보를 불러오지 못했습니다.';
  }
}

/* ===== 정규화: 다양한 필드명을 하나로 매핑 ===== */
function normalizeUser(raw){
  const out = {
    nickname: (raw?.nickname || g(raw,'profile.nickname') || localStorage.getItem('nickname') || '-'),
    cornColor: (g(raw,'inventory.cornColor') || g(raw,'corn.color') || 'yellow').toLowerCase(),
    wallet: { orcx: 0 },
    inventory: { salt:0, sugar:0, corn:0 },
    products: { popcorn:0 }
  };

  // ORCX(지갑)
  out.wallet.orcx = n(
    g(raw,'wallet.orcx') ?? g(raw,'wallet.balance') ?? g(raw,'tokens.orcx') ?? raw?.orcx
  );

  // 소금/설탕
  out.inventory.salt  = n( g(raw,'inventory.salt')  ?? g(raw,'corn.inventory.salt')  ?? g(raw,'agri.salt')  );
  out.inventory.sugar = n( g(raw,'inventory.sugar') ?? g(raw,'corn.inventory.sugar') ?? g(raw,'agri.sugar') );

  // 옥수수 수량 (여러 형태 호환)
  out.inventory.corn = n(
    g(raw,'inventory.corn') ?? g(raw,'inventory.cornCount') ??
    g(raw,'corn.data.count') ?? g(raw,'corn.count') ?? g(raw,'agri.corn')
  );

  // 팝콘
  out.products.popcorn = n(
    g(raw,'products.popcorn') ?? g(raw,'corn.products.popcorn') ?? raw?.popcorn
  );

  return out;
}

/* ===== 화면 렌더 ===== */
function paint(u){
  set('kakaoId', S.kakaoId || '-');
  set('nickname', u?.nickname || '-');

  const orcx = n(u?.wallet?.orcx);
  const salt = n(u?.inventory?.salt);
  const sugar= n(u?.inventory?.sugar);
  const corn = n(u?.inventory?.corn);
  const pop  = n(u?.products?.popcorn);

  set('v-orcx', orcx); set('v-salt', salt); set('v-sugar', sugar); set('v-corn', corn); set('v-pop', pop);

  const color = (u?.cornColor || 'yellow').toLowerCase();
  set('cornColorText', color);
  $('cornImg').src = ({
    black:'https://byungil-cho.github.io/OrcaX/img/corn-black.png',
    red:'https://byungil-cho.github.io/OrcaX/img/corn-red.png',
    yellow:'https://byungil-cho.github.io/OrcaX/img/corn-yellow.png'
  }[color]) || 'https://byungil-cho.github.io/OrcaX/img/corn-yellow.png';

  set('v-earned-session', S.earnedSession);
  set('v-wallet', orcx);
  set('v-total', orcx + S.earnedSession);
}

/* ===== 실행 가능(재료 + 서버 + 진행중 아님) ===== */
function checkReady(){
  const salt  = n(S.user?.inventory?.salt);
  const sugar = n(S.user?.inventory?.sugar);
  const corn  = n(S.user?.inventory?.corn);
  const ok = salt>=1 && sugar>=1 && corn>=1 && S.serverOk && !S.popping;
  $('btnRun').disabled = !ok;
  $('resultBox').textContent = ok
    ? '✅ 준비 완료. 뻥튀기를 실행할 수 있습니다.'
    : `❌ 재료/서버 부족 — 소금:${salt} 설탕:${sugar} 옥수수:${corn} / 서버:${S.serverOk?'✅':'❌'}`;
}

/* ===== 풍선말(토큰) ===== */
function balloon(text){
  const card = $('card');
  const b = document.createElement('div');
  b.className = 'balloon';
  b.textContent = `+${n(text).toLocaleString()}`;
  const margin = 24; // 모바일 여백
  const x = margin + Math.random()* (card.clientWidth - margin*2 - 60);
  const y = card.clientHeight - 120;
  b.style.left = x + 'px';
  b.style.top  = y + 'px';
  card.appendChild(b);
  const dy = -60 - Math.random()*40;
  const dur = 900 + Math.random()*300;
  b.animate([{transform:'translateY(0)', opacity:1},{transform:`translateY(${dy}px)`, opacity:0}], {duration:dur, easing:'ease-out'});
  setTimeout(()=> b.remove(), dur);
}

/* ===== 1개씩 순차 뻥튀기 ===== */
async function runPungBatch(){
  if(!S.serverOk) return toast('서버 오프라인입니다.');
  if(!S.kakaoId)  return toast('카카오 로그인 필요');
  if(S.popping)   return;

  try{
    S.popping = true;
    $('btnRun').disabled = true;

    // 가능한 횟수 = min(소금, 설탕, 옥수수)
    let salt  = n(S.user?.inventory?.salt);
    let sugar = n(S.user?.inventory?.sugar);
    let corn  = n(S.user?.inventory?.corn);
    let times = Math.min(salt, sugar, corn);

    if(times <= 0) { checkReady(); return; }

    $('resultBox').textContent = '🍿 뻥튀기 진행 중…';

    for(let i=0; i<times; i++){
      const one = await pungOnce(); // 서버가 랜덤 보상/차감/저장 수행
      if(!one) break;

      const t = n(one.token);
      if(t>0){ S.earnedSession += t; balloon(t); }

      if(one.user){ S.raw = one.user; S.user = normalizeUser(one.user); }
      paint(S.user);

      $('resultBox').innerHTML = `🎉 축하합니다. <b>${t.toLocaleString()}</b> 토큰을 획득했습니다. <span class="muted">${one.message||''}</span>`;

      await sleep(250);
      checkReady();
      if($('btnRun').disabled) break; // 재료 소진 시 중단
    }
  }catch(e){
    toast('뻥튀기 처리 중 오류가 발생했습니다.');
  }finally{
    S.popping = false;
    checkReady();
  }
}

/* ===== 1회 뻥튀기 요청 ===== */
async function pungOnce(){
  const res = await fetch(API_BASE + '/api/corn/pung', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ kakaoId:S.kakaoId, count:1 })
  });
  if(!res.ok){
    const t = await res.text().catch(()=> '');
    toast('실행 실패: ' + (t||res.status));
    return null;
  }
  const data = await res.json();
  // 기대: { ok:true, message:"...", result:{ token, popcorn }, user:{...최신상태...} }
  return { token: n(data?.result?.token), user: data?.user || null, message: data?.message || '' };
}

/* ===== 기타 ===== */
function toast(m){ $('resultBox').textContent = '❌ ' + m; }
const sleep = ms => new Promise(r=>setTimeout(r, ms));

/* ===== 이벤트 ===== */
$('btnRun').addEventListener('click', runPungBatch);
$('btnReload').addEventListener('click', ()=>{ pingServer(); loadUser(); });

/* ===== 시작 ===== */
(async function init(){
  set('kakaoId', S.kakaoId||'-');
  await pingServer();
  await loadUser();
  checkReady();
})();
