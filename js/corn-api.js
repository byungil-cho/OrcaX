(function(){
  'use strict';

  /* 이미지 경로/반응형 선택 */
  const IMG_BASE = 'https://byungil-cho.github.io/OrcaX/img/';
  const isMobile = () => window.matchMedia('(max-width:768px)').matches;
  const img = f => IMG_BASE + (isMobile()? ('a_'+f) : f);

  /* DOM refs */
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
  const toast = m => { dom.toast.textContent=m; dom.toast.classList.add('show'); setTimeout(() => dom.toast.classList.remove('show'), 1300); };

  /* 상태 */
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

  /* 서버 호출 */
  async function j(path, body={}, method='POST'){
    const r = await fetch(`${BASE_API}${path}`, {
      method, headers:{'Content-Type':'application/json'},
      body: method === 'GET' ? undefined : JSON.stringify(body),
      mode:'cors', cache:'no-store'
    });
    const d = await r.json().catch(() => ({}));
    if(!r.ok) throw d;
    return d;
  }

  /* 유저/인벤토리 동기화 */
  async function loadUser(){
    if(!kakaoId || !nickname) return;
    try{
      const data = await j('/api/userdata', { kakaoId }); // 서버에서 씨앗/토큰/첨가물 읽어오기
      const u = data?.user || data?.data?.user || {};
      S.online = true; dom.netDot.classList.add('ok'); dom.netTxt.textContent = '온라인';
      dom.nick.textContent = nickname;

      // 서버 값 흡수(문서에 적은 그 매핑) :contentReference[oaicite:4]{index=4}
      S.orcx       = (u.wallet?.orcx ?? u.orcx ?? S.orcx)|0;
      S.seeds      = (u.seeds ?? u.inventory?.seeds ?? u.agri?.seeds ?? S.seeds)|0;
      S.water      = (u.inventory?.water ?? S.water)|0;
      S.fertilizer = (u.inventory?.fertilizer ?? S.fertilizer)|0;
      S.corn       = (u.agri?.corn ?? u.corn ?? S.corn)|0;
      S.popcorn    = (u.food?.popcorn ?? u.popcorn ?? S.popcorn)|0;
      S.salt       = (u.additives?.salt ?? S.salt)|0;
      S.sugar      = (u.additives?.sugar ?? S.sugar)|0;

      // 응답이 애매할 때 직접 보정
      if (typeof u.seeds === 'number') S.seeds = u.seeds;
      if (u.additives) {
        if (typeof u.additives.salt  === 'number') S.salt  = u.additives.salt;
        if (typeof u.additives.sugar === 'number') S.sugar = u.additives.sugar;
      }

      S.level = Math.max(1, Number((u.level ?? u.profile?.level ?? S.level) || 1));
      S.exp   = Math.max(0, Number((u.profile?.exp ?? S.exp) || 0));
      S.phase = (u.agri?.phase || S.phase || 'IDLE');
      S.g     = Number.isFinite(u.agri?.g) ? u.agri.g : (S.g||0);

      if(u.agri?.gradeInv) S.gradeInv = Object.assign({A:0,B:0,C:0,D:0,E:0,F:0}, u.agri.gradeInv);

      renderAll(); save();
    }catch(e){
      S.online=false; dom.netDot.classList.remove('ok'); dom.netTxt.textContent='오프라인/연결 실패';
      renderAll();
    }
  }

  /* 액션들 */
  async function plant(){
    if(!kakaoId || !nickname) return;
    if((S.seeds|0) <= 0){ toast('씨앗이 없습니다'); return; }
    try{
      const res = await j('/api/corn/plant', { kakaoId }); // :contentReference[oaicite:5]{index=5}
      const inv = res?.inventory || res?.agri || res;
      if(typeof inv?.seeds === 'number') S.seeds = inv.seeds;
      S.phase='GROW'; S.g=0; gainExp(8);
      await loadUser(); toast('씨앗 심었습니다');
    }catch(e){
      S.seeds = Math.max(0, (S.seeds|0) - 1);
      S.phase='GROW'; S.g=0; gainExp(8); renderAll(); save(); toast('씨앗(로컬)');
    }
  }

  async function useResource(kind){
    if(!kakaoId || !nickname) return;
    const field = (kind==='water') ? 'water' : 'fertilizer';
    if(S[field]<=0){ toast((field==='water'?'물':'거름')+' 없음'); return; }
    try{
      const res = await j('/api/user/inventory/use', { kakaoId, type: field, amount: 1 });
      if(typeof res?.inventory?.water === 'number') S.water = res.inventory.water;
      if(typeof res?.inventory?.fertilizer === 'number') S.fertilizer = res.inventory.fertilizer;
      gainGrowth(+5); gainExp(3);
      await loadUser(); toast((field==='water'?'물':'거름')+' -1');
    }catch(e){
      S[field]--; gainGrowth(+5); gainExp(3); renderAll(); save(); toast('오프라인 임시');
    }
  }

  function gradeFromStreak(n){ if(n>=5)return 'A'; if(n===4)return 'B'; if(n===3)return 'C'; if(n===2)return 'D'; if(n===1)return 'E'; return 'F'; }
  let localStreak = 0;

  async function harvest(){
    if(!kakaoId || !nickname) return;
    if(!(S.phase==='GROW' && S.g>=100)){ toast('아직 수확 단계 아님'); return; }
    localStreak++;
    try{
      const res = await j('/api/corn/harvest', { kakaoId, grade:gradeFromStreak(localStreak) });
      if(typeof res?.agri?.corn === 'number') S.corn = res.agri.corn;
      if(typeof res?.seeds === 'number') S.seeds = res.seeds;
      S.phase='STUBBLE'; S.g=0; gainExp(12);
      await loadUser(); toast('수확 완료');
    }catch(e){
      const gain = 5 + Math.floor(Math.random()*3);
      S.corn += gain; S.phase='STUBBLE'; S.g=0; gainExp(12);
      renderAll(); save(); toast('수확(로컬)');
    }
  }

  async function pop(){
    if(!kakaoId || !nickname) return;
    if(S.corn<1){ toast('옥수수 없음'); return; }
    if(S.salt<1 || S.sugar<1){ toast('소금/설탕 1:1 필요'); return; }
    if(S.orcx<30){ toast('토큰 30 필요'); return; }
    try{
      await j('/api/corn/pop', { kakaoId, use:{salt:1,sugar:1}, tokenCost:30 });
      await loadUser(); gainExp(2); toast('뻥튀기 처리');
    }catch(e){
      S.corn--; S.salt--; S.sugar--; S.orcx-=30;
      renderAll(); save(); toast('뻥튀기(로컬)');
    }
  }

  async function exchangePopToFert(){
    if(!kakaoId || !nickname) return;
    if(S.popcorn<1){ toast('팝콘 부족'); return; }
    try{
      await j('/api/corn/exchange', { kakaoId, from:'popcorn', to:'fertilizer', qty:1 });
      await loadUser(); toast('팝콘→거름 교환');
    }catch(e){
      S.popcorn--; S.fertilizer++; renderAll(); save(); toast('교환(로컬)');
    }
  }

  /* 성장/레벨 및 렌더 */
  function gainGrowth(d){ S.g=Math.max(0,Math.min(100,(S.g||0)+d)); renderGauge(); }
  function gainExp(n){
    S.exp=(S.exp||0)+n;
    while(S.exp>=100){ S.exp-=100; S.level=(S.level||1)+1; try{ j('/api/user/exp',{kakaoId,expGain:n,level:S.level}); }catch(_){} toast(`Level Up! Lv.${S.level}`); }
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

  (async function boot(){ renderAll(); bind(); await loadUser(); })();

  /* ====================== 구매(서버 우선 + 응답 검증 + 로컬 폴백) ====================== */

  // 서버가 어떤 라우트로 붙어있든 순서대로 시도
  async function tryBuyEndpointSequence(type, price){
    const payload = { kakaoId, item:type, qty:1, tokenCost:price };
    const eps = (type==='seeds')
      ? ['/api/corn/seeds/buy','/api/corn/buy','/api/user/inventory/buy']
      : ['/api/user/additives/buy','/api/additives/buy','/api/user/inventory/buy','/api/corn/buy'];
    let last;
    for(const ep of eps){
      try{ return await j(ep, payload); }catch(e){ last=e; }
    }
    throw last || new Error('buy failed');
  }

  function changedByServer(res, type, before){
    const u = res?.user || res?.data?.user || res;
    const inv = u?.inventory || u?.agri || u?.additives || u;
    const wOrcx = (u?.wallet?.orcx ?? u?.orcx);
    let changed=false;
    if(type==='seeds'){
      const v = (u?.seeds ?? inv?.seeds);
      if(typeof v==='number' && v!==before.seeds) changed=true;
    }else if(type==='salt'){
      const v = u?.additives?.salt ?? inv?.salt;
      if(typeof v==='number' && v!==before.salt) changed=true;
    }else if(type==='sugar'){
      const v = u?.additives?.sugar ?? inv?.sugar;
      if(typeof v==='number' && v!==before.sugar) changed=true;
    }
    if(typeof wOrcx==='number' && wOrcx!==before.orcx) changed=true;
    return changed;
  }

  async function buyItem(type){
    const prices = { salt:10, sugar:20, seeds:100 };
    const label  = { salt:'소금', sugar:'설탕', seeds:'씨앗' }[type] || type;
    const price  = prices[type];
    if(!price){ toast('잘못된 품목'); return {synced:false}; }

    const before = { seeds:S.seeds, salt:S.salt, sugar:S.sugar, orcx:S.orcx };

    // 1) 서버 시도
    try{
      const res = await tryBuyEndpointSequence(type, price);
      // 응답이 실제 갱신을 반영했는지 확인
      if (changedByServer(res, type, before)){
        toast(`${label} 구매 완료`);
        return {synced:true, res};
      }
      // 200이더라도 값 안 바뀌었으면 비동기화로 간주
      throw new Error('server-no-change');
    }catch(_e){
      // 2) 로컬 폴백(즉시 반영)
      if ((S.orcx|0) < price){ toast('토큰 부족'); return {synced:false}; }
      S.orcx -= price;
      if(type==='salt')   S.salt++;
      if(type==='sugar')  S.sugar++;
      if(type==='seeds')  S.seeds++;
      renderAll(); save();
      toast(`${label} 구매(로컬) · 서버 미동기화`);
      return {synced:false};
    }
  }

  /* 전역 호환 (HTML에서 직접 호출) */
  window.S = S;
  window.buyItem = buyItem;
  window.loadUser = loadUser;

})();


