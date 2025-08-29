/* ===== 유틸: 안전한 JSON 요청 (POST/GET 자동 시도 + text/plain로 프리플라이트 회피) ===== */
async function fetchJson(url, payload){
  // 1) POST application/json
  try{
    const r = await fetch(API_BASE + url, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    if(r.ok) return await r.json();
  }catch(e){ /* ignore */ }

  // 2) POST text/plain (프리플라이트 회피용, 서버가 body만 읽으면 됨)
  try{
    const r = await fetch(API_BASE + url, {
      method:'POST',
      headers:{'Content-Type':'text/plain'},
      body: JSON.stringify(payload)
    });
    if(r.ok) return await r.json();
  }catch(e){ /* ignore */ }

  // 3) GET ?kakaoId=...
  try{
    const qp = '?kakaoId=' + encodeURIComponent(payload.kakaoId);
    const r = await fetch(API_BASE + url + qp, { method:'GET' });
    if(r.ok) return await r.json();
  }catch(e){ /* ignore */ }

  return null;
}

/* ===== 유저 불러오기: 집계 API 우선 → 없으면 users / corn_data 개별 조회 후 병합 ===== */
async function loadUser(){
  const box = $('resultBox');
  if(!S.kakaoId){ paint(null); box.textContent='카카오 로그인 정보가 없습니다.'; return; }

  try{
    // 1) 권장: 서버에서 두 컬렉션을 합쳐주는 API
    //    /api/corn/userdata  (응답 예: { user:{...users}, corn:{...corn_data} } 또는 통합된 1객체)
    let data = await fetchJson('/api/corn/userdata', { kakaoId:S.kakaoId });

    // 2) 대안: users / corn_data 개별 엔드포인트가 있는 경우 자동 시도
    if(!data){
      const [u, c] = await Promise.all([
        fetchJson('/api/user/by-kakao', { kakaoId:S.kakaoId }),
        fetchJson('/api/corn/by-kakao', { kakaoId:S.kakaoId })
      ]);
      if(u || c) data = { user: u, corn: c };
    }

    // 3) 그래도 없으면 다른 관용 경로 한 번 더 시도
    if(!data){
      const [u2, c2] = await Promise.all([
        fetchJson('/api/users/find', { kakaoId:S.kakaoId }),      // users 컬렉션
        fetchJson('/api/corn_data/find', { kakaoId:S.kakaoId })   // corn_data 컬렉션
      ]);
      if(u2 || c2) data = { user: u2, corn: c2 };
    }

    if(!data) throw new Error('NO_DATA');

    // 정규화 → S.user
    S.raw  = data;
    S.user = normalizeUser(data);
    paint(S.user);
    checkReady();
  }catch(e){
    paint(null);
    $('resultBox').textContent = '❌ 유저 정보를 불러오지 못했습니다.';
    console.warn('[userdata fetch error]', e);
  }
}

/* ===== 정규화: users / corn_data 어떤 형태든 하나의 뷰 모델로 맞춤 =====
   - users: 토큰/닉네임
   - corn_data: 소금/설탕/옥수수/팝콘/색상
*/
function normalizeUser(raw){
  // raw가 통합객체일 수도, {user:{}, corn:{}}처럼 분리일 수도 있음
  const userPart = raw?.user || raw?.users || raw;       // users 컬렉션 근원
  const cornPart = raw?.corn || raw?.corn_data || raw;   // corn_data 근원

  const out = {
    nickname: (
      userPart?.nickname ||
      userPart?.name ||
      userPart?.profile?.nickname ||
      localStorage.getItem('nickname') || '-'
    ),
    cornColor: (
      cornPart?.cornColor ||
      cornPart?.color ||
      cornPart?.corn_color ||
      'yellow'
    ).toLowerCase(),
    wallet: { orcx: 0 },
    inventory: { salt:0, sugar:0, corn:0 },
    products: { popcorn:0 }
  };

  // users 컬렉션: 토큰 필드 변종 흡수
  out.wallet.orcx = Number(
    userPart?.token ??
    userPart?.tokens ??
    userPart?.orcx ??
    userPart?.wallet?.orcx ??
    userPart?.wallet?.balance ??
    0
  ) || 0;

  // corn_data 컬렉션: 수량 필드 변종 흡수
  out.inventory.salt   = Number(
    cornPart?.salt ?? cornPart?.salts ?? cornPart?.inventory?.salt ?? 0
  ) || 0;
  out.inventory.sugar  = Number(
    cornPart?.sugar ?? cornPart?.sugars ?? cornPart?.inventory?.sugar ?? 0
  ) || 0;
  out.inventory.corn   = Number(
    cornPart?.corn ??
    cornPart?.cornCount ??
    cornPart?.inventory?.corn ??
    cornPart?.data?.count ??
    0
  ) || 0;
  out.products.popcorn = Number(
    cornPart?.popcorn ?? cornPart?.products?.popcorn ?? 0
  ) || 0;

  return out;
}
