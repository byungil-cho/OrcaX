// 🍟 OrcaX 감자/보리/씨앗 보정 표시 패치 (ADD-ONLY)
(function(){
  const DEFAULT_API = 'https://climbing-wholly-grouper.jp.ngrok.io';
  const API_BASE = (localStorage.getItem('orcax_api') || DEFAULT_API).replace(/\/+$/,'');
  const $all = (sel) => Array.from(document.querySelectorAll(sel));
  const setText = (selectors, val) => {
    const v = (val ?? 0).toString();
    selectors.forEach(s => {
      // id(#id)와 data-field 모두 지원
      $all('#'+s).forEach(el => el.textContent = v);
      $all(`[data-field="${s}"]`).forEach(el => el.textContent = v);
    });
  };

  function paint(j){
    if(!j || j.ok !== true) return;
    const inv = j.inventory || {};
    const seeds = j.seeds || {};
    // 수확분
    setText(['r-potato','potato','rPotato'], inv.potato);
    setText(['r-barley','barley','rBarley'], inv.barley);
    // 씨앗
    setText(['r-seedpot','seed-potato','rSeedPotato','seedPotato'], seeds.potato);
    setText(['r-seedbar','seed-barley','rSeedBarley','seedBarley'], seeds.barley);
  }

  async function fetchOverview(){
    try{
      const kid = (window.S?.user?.kakaoId) || localStorage.getItem('kakaoId');
      if(!kid) return;
      const r = await fetch(`${API_BASE}/api/user/overview?kakaoId=${encodeURIComponent(kid)}`, { credentials:'include' });
      const j = await r.json();
      console.log('[overview]', j);
      paint(j);
    }catch(e){ console.warn('overview fetch fail', e); }
  }

  // DOM 그린 후 한 번, 그리고 1초 뒤 한 번 더(다른 스크립트가 덮어쓰는 경우 대비)
  window.addEventListener('DOMContentLoaded', ()=>{
    setTimeout(fetchOverview, 300);
    setTimeout(fetchOverview, 1200);
  });
})();
