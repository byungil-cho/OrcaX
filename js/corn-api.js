/* js/corn-api.js */
(function(){
  'use strict';

  /* ===== 이미지 절대 경로 (GitHub Pages) ===== */
  const IMG_BASE = 'https://byungil-cho.github.io/OrcaX/img/';
  const isMobile = () => window.matchMedia('(max-width: 768px)').matches;
  function img(file){ return IMG_BASE + (isMobile()? ('a_'+file) : file); }

  /* ===== DOM ===== */
  const $ = id => document.getElementById(id);
  const dom = {
    netDot: $('netDot'), netTxt: $('netTxt'), nick: $('nick'),
    r:{ water:$('r-water'), fert:$('r-fert'), corn:$('r-corn'), pop:$('r-pop'), salt:$('r-salt'), sugar:$('r-sugar'), orcx:$('r-orcx') },
    gnum:$('gnum'), gfill:$('gfill'),
    levelIconMini:$('levelIconMini'), levelText:$('levelText'), expBar:$('expBar'),
    miniImg:$('miniImg'), miniCap:$('miniCap'),
    bg:$('bg'),
    btnPlant:$('btn-plant'), btnWater:$('btn-water'), btnFert:$('btn-fert'),
    btnHarv:$('btn-harv'), btnPop:$('btn-pop'), btnEx:$('btn-ex'),
    toast:$('toast')
  };
  const toast=(m)=>{ dom.toast.textContent=m; dom.toast.classList.add('show'); setTimeout(()=>dom.toast.classList.remove('show'),1300); };

  /* ===== 상태 ===== */
  const S = Object.assign({
    online:false, g:0, phase:'IDLE',
    level:1, exp:0,
    water:0, fertilizer:0, corn:0, popcorn:0, salt:0, sugar:0, orcx:0,
    gradeInv:{A:0,B:0,C:0,D:0,E:0,F:0},
  }, safeParse(localStorage.getItem('corn_state')) || {});
  function save(){ try{ localStorage.setItem('corn_state', JSON.stringify(S)); }catch(e){} }
  function safeParse(x){ try{ return JSON.parse(x); }catch(_){ return null; } }

  /* ===== 서버 통신 ===== */
  async function j(path, body={}, method='POST'){
    const r = await fetch(`${BASE_API}${path}`, {
      method, headers:{'Content-Type':'application/json'},
      body: method==='GET'? undefined : JSON.stringify(body),
      mode:'cors', cache:'no-store'
    });
    const d = await r.json().catch(()=> ({}));
    if(!r.ok) throw d;
    return d;
  }

  async function loadUser(){
    if(!kakaoId || !nickname) return;
    try{
      const data = await j('/api/userdata', { kakaoId });
      const u = data?.user || data?.data?.user || {};
      S.online=true; dom.netDot.classList.add('ok'); dom.netTxt.textContent='온라인';
      dom.nick.textContent = nickname;

      // 인벤토리 매핑
      S.orcx       = (u.wallet?.orcx ?? u.orcx ?? S.orcx)|0;
      S.water      = (u.inventory?.water ?? S.water)|0;
      S.fertilizer = (u.inventory?.fertilizer ?? S.fertilizer)|0;
      S.corn       = (u.agri?.corn ?? S.corn)|0;
      S.popcorn    = (u.food?.popcorn ?? S.popcorn)|0;
      S.salt       = (u.additives?.salt ?? S.salt)|0;
      S.sugar      = (u.additives?.sugar ?? S.sugar)|0;

      S.level = Math.max(1, Number(u.level ?? u.profile?.level ?? S.level || 1));
      S.exp   = Math.max(0, Number(u.profile?.exp ?? S.exp || 0));
      S.phase = (u.agri?.phase || S.phase || 'IDLE');
      S.g     = Number.isFinite(u.agri?.g) ? u.agri.g : (S.g||0);

      if(u.agri?.gradeInv) S.gradeInv = Object.assign({A:0,B:0,C:0,D:0,E:0,F:0}, u.agri.gradeInv);

      renderAll(); save();
    }catch(e){
      S.online=false; dom.netDot.classList.remove('ok'); dom.netTxt.textContent='오프라인/연결 실패';
      renderAll();
    }
  }

  /* ===== 액션 ===== */
  async function plant(){
    if(!kakaoId || !nickname) return;
    try{
      await j('/api/corn/plant', { kakaoId });
      S.phase='GROW'; S.g=0; gainExp(8);
      await loadUser(); toast('씨앗 심었습니다');
    }catch(e){
      S.phase='GROW'; S.g=0; gainExp(8); renderAll(); save(); toast('씨앗(로컬)');
    }
  }

  async function useResource(kind){
    if(!kakaoId || !nickname) return;
    const field = kind==='water' ? 'water' : 'fertilizer';
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

  function gradeFromStreak(days){ if(days>=5)return'A'; if(days===4)return'B'; if(days===3)return'C'; if(days===2)return'D'; if(days===1)return'E'; return'F'; }
  let localStreak = 0;

  async function harvest(){
    if(!kakaoId || !nickname) return;
    if(!(S.phase==='GROW' && S.g>=100)){ toast('아직 수확 단계 아님'); return; }
    localStreak++; const grade = gradeFromStreak(localStreak);
    try{
      await j('/api/corn/harvest', { kakaoId, grade });
      S.phase='STUBBLE'; S.g=0; gainExp(12);
      await loadUser(); toast(`수확 완료 · 등급 ${grade}`);
    }catch(e){
      const gain = 5 + Math.floor(Math.random()*3);
      S.corn += gain; S.phase='STUBBLE'; S.g=0; gainExp(12);
      S.gradeInv[grade] = (S.gradeInv[grade]|0) + gain;
      renderAll(); save(); toast(`수확(로컬) · ${grade}`);
    }
  }

  function popcornChance(grade){ return ({A:.9,B:.75,C:.6,D:.4,E:.2,F:.1})[grade] ?? .5; }

  async function pop(){
    if(!kakaoId || !nickname) return;
    if(S.corn<1){ toast('옥수수 없음'); return; }
    if(S.salt<1 || S.sugar<1){ toast('소금/설탕 1:1 필요'); return; }
    if(S.orcx<30){ toast('토큰 30 필요'); return; }
    const lastGrade = (['A','B','C','D','E','F'].find(g=> (S.gradeInv[g]|0)>0) || 'C');
    try{
      await j('/api/corn/pop', { kakaoId, use:{salt:1,sugar:1}, tokenCost:30, grade:lastGrade });
      await loadUser(); gainExp(2); toast('뻥튀기 처리');
    }catch(e){
      S.corn--; S.salt--; S.sugar--; S.orcx-=30;
      if(Math.random() < popcornChance(lastGrade)){ S.popcorn++; toast('🍿 +1'); }
      else{ const drop=[1,2,3,5][Math.floor(Math.random()*4)]; S.orcx+=drop; toast(`🪙 +${drop}`); }
      gainExp(2); renderAll(); save();
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

  /* ===== 성장/레벨/렌더 ===== */
  function gainGrowth(d){ S.g=Math.max(0,Math.min(100,(S.g||0)+d)); }
  function gainExp(n){
    S.exp=(S.exp||0)+n;
    while(S.exp>=100){
      S.exp-=100; S.level=(S.level||1)+1;
      try{ j('/api/user/exp',{kakaoId,expGain:n,level:S.level}); }catch(_){}
      toast(`Level Up! Lv.${S.level}`);
    }
    renderLevel(); save();
  }

  function levelIconPath(lv){ const n=Math.max(1,Math.min(10,Math.floor(lv||1))); return IMG_BASE + `mark_${String(n).padStart(2,'0')}.png`; }
  function renderLevel(){
    dom.levelIconMini.src = levelIconPath(S.level);
    dom.levelText.textContent = `Lv.${S.level}`;
    dom.expBar.style.width = `${Math.max(0,Math.min(99,S.exp))}%`;
  }

  // 배경은 성장도에 따라 선택
  function pickBgFile(){
    const g=S.g|0;
    if(g<=29) return 'farm_05.png';
    if(g<=59) return 'farm_07.png';
    if(g<=79) return 'farm_09.png';
    if(g<=94) return 'farm_10.png';
    return 'farm_12.png';
  }
  function applyBg(){
    const file = pickBgFile();
    dom.bg.style.backgroundImage = `url('${img(file)}')`;
  }

  function pickMini(){
    const g=S.g|0;
    if(g<20) return {file:'corn_06_02.png', cap:'발아'};
    if(g<40) return {file:'corn_04_02.png', cap:'유묘'};
    if(g<60) return {file:'corn_02_02.png', cap:'생장'};
    if(g<80) return {file:'corn_03_01.png', cap:'성숙 전'};
    if(g<95) return {file:'corn_03_03.png', cap:'이삭'};
    return {file:'corn_01_01.png', cap:'수확 직전'};
  }
  function renderMini(){
    const m=pickMini();
    dom.miniImg.src = img(m.file);
    dom.miniImg.alt = m.cap;
    dom.miniCap.textContent = m.cap;
  }

  function renderRes(){
    dom.r.water.textContent=S.water|0;
    dom.r.fert .textContent=S.fertilizer|0;
    dom.r.corn .textContent=S.corn|0;
    dom.r.pop  .textContent=S.popcorn|0;
    dom.r.salt .textContent=S.salt|0;
    dom.r.sugar.textContent=S.sugar|0;
    dom.r.orcx .textContent=S.orcx|0;

    dom.btnHarv.disabled = !(S.phase==='GROW' && S.g>=100);
    dom.btnPop .disabled = !(S.corn>=1 && S.salt>=1 && S.sugar>=1 && S.orcx>=30);
  }

  function renderGauge(){
    const p = Math.max(0,Math.min(100,S.g|0));
    dom.gfill.style.setProperty('--p', p+'%');
    dom.gnum.textContent = p;
  }

  function renderAll(){ renderLevel(); renderGauge(); applyBg(); renderMini(); renderRes(); }

  /* ===== 바인딩/부팅 ===== */
  function bind(){
    dom.btnPlant.onclick=plant;
    dom.btnWater.onclick=()=>useResource('water');
    dom.btnFert .onclick=()=>useResource('fertilizer');
    dom.btnHarv .onclick=harvest;
    dom.btnPop  .onclick=pop;
    dom.btnEx   .onclick=exchangePopToFert;
    window.addEventListener('resize', ()=>{ applyBg(); renderMini(); });
  }

  (async function boot(){
    renderAll(); bind(); await loadUser();
  })();

})();
