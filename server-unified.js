// 📦 Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const port = 3060;

// 🌱 Middleware
app.use(cors());
app.use(bodyParser.json());

// 🌐 MongoDB 연결
mongoose.connect(process.env.MONGODB_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log("✅ MongoDB 연결 성공"))
  .catch((err) => console.error("❌ MongoDB 연결 실패:", err));

// 📦 외부 라우터 연결
const initUserRouter = require('./routes/init-user');
const userDataRouter = require('./routes/userdata');
const marketRouter = require('./routes/market');
const shopRouter = require('./routes/shop');
const loginRouter = require('./routes/login');
const adminSeedRouter = require('./routes/seed-admin'); // ✅ 관리자용 씨앗 관리 라우터

app.use('/api/init-user', initUserRouter);
app.use('/api/userdata', userDataRouter);
app.use('/market', marketRouter);
app.use('/shop', shopRouter);
app.use('/api/login', loginRouter);
app.use('/api/seed/admin', adminSeedRouter); // ✅ 연결 완료

// ✅ /users/me 라우터
const usersRouter = express.Router();
const User = require('./models/User');

usersRouter.get('/me', async (req, res) => {
  const { kakaoId } = req.query;
  if (!kakaoId) return res.status(400).json({ error: 'kakaoId 쿼리 필요' });

  try {
    const user = await User.findOne({ kakaoId });
    if (!user) return res.status(404).json({ error: '유저 없음' });
    const { nickname, power, seed, token } = user;
    res.json({ nickname, power, seed, token });
  } catch (err) {
    console.error('/users/me error:', err);
    res.status(500).json({ error: '서버 오류' });
  }
});
app.use('/users', usersRouter);

// 🛍️ Market 라우터 직접 구현 (예시)
const mongooseSchema = new mongoose.Schema({ name: String, quantity: Number });
const Market = mongoose.model('Market', mongooseSchema);

const marketRouterInline = express.Router();
marketRouterInline.get('/', async (req, res) => {
  try {
    const marketItems = await Market.find({});
    res.json(marketItems);
  } catch (error) {
    console.error('❌ /market GET 실패:', error);
    res.status(500).json({ error: '시장 정보 불러오기 실패' });
  }
});
app.use('/market', marketRouterInline);

// 🌱 Seed 관련 모델 및 라우터
const SeedInventory = require('./models/SeedInventory');
const seedRouterInline = express.Router();

// ✅ 씨앗 상태 조회 + 자동 생성/보정
seedRouterInline.get('/status', async (req, res) => {
  try {
    let seedData = await SeedInventory.findOne({ _id: 'singleton' });

    if (!seedData) {
      seedData = await SeedInventory.create({
        _id: 'singleton',
        seedPotato: { quantity: 100, price: 2 },
        seedBarley: { quantity: 100, price: 2 },
      });
    } else {
      let changed = false;
      if (!seedData.seedPotato) {
        seedData.seedPotato = { quantity: 100, price: 2 };
        changed = true;
      }
      if (!seedData.seedBarley) {
        seedData.seedBarley = { quantity: 100, price: 2 };
        changed = true;
      }
      if (changed) await seedData.save();
    }

    res.status(200).json(seedData);
  } catch (err) {
    console.error('/seed/status error:', err);
    res.status(500).json({ error: '씨앗 정보 불러오기 실패' });
  }
});

// ✅ 씨앗 구매 라우트 (토큰 차감 포함)
seedRouterInline.post('/purchase', async (req, res) => {
  const { kakaoId, type, quantity } = req.body;
  if (!['seedPotato', 'seedBarley'].includes(type)) {
    return res.status(400).json({ error: '잘못된 씨앗 타입' });
  }

  try {
    const seedData = await SeedInventory.findOne({ _id: 'singleton' });
    if (!seedData || seedData[type].quantity < quantity) {
      return res.status(400).json({ error: '재고 부족' });
    }

    const user = await User.findOne({ kakaoId });
    if (!user) return res.status(404).json({ error: '유저 없음' });

    const totalCost = seedData[type].price * quantity;
    if (user.orcx < totalCost) {
      return res.status(400).json({ error: '토큰 부족' });
    }

    // 차감 처리
    user.orcx -= totalCost;
    seedData[type].quantity -= quantity;
    await user.save();
    await seedData.save();

    res.status(200).json({
      success: true,
      remaining: seedData[type].quantity,
      price: seedData[type].price,
      message: `${type} 구매 완료`
    });
  } catch (err) {
    console.error('/seed/purchase error:', err);
    res.status(500).json({ error: '씨앗 구매 실패' });
  }
});

// ✅ 로그아웃 시 유저 씨앗 보관소 환원
seedRouterInline.post('/return-seeds', async (req, res) => {
  const { seedPotato, seedBarley } = req.body;
  try {
    const seedData = await SeedInventory.findOne({ _id: 'singleton' });
    if (!seedData) {
      return res.status(404).json({ error: '보관소 정보 없음' });
    }
    if (seedPotato) seedData.seedPotato.quantity += seedPotato;
    if (seedBarley) seedData.seedBarley.quantity += seedBarley;
    await seedData.save();
    res.status(200).json({ success: true, message: '씨앗 반환 완료' });
  } catch (err) {
    console.error('/seed/return-seeds error:', err);
    res.status(500).json({ error: '씨앗 반환 실패' });
  }
});

// ✅ /seed/restore 라우트 - 씨앗 복구 (로그아웃 등에서 사용)
seedRouterInline.post('/restore', async (req, res) => {
  const { seedPotato, seedBarley } = req.body;
  try {
    const seedData = await SeedInventory.findOne({ _id: 'singleton' });
    if (!seedData) return res.status(404).json({ error: '보관소 없음' });

    if (seedPotato) seedData.seedPotato.quantity += seedPotato;
    if (seedBarley) seedData.seedBarley.quantity += seedBarley;

    await seedData.save();
    res.status(200).json({ success: true, message: '씨앗 복구 완료' });
  } catch (err) {
    console.error('/seed/restore error:', err);
    res.status(500).json({ error: '복구 실패' });
  }
});

app.use('/seed', seedRouterInline);

// 🟢 기본 루트
app.get('/', (req, res) => {
  res.send('🌽 OrcaX 감자 서버가 살아있다');
});

// 🚀 서버 시작
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
