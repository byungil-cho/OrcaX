import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// --- In-memory store ---
const users = new Map(); // kakaoId -> user object
const CONFIG = {
  A: { tokenRate: 0.9, tokenTable: [1000,900,800] },
  B: { tokenRate: 0.7, tokenTable: [800,700,600] },
  C: { tokenRate: 0.6, tokenTable: [600,500,400] },
  D: { tokenRate: 0.5, tokenTable: [400,300,200] },
  E: { tokenRate: 0.4, tokenTable: [200,100,50]  },
  F: { tokenRate: 0.3, tokenTable: [100,50,10]   },
};
const PRESET = { 9:[1,3,4,1], 7:[1,3,2,1], 5:[2,1,1,1] }; // [hi, mid, low, pop]

function getUser(kakaoId){
  if (!users.has(kakaoId)){
    users.set(kakaoId, {
      kakaoId,
      token: 100, // some starting token
      water: 5,
      fertilizer: 3,
      corn: { plantedAt: null, lastHarvest: null, lastPop: null },
      inventory: { seedCorn: 2, popcorn: 1, salt: 3, sugar: 3, additive: 1 },
      cornCount: 0,
    });
  }
  return users.get(kakaoId);
}

// --- API ---
app.post('/api/userdata', (req,res)=>{
  const { kakaoId } = req.body || {};
  if (!kakaoId) return res.status(400).json({ message: 'kakaoId required' });
  const u = getUser(kakaoId);
  res.json(u);
});

app.get('/api/corn/summary', (req,res)=>{
  const { kakaoId } = req.query || {};
  if (!kakaoId) return res.status(400).json({ message:'kakaoId required' });
  const u = getUser(kakaoId);
  res.json({
    cornCount: u.cornCount,
    inventory: u.inventory,
    token: u.token,
    water: u.water,
    fertilizer: u.fertilizer,
    corn: { plantedAt: u.corn.plantedAt }
  });
});

app.post('/api/corn/plant', (req,res)=>{
  const { kakaoId } = req.body || {};
  const u = getUser(kakaoId);
  if ((u.inventory.seedCorn||0) <= 0) return res.status(400).json({ message:'씨앗이 부족합니다.' });
  if (u.corn.plantedAt) return res.status(400).json({ message:'이미 파종됨' });
  u.inventory.seedCorn -= 1;
  u.corn.plantedAt = new Date().toISOString();
  res.json({ ok:true, plantedAt: u.corn.plantedAt });
});

app.post('/api/corn/water', (req,res)=>{
  const { kakaoId } = req.body || {};
  const u = getUser(kakaoId);
  if ((u.water||0) <= 0) return res.status(400).json({ message:'물 부족' });
  u.water -= 1;
  res.json({ ok:true, waterLeft: u.water });
});

app.post('/api/corn/fertilize', (req,res)=>{
  const { kakaoId } = req.body || {};
  const u = getUser(kakaoId);
  if ((u.fertilizer||0) <= 0) return res.status(400).json({ message:'거름 부족' });
  u.fertilizer -= 1;
  res.json({ ok:true, fertilizerLeft: u.fertilizer });
});

app.post('/api/corn/harvest', (req,res)=>{
  const { kakaoId, gradeHint } = req.body || {};
  const u = getUser(kakaoId);
  if (!u.corn.plantedAt) return res.status(400).json({ message:'파종되지 않음' });
  const qtyList = [9,7,5];
  const qty = qtyList[Math.floor(Math.random()*qtyList.length)];
  const grade = gradeHint || 'F';
  u.corn.plantedAt = null;
  u.cornCount += qty;
  u.corn.lastHarvest = { at: new Date().toISOString(), qty, plantedAt: null, grade };
  res.json({ ok:true, grade, qty, cornGained: qty });
});

function pickWeighted(weights){ const s=weights.reduce((a,b)=>a+b,0); let r=Math.random()*s; for(let i=0;i<weights.length;i++){ r-=weights[i]; if(r<0) return i; } return weights.length-1; }

app.post('/api/corn/pop', (req,res)=>{
  const { kakaoId, tokenCost } = req.body || {};
  const u = getUser(kakaoId);
  if ((u.inventory.popcorn||0) <= 0) return res.status(400).json({ message:'팝콘 부족' });
  if ((u.inventory.salt||0) <= 0) return res.status(400).json({ message:'소금 부족' });
  if ((u.inventory.sugar||0) <= 0) return res.status(400).json({ message:'설탕 부족' });
  if ((u.token||0) < (tokenCost||30)) return res.status(400).json({ message:'토큰 부족' });

  const last = u.corn.lastHarvest || { qty: 5, grade: 'F' };
  const qty = last.qty || 5;
  const grade = last.grade || 'F';

  // consume costs
  u.inventory.popcorn -= 1;
  u.inventory.salt -= 1;
  u.inventory.sugar -= 1;
  u.token -= (tokenCost || 30);

  const cfg = CONFIG[grade] || CONFIG['F'];
  let hi=0, mid=0, low=0, pop=0;
  if (PRESET[qty]) {
    [hi,mid,low,pop] = PRESET[qty];
  } else {
    for (let i=0;i<qty;i++){
      if (Math.random() < cfg.tokenRate){
        const idx = pickWeighted([1,1,1]);
        if (idx===0) hi++; else if (idx===1) mid++; else low++;
      } else pop++;
    }
  }
  const table = cfg.tokenTable;
  const tokenGained = hi*table[0] + mid*table[1] + low*table[2];
  u.token += tokenGained;
  u.inventory.popcorn += pop;

  u.corn.lastPop = {
    at: new Date().toISOString(),
    grade, qty, breakdown: { hi, mid, low, pop }, tokenTable: table, tokenGained
  };

  res.json({
    ok:true, grade, qty, breakdown:{ hi, mid, low, pop }, tokenTable: table,
    tokenGained, tokenTotal: u.token, popcornTotal: u.inventory.popcorn
  });
});

app.post('/api/corn/exchange', (req,res)=>{
  const { kakaoId } = req.body || {};
  const u = getUser(kakaoId);
  if ((u.inventory.popcorn||0) <= 0) return res.status(400).json({ message:'팝콘 부족' });
  u.inventory.popcorn -= 1;
  u.fertilizer += 1;
  res.json({ ok:true, fertilizerLeft: u.fertilizer, popcornLeft: u.inventory.popcorn });
});

// static
app.use('/', express.static('public'));

const PORT = process.env.PORT || 3060;
app.listen(PORT, ()=> console.log('Corn server running on http://localhost:'+PORT));