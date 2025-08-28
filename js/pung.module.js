/* js/pung.module.js
 * OrcaX Corn Popping Engine (for popup.html)
 * - 불러오기: 카카오ID/닉네임 기반 users, corn_data 조회 (서버 GET 우선, 실패 시 localStorage)
 * - 실행조건: 소금1 + 설탕1 + 옥수수1 + ORCX 30 (매 회차)
 * - 뻥튀기: 수확 수량만큼 1개씩 연속 실행. 결과는 등급 테이블 내 랜덤.
 *   · A급: 5/7/9개 시 고정 조합을 무작위 순서로 배치(3700/5200/6200 총합 예시 보장)
 *   · B~F급: 등급 테이블 값(3종) + 팝콘(0)에서 확률 추출 (필요 시 고정 조합 규칙 추가 가능)
 * - 대출 공제: 씨앗색이 red/black이면 획득 토큰의 30% 공제 적용
 * - UI는 popup.html이 담당 (풍선말, 누적표시 등)
 */
(function (global) {
  // ========================= 설정 =========================
  const CONFIG = {
    // 서버 베이스(없으면 ''로 두면 자동 오프라인 모드)
    serverBase: 'https://climbing-wholly-grouper.jp.ngrok.io',

    // 서버에 존재할 법한 GET 엔드포인트 후보(프리플라이트 회피)
    endpoints: {
      ping: ['/api/ping'],
      getUsers: [
        '/api/users/by-kakao', '/api/users/find',
        '/users/by-kakao', '/users/find'
      ],
      getCorn: [
        '/api/corn/by-kakao', '/api/corn_data/find',
        '/corn/by-kakao', '/corn_data/by-kakao'
      ],
      // (선택) 서버에도 기록 남기고 싶으면 활성화 가능
      // pungOnce: ['/api/corn/pung'],
    },

    // 등급별 1회 결과 후보 (팝콘은 0)
    gradeTable: {
      A: [1000, 900, 800, 0],
      B: [800, 700, 600, 0],
      C: [600, 500, 400, 0],
      D: [400, 300, 200, 0],
      E: [200, 100, 50,  0],
      F: [100, 50,  10,  0],
    },

    // A급 고정 조합 (수확 5/7/9일 때)
    // 총합은 예시와 맞도록 구성. 순서는 매 실행마다 랜덤 셔플.
    aFixedCombo: {
      5:  { 1000:2, 900:1, 800:1, 0:1 },           // 합계 3700
      7:  { 1000:1, 900:2, 800:3, 0:1 },           // 합계 5200
      9:  { 1000:1, 900:3, 800:3, 0:2 },           // 합계 6200
    },

    // 로컬 스토리지 키
    lskPrefix: 'orca:pung:',
  };

  // ========================= 내부 상태 =========================
  const S = {
    kakaoId: '',
    user: null,     // 정규화된 뷰모델
    raw:  null,     // { user: usersDoc, corn: cornDoc }
    serverOk: false,
    earnedSession: 0,
  };

  // ========================= 유틸 =========================
  const num = v => Number.isFinite(Number(v)) ? Number(v) : 0;
  const get = (o,p)=> p.split('.').reduce((a,k)=> a && a[k]!==undefined ? a[k] : undefined, o);
  const sleep = ms => new Promise(r=>setTimeout(r,ms));
  const lsk  = id => CONFIG.lskPrefix + id;

  function randInt(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }
  function shuffle(arr){
    for(let i=arr.length-1;i>0;i--){ const j= Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; }
    return arr;
  }

  async function tryGetJson(url){
    try { const r = await fetch(url, { method:'GET', cache:'no-store' }); if(r.ok) return await r.json(); } catch {}
    return null;
  }
  async function tryPing(){
    if(!CONFIG.serverBase) return false;
    for(const ep of CONFIG.endpoints.ping){
      const data = await tryGetJson(CONFIG.serverBase + ep);
      if(data) return true;
    }
    return false;
  }
  async function findFirst(endpointList, params){
    if(!CONFIG.serverBase) return { json:null, hit:null };
    const qp = Object.entries(params).map(([k,v])=> `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
    for(const ep of endpointList){
      const url = CONFIG.serverBase + ep + (ep.includes('?')?'&':'?') + qp;
      const json = await tryGetJson(url);
      if(json && Object.keys(json).length) return { json, hit:ep };
    }
    return { json:null, hit:null };
  }

  // ========================= 정규화 =========================
  function normalize(userDoc, cornDoc){
    const nickname =
      userDoc?.nickname ?? userDoc?.name ?? userDoc?.profile?.nickname ?? localStorage.getItem('nickname') ?? '-';

    // wallet orcx
    const orcx = num(
      userDoc?.token ?? userDoc?.tokens ?? userDoc?.orcx ?? userDoc?.wallet?.orcx ?? userDoc?.wallet?.balance ?? 0
    );

    // 자원
    const salt   = num(cornDoc?.salt  ?? cornDoc?.salts ?? cornDoc?.inventory?.salt  ?? 0);
    const sugar  = num(cornDoc?.sugar ?? cornDoc?.sugars?? cornDoc?.inventory?.sugar ?? 0);
    const corn   = num(cornDoc?.corn  ?? cornDoc?.cornCount ?? cornDoc?.inventory?.corn ?? cornDoc?.data?.count ?? 0);
    const popcorn= num(cornDoc?.popcorn ?? cornDoc?.products?.popcorn ?? 0);

    // 씨앗 색(대출/미상환 상태 시 red/black로 들어온다고 가정)
    const cornColor = (cornDoc?.cornColor ?? cornDoc?.color ?? cornDoc?.corn_color ?? 'yellow').toLowerCase();

    // 등급(없으면 A로 가정; 서버가 주면 우선)
    const grade = (cornDoc?.grade ?? cornDoc?.harvestGrade ?? 'A').toUpperCase();

    return {
      nickname,
      cornColor,
      grade,
      wallet:   { orcx },
      inventory:{ salt, sugar, corn },
      products: { popcorn }
    };
  }

  // ========================= 로컬 스토리지 =========================
  function readLocal(kakaoId){
    try {
      const raw = JSON.parse(localStorage.getItem(lsk(kakaoId))||'{}');
      if(!raw.user || !raw.corn) return null;
      return { user:raw.user, corn:raw.corn };
    } catch { return null; }
  }
  function writeLocal(kakaoId, bundle){
    localStorage.setItem(lsk(kakaoId), JSON.stringify(bundle));
  }

  // ========================= 실행 조건/차감 =========================
  function canRunTimes(){
    const inv = S.user.inventory;
    const wallet = S.user.wallet;
    const limitByOrcx = Math.floor(num(wallet.orcx) / 30); // ORCX 30 per pop
    return Math.max(0, Math.min(
      num(inv.salt), num(inv.sugar), num(inv.corn), limitByOrcx
    ));
  }

  function consumeOnce(){
    // 소금/설탕/옥수수/ORCX 30 차감
    S.user.inventory.salt  -= 1;
    S.user.inventory.sugar -= 1;
    S.user.inventory.corn  -= 1;
    S.user.wallet.orcx     -= 30;

    // 원본에도 반영
    S.raw.corn.salt   = num(S.raw.corn.salt)   - 1;
    S.raw.corn.sugar  = num(S.raw.corn.sugar)  - 1;
    // corn 필드명 다양성 고려
    if(S.raw.corn.corn !== undefined) S.raw.corn.corn = num(S.raw.corn.corn) - 1;
    else if(S.raw.corn.cornCount !== undefined) S.raw.corn.cornCount = num(S.raw.corn.cornCount) - 1;
    S.raw.user = S.raw.user || {};
    if(get(S.raw.user,'wallet.orcx') !== undefined)      S.raw.user.wallet.orcx = num(S.raw.user.wallet.orcx) - 30;
    else if(S.raw.user.orcx !== undefined)               S.raw.user.orcx = num(S.raw.user.orcx) - 30;
    else if(S.raw.user.tokens !== undefined)             S.raw.user.tokens = num(S.raw.user.tokens) - 30;
    else                                                 S.raw.user.token = num(S.raw.user.token || 0) - 30;
  }

  function rewardOnce(token){
    // 팝콘은 token=0 의미. 토큰이면 지갑+, 팝콘이면 제품+
    if(token > 0){
      // 대출/미상환: 씨앗 색 red/black → 30% 공제
      const loaned = (S.user.cornColor === 'red' || S.user.cornColor === 'black');
      const after = loaned ? Math.floor(token * 0.7) : token;

      S.user.wallet.orcx += after;
      // 원본 갱신
      if(get(S.raw.user,'wallet.orcx') !== undefined)      S.raw.user.wallet.orcx = num(S.raw.user.wallet.orcx) + after;
      else if(S.raw.user.orcx !== undefined)               S.raw.user.orcx = num(S.raw.user.orcx) + after;
      else if(S.raw.user.tokens !== undefined)             S.raw.user.tokens = num(S.raw.user.tokens) + after;
      else                                                 S.raw.user.token = num(S.raw.user.token || 0) + after;

      S.earnedSession += after;
      return after;
    }else{
      // 팝콘 +1
      S.user.products.popcorn += 1;
      S.raw.corn.popcorn = num(S.raw.corn.popcorn) + 1;
      return 0;
    }
  }

  // ========================= 결과 생성 =========================
  function aFixedOutcomes(n){
    const def = CONFIG.aFixedCombo[n];
    if(!def) return null;
    const arr = [];
    for(const k of Object.keys(def)){
      for(let i=0;i<def[k];i++) arr.push(Number(k));
    }
    return shuffle(arr);
  }

  function randomOutcomeFromGrade(grade){
    const table = CONFIG.gradeTable[grade] || CONFIG.gradeTable.A;
    // 간단한 가중치: 높은 값이 약간 더 희귀하도록 비율 조정(원하면 조정)
    // A 기준 예: [1000,900,800,0] → weights [1,2,3,1] 등
    const weights = {
      A:[1,2,3,1], B:[1,2,3,1], C:[1,2,3,1],
      D:[1,2,3,1], E:[1,2,3,1], F:[1,2,3,1],
    }[grade] || [1,2,3,1];

    const total = weights.reduce((a,b)=>a+b,0);
    let r = Math.random()*total;
    for(let i=0;i<table.length;i++){
      if((r -= weights[i]) < 0) return table[i];
    }
    return table[table.length-1];
  }

  // ========================= 공개 API =========================
  const Pung = {
    async init({ kakaoId }){
      S.kakaoId = kakaoId || localStorage.getItem('kakaoId') || '';
      if(!S.kakaoId) throw new Error('NO_KAKAO_ID');

      // 서버 체크
      S.serverOk = await tryPing();

      // 불러오기 (서버 → 로컬)
      let usersJson=null, cornJson=null;
      if(S.serverOk){
        const [u, c] = await Promise.all([
          findFirst(CONFIG.endpoints.getUsers, { kakaoId:S.kakaoId }),
          findFirst(CONFIG.endpoints.getCorn,  { kakaoId:S.kakaoId })
        ]);
        usersJson = u.json;
        cornJson  = c.json;
      }
      if(!usersJson || !cornJson){
        const loc = readLocal(S.kakaoId);
        if(loc){ usersJson = usersJson || loc.user; cornJson = cornJson || loc.corn; }
      }

      // 뼈대 보정
      if(!usersJson) usersJson = { nickname:'-', token:0 };
      if(!cornJson)  cornJson  = { salt:0, sugar:0, corn:0, popcorn:0, cornColor:'yellow', grade:'A' };

      S.raw  = { user: usersJson, corn: cornJson };
      S.user = normalize(usersJson, cornJson);

      // 캐시 저장
      writeLocal(S.kakaoId, S.raw);

      return { serverOk:S.serverOk, user:S.user };
    },

    state(){ return { ...S }; },

    // 실행 가능 회수(소금, 설탕, 옥수수, ORCX/30 중 최솟값)
    canTimes(){ return canRunTimes(); },

    // 단일 회차(임의 사용; popup.html은 popAll 사용)
    async popOne({ onUpdate } = {}){
      if(this.canTimes() <= 0) return { ok:false, reason:'자원 부족' };

      // 차감 먼저
      consumeOnce();

      // 결과 산출
      const grade = (S.user.grade || 'A').toUpperCase();
      const token = randomOutcomeFromGrade(grade); // 단일회차는 확률 추출

      // 보상 반영
      const gained = rewardOnce(token);

      // 저장
      writeLocal(S.kakaoId, S.raw);

      onUpdate && onUpdate({ token: gained, state: this.state() });
      return { ok:true, token: gained };
    },

    // 가능한 만큼 1개씩 연속
    async popAll({ onEach, onDone, delayMs=250 } = {}){
      let times = this.canTimes();
      if(times <= 0) { onDone && onDone({ total:0, state:this.state() }); return { total:0 }; }

      const grade = (S.user.grade || 'A').toUpperCase();

      // A급 & 수확수량이 5/7/9면 고정 조합 적용(순서 랜덤)
      let plan = (grade==='A' && CONFIG.aFixedCombo[times]) ? aFixedOutcomes(times) : null;

      let total = 0;
      for(let i=0;i<times;i++){
        // 실행 차감
        consumeOnce();

        // 결과 토큰
        const token = plan ? plan[i] : randomOutcomeFromGrade(grade);

        const gained = rewardOnce(token);
        total += gained;

        writeLocal(S.kakaoId, S.raw);

        onEach && onEach({ token: gained, state: this.state() });
        if(delayMs) await sleep(delayMs);
      }
      onDone && onDone({ total, state:this.state() });
      return { total };
    },
  };

  global.Pung = Pung;
})(window);
