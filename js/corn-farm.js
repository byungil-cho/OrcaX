// OrcaX Corn Farm – frontend actions wired to backend
// Works with endpoints implemented in server-unified.js
// - /api/init-user (GET/POST)
// - /api/userdata (GET) or /api/corn/summary (GET)
// - /api/corn/plant (POST)
// - /api/user/inventory/use (POST)
// - /api/corn/grow (POST)
// - /api/corn/harvest (POST)
// - /api/corn/exchange (POST)
// - /api/corn/buy-additive (POST)
// - /api/corn/priceboard (GET)

(function(){
  const $  = (s, el=document) => el.querySelector(s);
  const $$ = (s, el=document) => Array.from(el.querySelectorAll(s));

  // ==== Identity & API base ====
  const qs = new URLSearchParams(location.search);
  const store = {
    get base(){ return localStorage.getItem('ORCAX_API_BASE') || $('#apiInput')?.value || ''; },
    set base(v){ localStorage.setItem('ORCAX_API_BASE', v); },
    get kakaoId(){ return localStorage.getItem('ORCAX_KAKAO') || qs.get('kakaoId') || `guest-${Date.now()}`; },
    set kakaoId(v){ localStorage.setItem('ORCAX_KAKAO', v); },
    get nickname(){ return localStorage.getItem('ORCAX_NICK') || qs.get('nickname') || '손님'; },
    set nickname(v){ localStorage.setItem('ORCAX_NICK', v); }
  };

  // write back, so next page load is stable
  store.kakaoId = store.kakaoId; store.nickname = store.nickname;

  const state = {
    progress: 0, // 0..100 (UI 전용)
    bars: { water: 0, fert: 0, grow: 0 },
    r: { seeds:0, water:0, fert:0, corn:0, pop:0, salt:0, sugar:0, orcx:0 },
    phase: 'INIT'
  };

  const el = {
    netDot: $('#netDot'),
    nick:   $('#nick'),
    rSeeds: $('#r-seeds'), rWater: $('#r-water'), rFert: $('#r-fert'), rCorn: $('#r-corn'),
    rPop: $('#r-pop'), rSalt: $('#r-salt'), rSugar: $('#r-sugar'), rOrcx: $('#r-orcx'),
    gfill: $('#gfill'), gnum: $('#gnum'),
    vWater: $('#vbar-water'), vFert: $('#vbar-fert'), vGrow: $('#vbar-grow'),
    miniCap: $('#miniCap'), seedBadge: $('#seedBadgeImg'), miniImg: $('#miniImg'),

    // buttons
    btnPlant: $('#btn-plant'), btnWater: $('#btn-water'), btnFert: $('#btn-fert'),
    btnHarv: $('#btn-harv'), btnPop: $('#btn-pop'), btnEx: $('#btn-ex'),

    // buy modal
    buyOpen: $('#open-buy-all'), buyModal: $('#buyAllModal'),
    buyRows: () => $$('#buyAllModal .row[data-item]'),
    buyWallet: $('#buyAllWallet'), buyTotal: $('#buyAllTotal'),
    buyOK: $('#buyAllOK'), buyCancel: $('#buyAllCancel'),

    // api modal
    apiOpen: $('#btn-api'), apiModal: $('#apiModal'), apiInput: $('#apiInput'),
    apiSave: $('#apiSave'), apiCancel: $('#apiCancel'),

    toast: $('#toast')
  };

  function setDot(ok){ el.netDot?.classList.toggle('ok', !!ok); }
  function toast(msg){
    if (!el.toast) return alert(msg);
    el.toast.textContent = msg;
    el.toast.classList.add('show');
    setTimeout(()=> el.toast.classList.remove('show'), 1500);
  }

  async function api(path, opt={}){
    const base = store.base.replace(/\/$/, '');
    const url = base + path;
    const headers = { 'Content-Type': 'application/json' };
    try{
      const res = await fetch(url, { method:'GET', ...opt, headers:{...headers, ...(opt.headers||{})} });
      if (!res.ok) throw new Error(`${res.status}`);
      const ct = res.headers.get('content-type')||'';
      return ct.includes('application/json') ? res.json() : res.text();
    }catch(err){
      console.error('[API FAIL]', path, err);
      throw err;
    }
  }

  function render(){
    el.nick.textContent = store.nickname || '(로그인 필요)';
    for (const k of Object.keys(state.r)) {
      const map = { seeds:'rSeeds', water:'rWater', fert:'rFert', corn:'rCorn', pop:'rPop', salt:'rSalt', sugar:'rSugar', orcx:'rOrcx' };
      const v = state.r[k] ?? 0; if (el[map[k]]) el[map[k]].textContent = v;
    }
    el.gfill.style.setProperty('--p', `${Math.max(0, Math.min(100, state.progress))}%`);
    el.gnum.textContent = Math.round(state.progress);
    el.vWater.style.height = `${state.bars.water}%`;
    el.vFert.style.height = `${state.bars.fert}%`;
    el.vGrow.style.height = `${state.bars.grow}%`;

    el.seedBadge.style.display = state.phase === 'GROW' ? 'block' : 'none';
    el.miniCap.textContent = state.phase === 'GROW' ? '재배중' : '휴경';
  }

  function incProgress(by){
    state.progress = Math.min(100, state.progress + by);
    state.bars.grow = state.progress;
    render();
  }

  async function ensureUser(){
    try{
      await api('/api/init-user', { method:'POST', body: JSON.stringify({ kakaoId: store.kakaoId, nickname: store.nickname }) });
      setDot(true);
    }catch(e){ setDot(false); throw e; }
  }

  async function refresh(){
    try{
      const data = await api(`/api/corn/summary?kakaoId=${encodeURIComponent(store.kakaoId)}`);
      // pack to state
      state.r.orcx  = (data.wallet?.orcx)|0;
      state.r.water = (data.inventory?.water)|0;
      state.r.fert  = (data.inventory?.fertilizer)|0;
      state.r.corn  = (data.agri?.corn)|0;
      state.r.seeds = (data.agri?.seeds)|0;
      state.r.pop   = (data.food?.popcorn)|0;
      state.r.salt  = (data.additives?.salt)|0;
      state.r.sugar = (data.additives?.sugar)|0;
      render();
    }catch(e){ console.warn('summary fail', e); }
  }

  // ==== Actions ====
  async function doPlant(){
    try{
      const r = await api('/api/corn/plant', { method:'POST', body: JSON.stringify({ kakaoId: store.kakaoId }) });
      state.phase = 'GROW';
      state.r.seeds = r.seeds ?? Math.max(0, state.r.seeds - 1);
      toast('씨앗을 심었습니다 🌱');
      incProgress(5);
      await refresh();
    }catch(e){ toast('심기 실패'); }
  }

  async function useInventory(type){
    const r = await api('/api/user/inventory/use', { method:'POST', body: JSON.stringify({ kakaoId: store.kakaoId, type, amount: 1 }) });
    state.r.water = r.inventory?.water ?? state.r.water;
    state.r.fert  = r.inventory?.fertilizer ?? state.r.fert;
    return r;
  }

  async function doWater(){
    try{
      await useInventory('water');
      const g = await api('/api/corn/grow', { method:'POST', body: JSON.stringify({ kakaoId: store.kakaoId, step: 6 }) });
      state.bars.water = Math.min(100, state.bars.water + 25);
      incProgress(g.gIncreasedBy || 6);
      toast('물을 주었습니다 💧');
      await refresh();
    }catch(e){ toast('물 주기 실패'); }
  }

  async function doFert(){
    try{
      await useInventory('fertilizer');
      const g = await api('/api/corn/grow', { method:'POST', body: JSON.stringify({ kakaoId: store.kakaoId, step: 8 }) });
      state.bars.fert = Math.min(100, state.bars.fert + 25);
      incProgress(g.gIncreasedBy || 8);
      toast('거름을 주었습니다 🪴');
      await refresh();
    }catch(e){ toast('거름 주기 실패'); }
  }

  async function doHarvest(){
    try{
      await api('/api/corn/harvest', { method:'POST', body: JSON.stringify({ kakaoId: store.kakaoId, grade: 'A' }) });
      toast('수확 완료! 🌽');
      // 서버 계산 결과 반영을 위해 전체 리프레시
      await refresh();
      // 수확 후 상태 초기화(프론트 진행바)
      state.phase = 'INIT';
      state.progress = 0; state.bars = { water:0, fert:0, grow:0 };
      render();
    }catch(e){ toast('수확 실패'); }
  }

  async function doPop(){
    try{
      // 서버에 별도 pop 엔드포인트가 없으므로,
      // 비료 1개 ▶ 팝콘 1개 교환을 사용하여 "뻥튀기" 동작을 구현
      const r = await api('/api/corn/exchange', { method:'POST', body: JSON.stringify({ kakaoId: store.kakaoId, dir: 'fertilizer->popcorn', qty: 1 }) });
      state.r.pop = r?.corn?.popcorn ?? state.r.pop;
      state.r.fert = r?.user?.fertilizer ?? state.r.fert;
      toast('뻥튀기 하나 만들었어요 🍿');
      await refresh();
    }catch(e){ toast('뻥튀기 실패'); }
  }

  async function doExchange(){
    try{
      const r = await api('/api/corn/exchange', { method:'POST', body: JSON.stringify({ kakaoId: store.kakaoId, dir: 'popcorn->fertilizer', qty: 1 }) });
      state.r.pop = r?.corn?.popcorn ?? state.r.pop;
      state.r.fert = r?.user?.fertilizer ?? state.r.fert;
      toast('팝콘 1 ▶ 거름 1 교환');
      await refresh();
    }catch(e){ toast('교환 실패'); }
  }

  // ==== 구매 모달 ====
  const pb = { salt:10, sugar:20, seed:100, currency:'ORCX' };
  function openBuy(){
    el.buyModal.classList.add('show');
    el.buyWallet.textContent = String(state.r.orcx);
    // 최신 단가
    api('/api/corn/priceboard').then((v)=>{
      if (v && typeof v === 'object') {
        if (Number.isFinite(v.salt)) pb.salt = Number(v.salt);
        if (Number.isFinite(v.sugar)) pb.sugar = Number(v.sugar);
        if (Number.isFinite(v.seed)) pb.seed = Number(v.seed);
        pb.currency = v.currency || 'ORCX';
      }
      el.buyRows().forEach(row=>{
        const item = row.getAttribute('data-item');
        const unitEl = $('.unit', row);
        if (unitEl && pb[item] != null) unitEl.textContent = pb[item];
        $('.qty', row).value = 0; $('.sub', row).textContent = '0';
      });
      el.buyTotal.textContent = '0';
    }).catch(()=>{});
  }
  function closeBuy(){ el.buyModal.classList.remove('show'); }

  function recalcBuy(){
    let total = 0;
    el.buyRows().forEach(row=>{
      const item = row.getAttribute('data-item');
      const q = Math.max(0, Number($('.qty', row).value||0));
      const cost = q * (pb[item]||0); $('.sub', row).textContent = String(cost);
      total += cost;
    });
    el.buyTotal.textContent = String(total);
  }

  async function doBuy(){
    const tasks = [];
    el.buyRows().forEach(row=>{
      const item = row.getAttribute('data-item');
      const qty = Math.max(0, Number($('.qty', row).value||0));
      if (qty > 0){
        tasks.push(api('/api/corn/buy-additive', { method:'POST', body: JSON.stringify({ kakaoId: store.kakaoId, item, qty }) }));
      }
    });
    if (tasks.length === 0){ toast('수량을 입력하세요'); return; }
    try{
      await Promise.all(tasks);
      closeBuy();
      toast('구매 완료');
      await refresh();
    }catch(e){ toast('구매 실패'); }
  }

  // ==== API modal ====
  function openApi(){ el.apiInput.value = store.base || ''; el.apiModal.classList.add('show'); }
  function closeApi(){ el.apiModal.classList.remove('show'); }
  function saveApi(){
    const v = (el.apiInput.value||'').trim();
    if (!/^https?:\/\//.test(v)) { toast('올바른 URL을 입력하세요'); return; }
    store.base = v.replace(/\/$/, '');
    closeApi();
    boot();
  }

  // ==== Boot ====
  async function boot(){
    setDot(false);
    if (!store.base){ openApi(); return; }
    try{
      // server ping (optional)
      await api('/api/health');
      setDot(true);
      await ensureUser();
      await refresh();
    }catch(e){ setDot(false); toast('API 연결을 확인하세요'); }
  }

  // ==== wiring ====
  // open modals
  el.buyOpen?.addEventListener('click', openBuy);
  el.buyCancel?.addEventListener('click', closeBuy);
  el.buyOK?.addEventListener('click', doBuy);
  el.apiOpen?.addEventListener('click', openApi);
  el.apiSave?.addEventListener('click', saveApi);
  el.apiCancel?.addEventListener('click', closeApi);

  // qty +/-
  el.buyModal?.addEventListener('click', (ev)=>{
    const btn = ev.target.closest('.btn3');
    if (!btn) return;
    const row = btn.closest('.row'); const inp = $('.qty', row);
    const v = Math.max(0, Number(inp.value||0));
    inp.value = btn.classList.contains('inc') ? v+1 : Math.max(0, v-1);
    recalcBuy();
  });
  el.buyModal?.addEventListener('input', (ev)=>{
    if (ev.target.classList.contains('qty')) recalcBuy();
  });

  // action buttons
  el.btnPlant?.addEventListener('click', doPlant);
  el.btnWater?.addEventListener('click', doWater);
  el.btnFert?.addEventListener('click', doFert);
  el.btnHarv?.addEventListener('click', doHarvest);
  el.btnPop?.addEventListener('click', doPop);
  el.btnEx?.addEventListener('click', doExchange);

  // init
  document.addEventListener('DOMContentLoaded', boot);
})();
