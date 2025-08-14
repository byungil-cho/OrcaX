/* ========================================================================
 * OrcaX Corn API (frontend) - js/corn-api.js
 * - 기본 서버 코드는 절대 수정하지 않음
 * - /api 중복(/api/api/...) 자동 보정
 * - GET/POST 모두 kakaoId/nickname 전송 지원
 * - 전역 네임스페이스: window.CornAPI
 * ====================================================================== */

/** 기본 BASE_API
 *  - localStorage['orcax:BASE_API'] 가 있으면 그걸 우선 사용
 *  - 항상 '/api'가 "한 번만" 붙도록 정규화
 */
const __DEFAULT_API = 'https://climbing-wholly-grouper.jp.ngrok.io/api';

function __normalizeBaseApi(raw) {
  try {
    let s = String(raw || __DEFAULT_API);
    s = s.replace(/\/+$/g, '');           // 끝 슬래시 제거
    s = s.replace(/\/api\/?$/i, '');      // 뒤쪽 /api 제거
    s = s + '/api';                       // 딱 한 번만 /api 부착
    return s;
  } catch {
    return __DEFAULT_API;
  }
}

(function __installFetchGuard() {
  // 혹시 다른 코드가 /api/api/ 를 만들어도 자동 보정
  const _fetch = window.fetch;
  window.fetch = function(url, opts) {
    if (typeof url === 'string') {
      url = url.replace(/\/api\/api\//gi, '/api/').replace(/([^:])\/\/+/g, '$1/'); // // -> /
    }
    return _fetch.call(this, url, opts);
  };
})();

/** 현재 BASE_API 획득 & 저장 */
function __getBaseApi() {
  const ls = localStorage.getItem('orcax:BASE_API');
  const base = __normalizeBaseApi(ls || __DEFAULT_API);
  if (base !== ls) localStorage.setItem('orcax:BASE_API', base);
  return base;
}

/** URL 빌더 (상대경로 → 절대경로), /api/api 방지 */
function __buildUrl(path) {
  if (/^https?:\/\//i.test(path)) return path; // 이미 절대경로면 그대로
  const base = __getBaseApi();
  const p = String(path || '').replace(/^\/+/, ''); // 시작 슬래시 제거
  return `${base}/${p}`.replace(/\/api\/api\//gi, '/api/').replace(/([^:])\/\/+/g, '$1/'); // // 축약
}

/** JSON fetch (안전 헤더/메소드/에러 처리 포함) */
async function __jsonFetch(path, { method = 'GET', query, body, headers } = {}) {
  let url = __buildUrl(path);
  if (query && typeof query === 'object') {
    const q = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null) q.set(k, String(v));
    });
    const qs = q.toString();
    if (qs) url += (url.includes('?') ? '&' : '?') + qs;
  }

  const opts = { method, headers: Object.assign({ 'Accept': 'application/json' }, headers || {}) };
  if (body !== undefined && body !== null) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }

  const res = await fetch(url, opts);
  // 204 No Content 같은 경우 빈 객체
  const text = await res.text();
  const isJson = (res.headers.get('content-type') || '').includes('application/json');
  const data = text ? (isJson ? JSON.parse(text) : { raw: text }) : {};

  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} @ ${path}`);
    err.response = res;
    err.data = data;
    throw err;
  }
  return data;
}

/** 로컬에 저장된 식별자 */
function __getIds() {
  return {
    kakaoId: localStorage.getItem('kakaoId') || '',
    nickname: localStorage.getItem('nickname') || ''
  };
}
function __setIds({ kakaoId, nickname }) {
  if (kakaoId) localStorage.setItem('kakaoId', kakaoId);
  if (nickname) localStorage.setItem('nickname', nickname);
}

/** 숫자 변환 (0 안전 보정) */
function __n(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

/* ============================== 공개 API =============================== */
const CornAPI = {
  /** 현재 BASE_API 확인용 */
  get base() { return __getBaseApi(); },

  /** 로그인(또는 재로그) */
  async login({ kakaoId, nickname }) {
    if (!kakaoId || !nickname) throw new Error('kakaoId, nickname 필요');
    const r = await __jsonFetch('login', { method: 'POST', body: { kakaoId, nickname } });
    __setIds({ kakaoId, nickname });
    return r;
  },

  /** 유저 초기화(서버 기본 라우트) */
  async initUser({ kakaoId, nickname }) {
    const r = await __jsonFetch('init-user', { method: 'POST', body: { kakaoId, nickname } });
    return r;
  },

  /** 유저 데이터(서버: POST /api/userdata, 추가: GET /api/userdata 둘 다 대응) */
  async getUserdata({ kakaoId, nickname } = {}) {
    const ids = __getIds();
    const k = kakaoId || ids.kakaoId;
    const n = nickname || ids.nickname;
    if (!k && !n) throw new Error('kakaoId 또는 nickname 필요');

    // 먼저 GET 시도(추가된 호환 라우트). 실패하면 POST로 폴백.
    try {
      return await __jsonFetch('userdata', { method: 'GET', query: { kakaoId: k, nickname: n } });
    } catch {
      return await __jsonFetch('userdata', { method: 'POST', body: { kakaoId: k, nickname: n } });
    }
  },

  /** 옥수수 요약(추가 라우트) */
  async getCornSummary({ kakaoId } = {}) {
    const k = kakaoId || __getIds().kakaoId;
    if (!k) throw new Error('kakaoId 필요');
    return await __jsonFetch('corn/summary', { method: 'GET', query: { kakaoId: k } });
  },

  /** 첨가물/씨앗 구매 */
  async buyAdditive({ kakaoId, item, qty = 1 }) {
    const k = kakaoId || __getIds().kakaoId;
    if (!k) throw new Error('kakaoId 필요');
    // seeds로 와도 서버에서 seed로 정규화되지만, 클라에서도 한번 보정
    const itm = (item === 'seeds') ? 'seed' : item;
    return await __jsonFetch('corn/buy-additive', {
      method: 'POST',
      body: { kakaoId: k, item: itm, qty: __n(qty) }
    });
  },

  /** 씨앗 심기 */
  async plant({ kakaoId } = {}) {
    const k = kakaoId || __getIds().kakaoId;
    return await __jsonFetch('corn/plant', { method: 'POST', body: { kakaoId: k } });
  },

  /** 수확 */
  async harvest({ kakaoId } = {}) {
    const k = kakaoId || __getIds().kakaoId;
    return await __jsonFetch('corn/harvest', { method: 'POST', body: { kakaoId: k } });
  },

  /** 뻥튀기 (use: 'salt' | 'sugar') */
  async pop({ kakaoId, use = 'salt' } = {}) {
    const k = kakaoId || __getIds().kakaoId;
    return await __jsonFetch('corn/pop', { method: 'POST', body: { kakaoId: k, use } });
  },

  /** 팝콘 ↔ 비료 교환 (dir: 'popcorn->fertilizer' | 'fertilizer->popcorn') */
  async exchange({ kakaoId, dir = 'popcorn->fertilizer', qty = 1 } = {}) {
    const k = kakaoId || __getIds().kakaoId;
    return await __jsonFetch('corn/exchange', { method: 'POST', body: { kakaoId: k, dir, qty: __n(qty) } });
  },

  /** 물/거름 사용 (server: POST /api/user/inventory/use) */
  async useInventory({ kakaoId, type, amount = 1 } = {}) {
    const k = kakaoId || __getIds().kakaoId;
    return await __jsonFetch('user/inventory/use', {
      method: 'POST',
      body: { kakaoId: k, type, amount: __n(amount) }
    });
  }
};

window.CornAPI = CornAPI;

/* ============================== 부트스트랩(옵션) ===============================
 * 페이지에서 즉시 쓰고 싶으면 아래 예시처럼 사용:
 *   await CornAPI.login({ kakaoId:'K123', nickname:'닉' });
 *   const ud = await CornAPI.getUserdata();
 *   const cs = await CornAPI.getCornSummary();
 * ============================================================================ */











