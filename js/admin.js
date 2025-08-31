// admin.js (for OrcaX admin.html)
// - API base: localStorage.orcax_api || ngrok 기본
// - Headers: x-kakao-id 포함
// - Health: /api/corn/status, /api/finance/config
// - Tickets: /api/finance/my-tickets (어드민 엔드포인트 생기면 교체)
// - Tabs: data-tab="withdraw|deposit|all"
// - Tables: #tbWithdraw, #tbDeposit, #tbAll

(function () {
  const API_BASE = (localStorage.getItem('orcax_api') || 'https://climbing-wholly-grouper.jp.ngrok.io').replace(/\/+$/,'');
  const $ = s => document.querySelector(s);
  const fmt = n => Number(n||0).toLocaleString();
  const pill = (t, cls='') => `<span style="padding:.1rem .4rem;border-radius:999px;border:1px solid rgba(255,255,255,.15)" class="${cls}">${t}</span>`;

  // ---------- Kakao ----------
  async function ensureKakaoId(){
    let kid = localStorage.getItem('kakaoId');
    if (kid) return kid;
    try{
      if (window.Kakao && !Kakao.isInitialized()) Kakao.init('YOUR_KAKAO_JAVASCRIPT_KEY');
      if (window.Kakao){
        const st = await new Promise(res => Kakao.Auth.getStatusInfo(res));
        if (st.status === 'connected') {
          const me = await Kakao.API.request({ url: '/v2/user/me' });
          kid = String(me.id);
          localStorage.setItem('kakaoId', kid);
          const nn = me.properties?.nickname || me.kakao_account?.profile?.nickname;
          if (nn) localStorage.setItem('nickname', nn);
        }
      }
    }catch(e){}
    return localStorage.getItem('kakaoId') || '';
  }

  // ---------- API ----------
  async function api(path, opt={}){
    const kid = localStorage.getItem('kakaoId') || '';
    const url = API_BASE + path + (opt.method === 'GET' ? ((path.includes('?')?'&':'?') + '_=' + Date.now()) : '');
    const t0 = performance.now();
    try{
      const res = await fetch(url, {
        method: opt.method || 'GET',
        headers: { 'Content-Type':'application/json', 'x-kakao-id': kid },
        body: opt.body ? JSON.stringify(opt.body) : undefined,
        cache: 'no-store'
      });
      const t1 = performance.now();
      let data={}; try{ data = await res.json(); } catch {}
      return { ok: res.ok && (data?.ok!==false), status: res.status, data, ping: Math.round(t1-t0) };
    }catch(e){
      const t1 = performance.now();
      return { ok:false, status:0, data:{ error:String(e) }, ping: Math.round(t1-t0) };
    }
  }

  // ---------- Health ----------
  async function health(){
    $('#apiBaseView') && ($('#apiBaseView').textContent = API_BASE);
    $('#kakaoIdView') && ($('#kakaoIdView').textContent = localStorage.getItem('kakaoId') || '-');
    $('#nickView') && ($('#nickView').textContent = localStorage.getItem('nickname') || '-');

    const r = await api('/api/corn/status', { method:'GET' });
    if ($('#pingView')) $('#pingView').textContent = r.ping;
    if ($('#connDot')) $('#connDot').className = 'dot ' + (r.ok?'ok':'bad');
    if ($('#connText')) $('#connText').textContent = '서버 연결: ' + (r.ok?'정상':'실패');

    // 관리자 지갑 표시
    const cfg = await api('/api/finance/config', { method:'GET' });
    if (cfg.ok && cfg.data?.solanaAdminWallet && $('#adminWallet')) {
      $('#adminWallet').textContent = cfg.data.solanaAdminWallet;
      if ($('#adminWalletLine')) $('#adminWalletLine').hidden = false;
    }
    return r.ok;
  }

  // ---------- Tickets ----------
  function renderRows(tbody, rows, mapper){
    tbody.innerHTML = '';
    if (!rows || !rows.length){
      tbody.innerHTML = '<tr><td colspan="5" class="muted">내역이 없습니다.</td></tr>';
      return;
    }
    rows.forEach(x => {
      const tr = document.createElement('tr');
      tr.innerHTML = mapper(x);
      tbody.appendChild(tr);
    });
  }

  async function loadTickets(){
    // 어드민 전용 엔드포인트가 생기면 여기만 바꾸면 됨:
    // const r = await api('/api/admin/tickets?status=all', { method:'GET' });
    const r = await api('/api/finance/my-tickets', { method:'GET' });
    const items = (r.ok && Array.isArray(r.data?.items)) ? r.data.items : [];
    const toTime = t => new Date(t||Date.now()).toLocaleString();

    const withdraw = items.filter(x => x.type==='withdraw');
    const deposit  = items.filter(x => x.type==='deposit');

    const tbW = $('#tbWithdraw'), tbD = $('#tbDeposit'), tbA = $('#tbAll');
    if (tbW) renderRows(tbW, withdraw, x => `
      <td>${x.kakaoId||'-'}</td>
      <td>${fmt(x.amount)}</td>
      <td>${x.wallet?`<code>${x.wallet}</code>`:'-'}</td>
      <td>${pill(x.status, x.status==='approved'?'ok':x.status==='rejected'?'bad':'')}</td>
      <td>${toTime(x.createdAt)}</td>
    `);
    if (tbD) renderRows(tbD, deposit, x => `
      <td>${x.kakaoId||'-'}</td>
      <td>${fmt(x.amount)}</td>
      <td>${x.method||'-'}</td>
      <td>${pill(x.status, x.status==='approved'?'ok':x.status==='rejected'?'bad':'')}</td>
      <td>${toTime(x.createdAt)}</td>
    `);
    if (tbA) renderRows(tbA, items, x => `
      <td>${x.type||'-'}</td>
      <td>${x.kakaoId||'-'}</td>
      <td>${fmt(x.amount)}</td>
      <td>${pill(x.status, x.status==='approved'?'ok':x.status==='rejected'?'bad':'')}</td>
      <td>${toTime(x.createdAt)}</td>
    `);
  }

  // ---------- Tabs ----------
  function initTabs(){
    document.querySelectorAll('[data-tab]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const id = btn.dataset.tab;
        ['withdraw','deposit','all'].forEach(t => {
          const sec = document.getElementById(t);
          if (sec) sec.hidden = (t!==id);
        });
      });
    });
    const first = document.querySelector('[data-tab="withdraw"]') || document.querySelector('[data-tab]');
    first && first.click();
  }

  // ---------- Controls ----------
  function initControls(){
    const btnRefresh = document.getElementById('btnRefresh');
    const apiSave = document.getElementById('apiSave');
    const apiInput = document.getElementById('apiInput');
    const auto = document.getElementById('autoRefresh');

    if (apiInput) apiInput.value = API_BASE;

    btnRefresh && btnRefresh.addEventListener('click', async ()=>{
      const ok = await health();
      if (ok) await loadTickets();
    });

    apiSave && apiSave.addEventListener('click', ()=>{
      const v = (apiInput.value||'').trim();
      if (!v) return;
      localStorage.setItem('orcax_api', v.replace(/\/+$/,''));
      location.reload();
    });

    auto && auto.addEventListener('change', e=>{
      if (e.target.checked){ e.target.__t = setInterval(()=>btnRefresh.click(), 30000); }
      else clearInterval(e.target.__t);
    });
  }

  // ---------- Boot ----------
  document.addEventListener('DOMContentLoaded', async ()=>{
    await ensureKakaoId();
    initTabs();
    initControls();
    const ok = await health();
    if (ok) await loadTickets();
  });
})();
