// 1) 여러 후보 엔드포인트 자동 시도
const USERDATA_ENDPOINTS = [
  '/api/corn/userdata',   // 권장 집계 API (없으면 404)
  '/api/user/info',
  '/api/userdata',
  '/api/users/find',
  '/api/corn_data/find',
  '/api/user/by-kakao',
  '/api/corn/by-kakao',
  '/users/by-kakao',
  '/corn/by-kakao'
];

// POST(JSON) → POST(text/plain) → GET 쿼리 순서로 시도
async function fetchJsonAny(endpoint, payload){
  try {
    let r = await fetch(API_BASE + endpoint, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
    if (r.ok) return await r.json();
  } catch {}
  try {
    let r = await fetch(API_BASE + endpoint, {method:'POST', headers:{'Content-Type':'text/plain'}, body:JSON.stringify(payload)});
    if (r.ok) return await r.json();
  } catch {}
  try {
    let r = await fetch(API_BASE + endpoint + '?kakaoId=' + encodeURIComponent(payload.kakaoId), {method:'GET'});
    if (r.ok) return await r.json();
  } catch {}
  return null;
}

// ✅ users + corn_data 어떤 형식이 와도 하나의 뷰모델로 정규화
function normalizeUser(raw){
  const userPart = raw?.user || raw?.users || raw;       // users 컬렉션 근원
  const cornPart = raw?.corn || raw?.corn_data || raw;   // corn_data 근원

  const num = v => Number.isFinite(Number(v)) ? Number(v) : 0;

  const out = {
    nickname: (userPart?.nickname || userPart?.name || userPart?.profile?.nickname || localStorage.getItem('nickname') || '-'),
    cornColor: (cornPart?.cornColor || cornPart?.color || cornPart?.corn_color || 'yellow').toLowerCase(),
    wallet:   { orcx: num(userPart?.token ?? userPart?.tokens ?? userPart?.orcx ?? userPart?.wallet?.orcx ?? userPart?.wallet?.balance ?? 0) },
    inventory:{ 
      salt:  num(cornPart?.salt ?? cornPart?.salts ?? cornPart?.inventory?.salt ?? 0),
      sugar: num(cornPart?.sugar ?? cornPart?.sugars ?? cornPart?.inventory?.sugar ?? 0),
      corn:  num(cornPart?.corn ?? cornPart?.cornCount ?? cornPart?.inventory?.corn ?? cornPart?.data?.count ?? 0)
    },
    products:{ popcorn: num(cornPart?.popcorn ?? cornPart?.products?.popcorn ?? 0) }
  };
  return out;
}

// 🔄 유저 불러오기: 후보 엔드포인트를 순차 시도해서 성공하는 것 채택
async function loadUser(){
  const box = document.getElementById('resultBox');
  if(!S.kakaoId){ paint(null); box.textContent='카카오 로그인 정보가 없습니다.'; return; }

  let data = null, used = null;
  for (const ep of USERDATA_ENDPOINTS) {
    data = await fetchJsonAny(ep, { kakaoId:S.kakaoId });
    if (data) { used = ep; break; }
  }
  if (!data) { paint(null); box.textContent = '❌ 유저 정보를 불러오지 못했습니다. (모든 엔드포인트 실패)'; return; }

  // 통합객체이든 {user,corn}이든 OK
  S.raw  = data;
  S.user = normalizeUser(data);
  paint(S.user);
  checkReady();

  // 디버깅 보기 좋게
  console.log('[userdata ok]', used, data);
}
// CORS (gh-pages 출처 허용)
app.use((req,res,next)=>{
  res.header('Access-Control-Allow-Origin','https://byungil-cho.github.io');
  res.header('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS') return res.sendStatus(200);
  next();
});

// users × corn_data 집계
app.post('/api/corn/userdata', async (req,res)=>{
  const body = typeof req.body==='string' ? JSON.parse(req.body) : req.body;
  const { kakaoId } = body;
  const user = await db.collection('users').findOne({ kakaoId });
  const corn = await db.collection('corn_data').findOne({ kakaoId });
  res.json({ user, corn });
});



