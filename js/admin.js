(function () {
  const API_BASE = (localStorage.getItem('orcax_api') || 'https://climbing-wholly-grouper.jp.ngrok.io').replace(/\/+$/,'');
  const ADMIN_KEY = () => localStorage.getItem('admin_key') || '';
  const $ = s => document.querySelector(s);
  const fmt = n => Number(n||0).toLocaleString();
  const pill = (t, cls='') => `<span style="padding:.1rem .4rem;border-radius:999px;border:1px solid rgba(255,255,255,.15)" class="${cls}">${t}</span>`;

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

  async function api(path, opt={}){
    const kid = localStorage.getItem('kakaoId') || '';
    const hdr = { 'Content-Type':'application/json', 'x-kakao-id': kid };
    if (ADMIN_KEY()) hdr['x-admin-key'] = ADMIN_KEY();
    const url = API_BASE + path + (opt.method === 'GET' ? ((path.includes('?')?'&':'?') + '_=' + Date.now()) : '');
    const t0 = performance.now();
    try{
      const res = await fetch(url, { method:opt.method||'GET', headers:hdr, body:opt.body?JSON.stringify(opt.body):undefined, cache:'no-store' });
      const t1 = performance.now();
      let data={}; try{ data = await res.json(); } catch {}
      return { ok: res.ok && (data?.ok!==false), status: res.status, data, ping: Math.round(t1-t0) };
    }catch(e){
      const t1 = performance.now();
      return { ok:false, status:0, data:{ error:String(e) }, ping: Math.round(t1-t0) };
    }
  }

  async function health(){
    $('#apiBaseView') && ($('#apiBaseView').textContent = API_BASE);
    $('#kakaoIdView') && ($('#kakaoIdView').textContent = localStorage.getItem('kakaoId') || '-');
    $('#nickView') && ($('#nickView').textContent = localStorage.getItem('nickname') || '-');

    const r = await api('/api/corn/status', { method:'GET' });
    if ($('#pingView')) $('#pingView').textContent = r.ping;
    if ($('#connDot'))  $('#connDot').className = 'dot ' + (r.ok?'ok':'bad');
    if ($('#connText')) $('#connText').textContent = '서버 연결: ' + (r.ok?'정상':'실패');

    const cfg = await api('/api/finance/config', { method:'GET' });
    if (cfg.ok && cfg.data?.solanaAdminWallet && $('#adminWallet')) {
      $('#adminWallet').textContent = cfg.data.solanaAdminWallet;
      if ($('#adminWalletLine')) $('#adminWalletLine').hidden = false;
    }
    return r.ok;
  }

  function renderRows(tbody, rows, mapper){
    tbody.innerHTML = '';
    if (!rows || !rows.length){
      tbody.innerHTML = '<tr><td colspan="6" class="muted">내역이 없습니다.</td></tr>';
      return;
    }
    rows.forEach(x => { const tr = document.createElement('tr'); tr.innerHTML = mapper(x); tbody.appendChild(tr); });
  }

  async function loadTickets(){
    const hasAdmin = !!ADMIN_KEY();
    const r = hasAdmin
      ? await api('/api/admin/tickets?status=all', { method:'GET' })
      : await api('/api/finance/my-tickets', { method:'GET' });

    const items = (r.ok && Array.isArray(r.data?.items)) ? r.data.items : [];
    const toTime = t => new Date(t||Date.now()).toLocaleString();

    const withdraw = items.filter(x => x.type==='withdraw');
    const deposit  = items.filter(x => x.type==='deposit');

    const tbW = $('#tbWithdraw'), tbD = $('#tbDeposit'), tbA = $('#tbAll');

    tbW && renderRows(tbW, withdraw, x => `
      <td>${x.kakaoId||'-'}</td>
      <td>${fmt(x.amount)}</td>
      <td>${x.wallet?`<code>${x.wallet}</code>`:'-'}</td>
      <td>${pill(x.status, x.status==='approved'?'ok':x.status==='rejected'?'bad':'')}</td>
      <td>${toTime(x.createdAt)}</td>
      <td>-</td>
    `);

    tbD && renderRows(tbD, deposit, x => `
      <td>${x.kakaoId||'-'}</td>
      <td>${fmt(x.amount)}</td>
      <td>${x.method||'-'}</td>
      <td>${pill(x.status, x.status==='approved'?'ok':x.status==='rejected'?'bad':'')}</td>
      <td>${toTime(x.createdAt)}</td>
      <td>
        ${ADMIN_KEY() && x.status==='pending' && x.type==='deposit'
          ? `<label><input type="checkbox" class="approveTick" data-id="${x._id}" data-amount="${x.amount}" data-kakao="${x.kakaoId}"> 승인</label>`
          : '-'}
      </td>
    `);

    tbA && renderRows(tbA, items, x => `
      <td>${x.type||'-'}</td>
      <td>${x.kakaoId||'-'}</td>
      <td>${fmt(x.amount)}</td>
      <td>${pill(x.status, x.status==='approved'?'ok':x.status==='rejected'?'bad':'')}</td>
      <td>${toTime(x.createdAt)}</td>
    `);

    // 버튼에 카운트 배지
    const bW = document.querySelector('[data-tab="withdraw"]');
    const bD = document.querySelector('[data-tab="deposit"]');
    const bA = document.querySelector('[data-tab="all"]');
    bW && (bW.innerHTML = `출금 요청 <small>(${withdraw.length})</small>`);
    bD && (bD.innerHTML = `입금 요청 <small>(${deposit.length})</small>`);
    bA && (bA.innerHTML = `전체 요청 <small>(${items.length})</small>`);

    return { w: withdraw.length, d: deposit.length, all: items.length };
  }

  function setTab(id){ ['withdraw','deposit','all'].forEach(t => { const s=document.getElementById(t); if(s) s.hidden=(t!==id); }); }

  function initControls(){
    const btnRefresh = $('#btnRefresh');
    const apiSave = $('#apiSave');
    const apiInput = $('#apiInput');
    const adminKeyInput = $('#adminKeyInput');
    const auto = $('#autoRefresh');

    if (apiInput) apiInput.value = API_BASE;
    if (adminKeyInput) adminKeyInput.value = ADMIN_KEY();

    document.querySelectorAll('[data-tab]').forEach(btn=>{
      btn.addEventListener('click', ()=> setTab(btn.dataset.tab));
    });

    btnRefresh && btnRefresh.addEventListener('click', async ()=>{
      const ok = await health();
      if (ok) {
        const cnt = await loadTickets();
        if (cnt.d>0) setTab('deposit'); else if (cnt.w>0) setTab('withdraw'); else setTab('all');
      }
    });

    apiSave && apiSave.addEventListener('click', ()=>{
      const v = (apiInput.value||'').trim();
      if (v) localStorage.setItem('orcax_api', v.replace(/\/+$/,''));
      const k = (adminKeyInput?.value||'').trim();
      if (k) localStorage.setItem('admin_key', k);
      location.reload();
    });

    auto && auto.addEventListener('change', e=>{
      if (e.target.checked){ e.target.__t = setInterval(()=>btnRefresh.click(), 30000); }
      else clearInterval(e.target.__t);
    });

    // 위임: 승인 체크박스
    const tbD = $('#tbDeposit');
    tbD && tbD.addEventListener('change', async (ev)=>{
      const el = ev.target.closest('.approveTick');
      if (!el || !el.checked) return;
      if (!ADMIN_KEY()){ alert('ADMIN KEY가 설정되어야 승인 가능합니다.'); el.checked=false; return; }

      const id = el.dataset.id;
      const amt = Number(el.dataset.amount||0);
      const kid = el.dataset.kakao||'';
      const tx = prompt(`Tx 해시(선택):\n\nkakaoId=${kid}  amount=${fmt(amt)}`) || '';

      const r = await api(`/api/admin/tickets/${id}/approve`, { method:'POST', body:{ txHash: tx } });
      if (!r.ok){ alert('승인 실패: ' + (r.data?.error||r.status)); el.checked=false; return; }

      alert(`승인 완료! 충전=${fmt(r.data?.credited)}  잔액=${fmt(r.data?.balance)}`);
      $('#btnRefresh').click(); // 새로고침
    });
  }

  document.addEventListener('DOMContentLoaded', async ()=>{
    await ensureKakaoId();
    initControls();
    const ok = await health();
    if (ok) {
      const cnt = await loadTickets();
      if (cnt.d>0) setTab('deposit'); else if (cnt.w>0) setTab('withdraw'); else setTab('all');
    }
  });
})();
