/* js/pung.module.js
 * OrcaX Corn Popping Engine — MongoDB API only / KakaoID auto-detect
 * --------------------------------------------
 * - 서버: Ngrok 등으로 노출된 Mongo API만 사용
 * - 카카오ID: 하드코딩 금지. URL → localStorage → cookie 순으로 자동 인식
 * - 읽기:  GET /api/ping, /api/users/by-kakao, /api/corn/by-kakao
 * - 쓰기:  POST/PUT 다형 시도(/api/corn/update | /api/corn/userdata | /api/corn/by-kakao)
 * - 실행조건(매 회차): 소금1 + 설탕1 + 옥수수1 + ORCX 30
 * - 뻥튀기: 수확수만큼 1개씩 연속. A급 5/7/9개는 고정 조합(순서만 랜덤),
 *           B~F급은 상위3값+팝콘에서 확률로 추출(필요 시 고정조합도 쉽게 확장 가능)
 */

(function (global) {
  // ------------------------- Config -------------------------
  const CFG = {
    // API 베이스 자동 결정 규칙:
    // 1) URL ?api=... 또는 ?apiBase=...
    // 2) window.PUNG_API_BASE
    // 3) <meta name="pung-api" content="...">
    // 4) 현재 origin (ngrok 도메인에서 직접 띄우는 경우)
    resolveApiBase() {
      const u = new URL(location.href);
      const q = u.searchParams.get("api") || u.searchParams.get("apiBase");
      if (q) return q.replace(/\/+$/,'');
      if (typeof window.PUNG_API_BASE === "string" && window.PUNG_API_BASE) {
        return window.PUNG_API_BASE.replace(/\/+$/,'');
      }
      const meta = document.querySelector('meta[name="pung-api"]');
      if (meta && meta.content) return meta.content.replace(/\/+$/,'');
      return location.origin.replace(/\/+$/,'');
    },
    endpoints: {
      ping:        '/api/ping',
      userByKakao: '/api/users/by-kakao',
      cornByKakao: '/api/corn/by-kakao',

      // 저장(아무거나 하나라도 있으면 성공으로 간주)
      saveTry: [
        ['/api/corn/update',    'POST'],
        ['/api/corn/userdata',  'POST'],
        ['/api/corn/by-kakao',  'PUT'],
      ],
    },

    // 등급별 1회 결과 후보(팝콘=0)
    gradeTable: {
      A: [1000, 900, 800, 0],
      B: [800,  700, 600, 0],
      C: [600,  500, 400, 0],
      D: [400,  300, 200, 0],
      E: [200,  100, 50,  0],
      F: [100,  50,  10,  0],
    },

    // A급 수확수별 고정 조합 (순서만 랜덤)
    aCombo: {
      5: {1000:2, 900:1, 800:1, 0:1},   // 총합 3700
      7: {1000:1, 900:2, 800:3, 0:1},   // 총합 5200
      9: {1000:1, 900:3, 800:3, 0:2},   // 총합 6200
    },
  };

  // ------------------------- State -------------------------
  const S = {
    apiBase: '',
    kakaoId: '',
    serverOk: false,
    userRaw: null,   // users doc
    cornRaw: null,   // corn_data doc
    view:   null,    // 정규화된 뷰모델
    earnedSession: 0,
  };

  // ------------------------- Utils -------------------------
  const num = v => (Number.isFinite(+v) ? +v : 0);
  const pick = (o, p) => p.split('.').reduce((a,k)=>a && a[k]!==undefined ? a[k] : undefined, o);
  const sleep = ms => new Promise(r=>setTimeout(r,ms));
  function rnd(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }
  function shuffle(arr){ for(let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]] } return arr; }

  function getCookie(name){
    const m = document.cookie.match(new RegExp('(?:^|; )'+name+'=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : '';
  }
  function autoKakaoId(){
    const u = new URL(location.href);
    return (
      u.searchParams.get('kakaoId') ||
      localStorage.getItem('kakaoId') ||
      getCookie('kakaoId') ||
      ''
    );
  }

  async function jget(url){
    const r = await fetch(url, { method:'GET', credentials:'include', cache:'no-store' });
    if(!r.ok) throw new Error(r.status+' '+r.statusText);
    return r.json();
  }
  async function jwrite(url, method, body){
    const r = await fetch(url, {
      method, credentials:'include',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify(body||{})
    });
    return r.ok;
  }

  // ------------------------- Normalize -------------------------
  function normalize(user, corn){
    const nickname =
      user?.nickname ?? user?.name ?? user?.profile?.nickname ?? '-';

    const orcx = num(
      pick(user,'wallet.orcx') ?? user?.orcx ?? user?.tokens ?? user?.token ?? 0
    );

    const salt   = num(corn?.salt   ?? corn?.inventory?.salt   ?? 0);
    const sugar  = num(corn?.sugar  ?? corn?.inventory?.sugar  ?? 0);
    const cornN  = num(corn?.corn   ?? corn?.cornCount ?? corn?.inventory?.corn ?? 0);
    const popcorn= num(corn?.popcorn?? corn?.products?.popcorn ?? 0);
    const grade  = String(corn?.grade ?? 'A').toUpperCase();
    const color  = String(corn?.cornColor ?? corn?.color ?? 'yellow').toLowerCase();

    return {
      nickname,
      grade,
      cornColor: color,
      wallet:   { orcx },
      inventory:{ salt, sugar, corn: cornN },
      products: { popcorn },
    };
  }

  // ------------------------- Core helpers -------------------------
  function canTimes(){
    const inv = S.view.inventory;
    const w   = S.view.wallet;
    const byOrcx = Math.floor(num(w.orcx) / 30);
    return Math.max(0, Math.min(inv.salt, inv.sugar, inv.corn, byOrcx));
  }

  function consumeOnce(){
    S.view.inventory.salt  -= 1;
    S.view.inventory.sugar -= 1;
    S.view.inventory.corn  -= 1;
    S.view.wallet.orcx     -= 30;

    // raw에도 반영
    if (S.cornRaw) {
      if ('salt'  in S.cornRaw) S.cornRaw.salt  = num(S.cornRaw.salt)  - 1;
      if ('sugar' in S.cornRaw) S.cornRaw.sugar = num(S.cornRaw.sugar) - 1;
      if ('corn'  in S.cornRaw) S.cornRaw.corn  = num(S.cornRaw.corn)  - 1;
      else if ('cornCount' in S.cornRaw) S.cornRaw.cornCount = num(S.cornRaw.cornCount) - 1;
    }
    if (S.userRaw) {
      if (pick(S.userRaw,'wallet.orcx')!==undefined) S.userRaw.wallet.orcx = num(S.userRaw.wallet.orcx) - 30;
      else if ('orcx' in S.userRaw)                   S.userRaw.orcx       = num(S.userRaw.orcx) - 30;
      else if ('tokens' in S.userRaw)                 S.userRaw.tokens     = num(S.userRaw.tokens) - 30;
      else                                            S.userRaw.token      = num(S.userRaw.token || 0) - 30;
    }
  }

  function rewardOnce(token){
    // 대출/미상환: 씨앗색 red/black → 30% 공제
    if (token > 0){
      const loaned = (S.view.cornColor==='red' || S.view.cornColor==='black');
      const after  = loaned ? Math.floor(token * 0.7) : token;

      S.view.wallet.orcx += after;
      if (S.userRaw){
        if (pick(S.userRaw,'wallet.orcx')!==undefined) S.userRaw.wallet.orcx = num(S.userRaw.wallet.orcx) + after;
        else if ('orcx' in S.userRaw)                   S.userRaw.orcx       = num(S.userRaw.orcx) + after;
        else if ('tokens' in S.userRaw)                 S.userRaw.tokens     = num(S.userRaw.tokens) + after;
        else                                            S.userRaw.token      = num(S.userRaw.token || 0) + after;
      }
      S.earnedSession += after;
      return after;
    } else {
      S.view.products.popcorn += 1;
      if (S.cornRaw) S.cornRaw.popcorn = num(S.cornRaw.popcorn) + 1;
      return 0;
    }
  }

  // A급 수확수 고정 조합 → 배열로 전개(순서 랜덤)
  function aOutcomes(n){
    const plan = CFG.aCombo[n]; if(!plan) return null;
    const arr = [];
    for (const k of Object.keys(plan)){
      for (let i=0;i<plan[k];i++) arr.push(+k);
    }
    return shuffle(arr);
  }

  // B~F : 상/중/하/팝콘 가중치 추출(필요 시 조합표 추가 가능)
  function randomFromGrade(grade){
    const t = CFG.gradeTable[grade] || CFG.gradeTable.A;
    const w = [1,2,3,1]; // 높은 값이 조금 더 희귀
    const total = w.reduce((a,b)=>a+b,0);
    let r = Math.random()*total;
    for(let i=0;i<t.length;i++){ r-=w[i]; if(r<0) return t[i]; }
    return t[t.length-1];
  }

  // ------------------------- Public API -------------------------
  const Pung = {

    // 초기화: KakaoID 자동 인식 + 서버 fetch
    async init(opts={}){
      S.apiBase = CFG.resolveApiBase();
      S.kakaoId = (opts.kakaoId || autoKakaoId()).trim();

      if (!S.kakaoId) throw new Error('NO_KAKAO_ID');

      // ping
      try {
        await jget(S.apiBase + CFG.endpoints.ping);
        S.serverOk = true;
      } catch {
        S.serverOk = false;
        throw new Error('SERVER_OFFLINE');
      }

      // read
      const q = 'kakaoId=' + encodeURIComponent(S.kakaoId);
      S.userRaw = await jget(`${S.apiBase}${CFG.endpoints.userByKakao}?${q}`);
      S.cornRaw = await jget(`${S.apiBase}${CFG.endpoints.cornByKakao}?${q}`);
      S.view    = normalize(S.userRaw, S.cornRaw);
      S.earnedSession = 0;

      return { serverOk: S.serverOk, user: S.view };
    },

    state(){ return {
      apiBase:S.apiBase, kakaoId:S.kakaoId, serverOk:S.serverOk,
      view: JSON.parse(JSON.stringify(S.view||{})),
      raw:  { user:S.userRaw, corn:S.cornRaw },
      earnedSession:S.earnedSession,
    };},

    // 가능한 회수(소금,설탕,옥수수,ORCX/30 기준 최솟값)
    canTimes(){ return S.view ? canTimes() : 0; },

    // 한 번(테스트용)
    async popOne({ onUpdate } = {}){
      if (!S.view) throw new Error('NOT_INIT');
      if (this.canTimes() <= 0) return { ok:false, reason:'자원 부족' };

      consumeOnce();
      const token = randomFromGrade(String(S.view.grade).toUpperCase());
      const gained = rewardOnce(token);
      onUpdate && onUpdate({ token:gained, state:this.state() });
      return { ok:true, token:gained };
    },

    // 가능한 만큼 모두(연속)
    async popAll({ onEach, onDone, delayMs=250 } = {}){
      if (!S.view) throw new Error('NOT_INIT');
      let times = this.canTimes();
      if (times <= 0){ onDone && onDone({ total:0, state:this.state() }); return { total:0 }; }

      const grade = String(S.view.grade).toUpperCase();
      let plan = (grade==='A' ? aOutcomes(times) : null);

      let total = 0;
      for (let i=0;i<times;i++){
        consumeOnce();
        const token = plan ? plan[i] : randomFromGrade(grade);
        const gained = rewardOnce(token);
        total += gained;
        onEach && onEach({ token:gained, state:this.state() });
        if (delayMs) await sleep(delayMs);
      }
      onDone && onDone({ total, state:this.state() });
      return { total };
    },

    // 서버 저장(가능한 엔드포인트 중 첫 성공시 OK)
    async sync(){
      if (!S.view) throw new Error('NOT_INIT');
      const body = {
        kakaoId: S.kakaoId,
        nickname: S.view.nickname,
        wallet: { orcx: S.view.wallet.orcx },
        corn_data: {
          salt: S.view.inventory.salt,
          sugar:S.view.inventory.sugar,
          corn: S.view.inventory.corn,
          popcorn:S.view.products.popcorn,
          cornColor:S.view.cornColor,
          grade:S.view.grade,
        }
      };
      for (const [path, method] of CFG.endpoints.saveTry){
        try {
          const ok = await jwrite(S.apiBase + path, method, body);
          if (ok) return true;
        } catch {}
      }
      return false;
    },
  };

  global.Pung = Pung;
})(window);
