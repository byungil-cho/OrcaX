(function(){
  'use strict';

  /* ===== 이미지/DOM ===== */
  const IMG_BASE = 'https://byungil-cho.github.io/OrcaX/img/';
  const isMobile = () => window.matchMedia('(max-width:768px)').matches;
  const img = f => IMG_BASE + (isMobile()? ('a_'+f) : f);

  const $ = id => document.getElementById(id);
  const dom = {
    netDot:$('netDot'), netTxt:$('netTxt'), nick:$('nick'),
    r:{seeds:$('r-seeds'), water:$('r-water'), fert:$('r-fert'),
       corn:$('r-corn'), pop:$('r-pop'), salt:$('r-salt'), sugar:$('r-sugar'), orcx:$('r-orcx')},
    gnum:$('gnum'), gfill:$('gfill'),
    levelIconMini:$('levelIconMini'), levelText:$('levelText'), expBar:$('expBar'),
    miniImg:$('miniImg'), miniCap:$('miniCap'), bg:$('bg'),
    btnPlant:$('btn-plant'), btnWater:$('btn-water'), btnFert:$('btn-fert'),
    btnHarv:$('btn-harv'), btnPop:$('btn-pop'), btnEx:$('btn-ex'),
    toast:$('toast')
  };
  const toast = m => { dom.toast.textContent=m; dom.toast.classList.add('show'); setTimeout(()=>dom.toast.classList.remove('show'),1300); };

  /* ===== 상태 ===== */
  const S = Object.assign({
    online:false, g:0, phase:'IDLE',
    level:1, exp:0,
    seeds:0, water:0, fertilizer:0,
    corn:0, popcorn:0, salt:0, sugar:0, orcx:0,
    gradeInv:{A:0,B:0,C:0,D:0,E:0,F:0},
    lastGrade:null
  }, safeParse(localStorage.getItem('corn_state')) || {});
  function save(){ try{ localStorage.setItem('corn_state', JSON.stringify(S)); }catch(_){} }
  function safeParse(x){ try{ return JSON.parse(x); }catch(_){ return null; } }

  /* ===== API 루트 및 헬퍼 ===== */
  const DEFAULT_API = 'https://climbing-wholly-grouper.jp.ngrok.io/api';
  const API_ROOT = (localStorage.getItem('orcax:BASE_API') || DEFAULT_API).replace(/\/+$/,'');

  async function j(path, body={}, method='POST'){
    const r = await fetch(`${API_ROOT}${path}`, {
      method, headers:{'Content-Type':'application/json'},
      body: method==='GET' ? undefined : JSON.stringify(body),
      mode:'cors', cache:'no-store'
    });
    const d = await r.json().catch(()=> ({}));
    if(!r.ok) throw d;
    return d;
  }

  /* ===== 데이터 로딩: users + corn_data 병합 ===== */
  async function loadUsers(){ // users 컬렉션
    const d = await j('/userdata', { kakaoId });
    const u = d?.user || d?.data?.user || {};
    const num = v => (typeof v === 'number' ? v : 0);

    S.orcx       = num(u.wallet?.orcx ?? u.orcx);
    S.water      = num(u.water ?? u.inventory?.water);
    S.fertilizer = num(u.fertilizer ?? u.inventory?.fertilizer);
    S.level = Math.max(1, Number((u.level ?? u.profile?.level ?? S.level) || 1));
    S.exp   = Math.max(0, Number((u.profile?.exp ?? S.exp) || 0));
  }

  async function loadCorn(){ // corn_data 컬렉션
    // 서버 구현 차이 대비: 여러 후보를 순차 시도
    const candidates = ['/corn/summary','/corn/data','/corn/status','/corn/get'];
    let d, lastErr;
    for(const p of candidates){
      try{ d = await j(p, { kakaoId }); break; }catch(e){ lastErr=e; }
    }
    if(!d) throw lastErr || new Error('corn summary not found');
    const c = d?.corn || d?.data?.corn || d?.user || d || {};
    const num = v => (typeof v === 'number' ? v : 0);

    // corn_data의 표준 필드 매핑
    S.seeds   = num(c.seeds ?? c.inventory?.seeds ?? c.inventory?.seedCorn);
    S.corn    = num(c.corn);
    S.popcorn = num(c.popcorn ?? c.food?.popcorn);
    const add = c.additives || {};
    S.salt    = num(add.salt ?? c.salt);
    S.sugar   = num(add.sugar ?? c.sugar);

    // 성장도/단계(있으면)
    if (typeof c.g === 'number') S.g = c.g;
    if (c.phase) S.phase = c.phase;
    if (c.gradeInv) S.gradeInv = Object.assign({A:0,B:0,C:0,D:0,E:0,F:0}, c.gradeInv);
  }

  async function loadAll(){
    try{
      await Promise.all([loadUsers(), loadCorn()]);
      S.online = true; dom.netDot.classList.add('ok'); dom.netTxt.textContent = '온라인'; dom.nick.textContent = (nickname||'');
      renderAll(); save();
    }catch(e){
      S.online = false; dom.netDot.classList.remove('ok'); dom.netTxt.textContent = '오프라인/연결 실패';
      // 오프라인일 땐 서버 데이터(물/거름/토큰/옥수수 등) 표시를 0으로 클리어해 착시 방지
      S.seeds=0; S.corn=0; S.popcorn=0; S.salt=0; S.sugar=0; S.water=0; S.fertilizer=0; // 토큰도 0 표시
      S.orcx=0;
      renderAll();
    }
  }
  window.loadAll = loadAll;

  /* ===== 액션 ===== */
  async function plant(){
    if(!kakaoId || !nickname) return;
    if((S.seeds|0) <= 0){ toast('씨앗이 없습니다'); return; }
    try{
      // 심기: corn_data에서 소모 처리
      await j('/corn/seed', { kakaoId, op:'plant', qty:1 });
      S.phase='GROW'; S.g=0; gainExp(8);
      await loadAll(); toast('씨앗 심었습니다');
    }catch(e){
      // 임시 보정(기능 유지) — 저장은 허용
      S.seeds = Math.max(0, (S.seeds|0)-1);
      S.phase='GROW'; S.g=0; gainExp(8); renderAll(); save(); toast('씨앗(로컬)');
    }
  }

  async function useResource(kind){
    if(!kakaoId || !nickname) return;
    const field = (kind==='water') ? 'water' : 'fertilizer';
    if(S[field] <= 0){ toast((field==='water'?'물':'거름')+' 없음'); return; }
    try{
      await j('/user/inventory/use', { kakaoId, type: field, amount: 1 }); // users 컬렉션 차감
      gainGrowth(+5); gainExp(3);
      await loadAll(); toast((field==='water'?'물':'거름')+' -1');
    }catch(e){
      S[field]--; gainGrowth(+5); gainExp(3); renderAll(); save(); toast('오프라인 임시');
    }
  }

  function gradeFromStreak(n){ if(n>=5)return 'A'; if(n===4)return 'B'; if(n===3)return 'C'; if(n===2)return 'D'; if(n===1)return 'E'; return 'F'; }
  let localStreak = 0;

  async function harvest(){
    if(!(S.phase==='GROW' && S.g>=100)){ toast('아직 수확 단계 아님'); return; }
    localStreak++;
    try{
      await j('/corn/harvest', { kakaoId, grade:gradeFromStreak(localStreak) }); // corn_data 증가
      S.phase='STUBBLE'; S.g=0; gainExp(12);
      await loadAll(); toast('수확 완료');
    }catch(e){
      const gain = 5 + Math.floor(Math.random()*3);
      S.corn += gain; S.phase='STUBBLE'; S.g=0; gainExp(12); renderAll(); save(); toast('수확(로컬)');
    }
  }

  async function pop(){
    if(S.corn<1){ toast('옥수수 없음'); return; }
    if(S.salt<1 || S.sugar<1){ toast('소금/설탕 1:1 필요'); return; }
    if(S.orcx<30){ toast('토큰 30 필요'); return; }
    try{
      // corn_data(소금/설탕/옥수수) + users(토큰) 동시에 처리하는 서버 엔드포인트
      // 없으면 후보 순차 시도
      await trySeq(['/corn/pop','/corn/make-pop'], { kakaoId, use:{salt:1,sugar:1,corn:1}, tokenCost:30 });
      await loadAll(); gainExp(2); toast('뻥튀기 처리');
    }catch(e){
      S.corn--; S.salt--; S.sugar--; S.orcx-=30; renderAll(); save(); toast('뻥튀기(로컬)');
    }
  }

  async function exchangePopToFert(){
    if(S.popcorn<1){ toast('팝콘 부족'); return; }
    try{
      await trySeq(['/corn/exchange/pop-to-fert','/corn/exchange'], { kakaoId, from:'popcorn', to:'fertilizer', qty:1 });
      await loadAll(); toast('팝콘→거름 교환');
    }catch(e){
      S.popcorn--; S.fertilizer++; renderAll(); save(); toast('교환(로컬)');
    }
  }

  /* ===== 구매 (두 컬렉션 동시 갱신을 서버가 처리하도록 위임) =====
     - 씨앗:  /corn/seed  {op:'buy', seed:'corn', qty, tokenCost}
              (users.orcx 차감 + corn_data.seeds 증가)
     - 첨가물: /additives/buy {type:'salt'|'sugar', qty, tokenCost}
              (users.orcx 차감 + corn_data.additives 증가)
     - 서버 성공시에만 synced:true (로컬 임시 반영/저장 없음)
  */
  async function buyItem(type){
    const prices = { salt:10, sugar:20, seeds:100 };
    const label  = { salt:'소금', sugar:'설탕', seeds:'씨앗' }[type] || type;
    const price  = prices[type];
    if(!price){ toast('잘못된 품목'); return {synced:false}; }
    if ((S.orcx|0) < price){ toast('토큰 부족'); return {synced:false}; }

    try{
      if (type === 'seeds'){
        await trySeq(['/corn/seed','/seed/buy'], { kakaoId, op:'buy', seed:'corn', qty:1, tokenCost:price });
      } else { // salt/sugar
        await trySeq(['/additives/buy','/user/additives/buy'], { kakaoId, type, qty:1, tokenCost:price });
      }
      toast(`${label} 구매 완료`);
      return {synced:true};
    }catch(e){
      toast(`${label} 구매 실패(서버)`); return {synced:false, error:e};
    }
  }

  async function trySeq(paths, body){
    let last; for(const p of paths){ try{ return await j(p, body); }catch(e){ last=e; } }
    throw last || new Error('no endpoint');
  }

  /* ===== 성장/레벨 & 렌더 ===== */
  function gainGrowth(d){ S.g=Math.max(0,Math.min(100,(S.g||0)+d)); renderGauge(); }
  function gainExp(n){
    S.exp=(S.exp||0)+n;
    while(S.exp>=100){ S.exp-=100; S.level=(S.level||1)+1; try{ j('/user/exp',{kakaoId,expGain:n,level:S.level}); }catch(_){} toast(`Level Up! Lv.${S.level}`); }
    renderLevel(); save();
  }
  function levelIconPath(lv){ const n=Math.max(1,Math.min(10,Math.floor(lv||1))); return IMG_BASE+`mark_${String(n).padStart(2,'0')}.png`; }
  function renderLevel(){ dom.levelIconMini.src = levelIconPath(S.level); dom.levelText.textContent = `Lv.${S.level}`; dom.expBar.style.width = `${Math.max(0,Math.min(99,S.exp))}%`; }
  function pickBgFile(){ const g=S.g|0; if(g<=29) return 'farm_05.png'; if(g<=59) return 'farm_07.png'; if(g<=79) return 'farm_09.png'; if(g<=94) return 'farm_10.png'; return 'farm_12.png'; }
  function applyBg(){ const file=pickBgFile(); const want=`url('${img(file)}')`; if(getComputedStyle(dom.bg).backgroundImage!==want){ dom.bg.style.backgroundImage=want; } }
  function pickMini(){ const g=S.g|0; if(g<20) return {file:'corn_06_02.png',cap:'발아'}; if(g<40) return {file:'corn_04_02.png',cap:'유묘'}; if(g<60) return {file:'corn_02_02.png',cap:'생장'}; if(g<80) return {file:'corn_03_01.png',cap:'성숙 전'}; if(g<95) return {file:'corn_03_03.png',cap:'이삭'}; return {file:'corn_01_01.png',cap:'수확 직전'}; }
  function renderMini(){ const m=pickMini(); dom.miniImg.src=img(m.file); dom.miniImg.alt=m.cap; dom.miniCap.textContent=m.cap; }
  function renderRes(){
    dom.r.seeds.textContent=S.seeds|0; dom.r.water.textContent=S.water|0; dom.r.fert.textContent=S.fertilizer|0;
    dom.r.corn.textContent=S.corn|0; dom.r.pop.textContent=S.popcorn|0; dom.r.salt.textContent=S.salt|0;
    dom.r.sugar.textContent=S.sugar|0; dom.r.orcx.textContent=S.orcx|0;
    dom.btnHarv && (dom.btnHarv.disabled = !(S.phase==='GROW' && S.g>=100));
    dom.btnPop  && (dom.btnPop .disabled = !(S.corn>=1 && S.salt>=1 && S.sugar>=1 && S.orcx>=30));
  }
  function renderGauge(){ const p=Math.max(0,Math.min(100,S.g|0)); dom.gfill.style.setProperty('--p',p+'%'); dom.gnum.textContent=p; }
  function renderAll(){ renderLevel(); renderGauge(); applyBg(); renderMini(); renderRes(); }

  function bind(){
    dom.btnPlant && (dom.btnPlant.onclick = () => plant());
    dom.btnWater && (dom.btnWater.onclick = () => useResource('water'));
    dom.btnFert  && (dom.btnFert .onclick = () => useResource('fertilizer'));
    dom.btnHarv  && (dom.btnHarv .onclick = () => harvest());
    dom.btnPop   && (dom.btnPop  .onclick = () => pop());
    dom.btnEx    && (dom.btnEx   .onclick = () => exchangePopToFert());
    addEventListener('resize', () => { applyBg(); renderMini(); });
  }

  (async function boot(){ renderAll(); bind(); await loadAll(); })();

  /* ===== 전역 브리지 ===== */
  window.S = S;
  window.buyItem = buyItem;
  window.loadUser = loadAll;   // 기존 이름 호환
  window.__corn = { get state(){ return S; }, loadAll, buyItem };

})();








