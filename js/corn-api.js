/* ========================================================================
 * OrcaX Corn API (frontend) - js/corn-api.js
 * - 서버/기존 코드 수정 없음
 * - /api 중복(/api/api/...) 자동 보정 (전역 fetch 가드)
 * - GET/POST 모두 kakaoId/nickname 전송 지원
 * - 전역 네임스페이스: window.CornAPI
 * ====================================================================== */

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

// 전역 fetch 가드: /api/api/ → /api/, 중복 슬래시 축약
(function __installFetchGuard() {
  const _fetch = window.fetch;
  window.fetch = function(url, opts) {
    if (typeof url === 'string') {
      url = url.replace(/\/api\/api\//gi, '/api/').replace(/([^:])\/\/+/g, '$1/'); 
    }
    return _fetch.call(this, url, opts);
  };
})();

function __getBaseApi() {
  const ls = localStorage.getItem('orcax:BASE_API');
  const base = __normalizeBaseApi(ls || __DEFAULT_API);
  if (base !== ls) localStorage.setItem('orcax:BASE_API', base);
  return base;
}

function __buildUrl(path) {
  if (/^https?:\/\//i.test(path)) return path;
  const base = __getBaseApi();
  const p = String(path || '').replace(/^\/+/, '');
  return `${base}/${p}`.replace(/\/api\/api\//gi, '/api/').replace(/([^:])\/\/+/g, '$1/');
}

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
  const text = await res.text();
  const isJson = (res.headers.get('content-type') || '').includes('application/json');
  const data = text ? (isJson ? JSON.parse(text) : { raw: text }) : {};
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} @ ${path}`);
    err.response = res; err.data = data;
    throw err;
  }
  return data;
}

function __getIds() { return { kakaoId: localStorage.getItem('kakaoId') || '', nickname: localStorage.getItem('nickname') || '' }; }
function __setIds({ kakaoId, nickname }) { if (kakaoId) localStorage.setItem('kakaoId', kakaoId); if (nickname) localStorage.setItem('nickname', nickname); }
function __n(v) { const x = Number(v); return Number.isFinite(x) ? x : 0; }

const CornAPI = {
  get base() { return __getBaseApi(); },

  async login({ kakaoId, nickname }) {
    if (!kakaoId || !nickname) throw new Error('kakaoId, nickname 필요');
    const r = await __jsonFetch('login', { method: 'POST', body: { kakaoId, nickname } });
    __setIds({ kakaoId, nickname }); return r;
  },

  async initUser({ kakaoId, nickname }) {
    return __jsonFetch('init-user', { method: 'POST', body: { kakaoId, nickname } });
  },

  async getUserdata({ kakaoId, nickname } = {}) {
    const ids = __getIds();
    const k = kakaoId || ids.kakaoId; const n = nickname || ids.nickname;
    if (!k && !n) throw new Error('kakaoId 또는 nickname 필요');
    try { return await __jsonFetch('userdata', { method: 'GET', query: { kakaoId: k, nickname: n } }); }
    catch { return await __jsonFetch('userdata', { method: 'POST', body: { kakaoId: k, nickname: n } }); }
  },

  async getCornSummary({ kakaoId } = {}) {
    const k = kakaoId || __getIds().kakaoId; if (!k) throw new Error('kakaoId 필요');
    return __jsonFetch('corn/summary', { method: 'GET', query: { kakaoId: k } });
  },

  async buyAdditive({ kakaoId, item, qty = 1 }) {
    const k = kakaoId || __getIds().kakaoId; if (!k) throw new Error('kakaoId 필요');
    const itm = (item === 'seeds') ? 'seed' : item;
    return __jsonFetch('corn/buy-additive', { method: 'POST', body: { kakaoId: k, item: itm, qty: __n(qty) } });
  },

  async plant({ kakaoId } = {}) {
    const k = kakaoId || __getIds().kakaoId;
    return __jsonFetch('corn/plant', { method: 'POST', body: { kakaoId: k } });
  },

  async harvest({ kakaoId } = {}) {
    const k = kakaoId || __getIds().kakaoId;
    return __jsonFetch('corn/harvest', { method: 'POST', body: { kakaoId: k } });
  },

  async pop({ kakaoId, use = 'salt' } = {}) {
    const k = kakaoId || __getIds().kakaoId;
    return __jsonFetch('corn/pop', { method: 'POST', body: { kakaoId: k, use } });
  },

  async exchange({ kakaoId, dir = 'popcorn->fertilizer', qty = 1 } = {}) {
    const k = kakaoId || __getIds().kakaoId;
    return __jsonFetch('corn/exchange', { method: 'POST', body: { kakaoId: k, dir, qty: __n(qty) } });
  },

  async useInventory({ kakaoId, type, amount = 1 } = {}) {
    const k = kakaoId || __getIds().kakaoId;
    return __jsonFetch('user/inventory/use', { method: 'POST', body: { kakaoId: k, type, amount: __n(amount) } });
  }
};

window.CornAPI = CornAPI;








