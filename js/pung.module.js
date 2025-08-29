// pung.module.js
// OrcaX 뻥튀기 엔진 모듈 (기능 완전 확장 버전)

(function (global) {
  const CFG = {
    gradeTable: {
      A: [1000, 900, 800, 0],
      B: [800, 700, 600, 0],
      C: [600, 500, 400, 0],
      D: [400, 300, 200, 0],
      E: [200, 100, 50, 0],
      F: [100, 50, 10, 0],
    },
    aCombo: {
      5: { 1000: 2, 900: 1, 800: 1, 0: 1 },
      7: { 1000: 1, 900: 2, 800: 3, 0: 1 },
      9: { 1000: 1, 900: 3, 800: 3, 0: 2 },
    },
    saveEndpoints: [
      ['/api/corn/update', 'POST'],
      ['/api/corn/userdata', 'POST'],
      ['/api/corn/by-kakao', 'PUT'],
    ],
  };

  const S = {
    apiBase: '',
    kakaoId: '',
    serverOk: false,
    view: null,
    earnedSession: 0,
  };

  const utils = {
    rnd: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
    shuffle: arr => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },
    normalize(user, corn) {
      return {
        nickname: user.nickname || '-',
        grade: (corn.grade || 'A').toUpperCase(),
        cornColor: (corn.cornColor || 'yellow').toLowerCase(),
        wallet: { orcx: +user.orcx || 0 },
        inventory: {
          salt: +corn.salt || 0,
          sugar: +corn.sugar || 0,
          corn: +corn.corn || 0,
        },
        products: {
          popcorn: +corn.popcorn || 0,
        }
      }
    },
    canTimes(view) {
      const { salt, sugar, corn } = view.inventory;
      const maxByORCX = Math.floor(view.wallet.orcx / 30);
      return Math.max(0, Math.min(salt, sugar, corn, maxByORCX));
    },
    getRewards(grade, count) {
      if (grade === 'A') {
        const combo = CFG.aCombo[count];
        let flat = [];
        for (let [val, times] of Object.entries(combo)) {
          for (let i = 0; i < times; i++) flat.push(+val);
        }
        return utils.shuffle(flat);
      } else {
        const table = CFG.gradeTable[grade] || CFG.gradeTable.A;
        const weight = [1, 2, 3, 1];
        const rewards = [];
        for (let i = 0; i < count; i++) {
          let r = Math.random() * 7;
          for (let j = 0; j < 4; j++) {
            r -= weight[j];
            if (r < 0) {
              rewards.push(table[j]);
              break;
            }
          }
        }
        return rewards;
      }
    },
    applyReward(view, amount) {
      const isLoaned = view.cornColor === 'red' || view.cornColor === 'black';
      const real = amount > 0 ? (isLoaned ? Math.floor(amount * 0.7) : amount) : 0;
      if (real > 0) view.wallet.orcx += real;
      else view.products.popcorn++;
      return real;
    },
    consume(view) {
      view.inventory.salt--;
      view.inventory.sugar--;
      view.inventory.corn--;
      view.wallet.orcx -= 30;
    }
  };

  const Pung = {
    async init({ kakaoId, user, corn, apiBase = location.origin }) {
      S.apiBase = apiBase;
      S.kakaoId = kakaoId;
      S.view = utils.normalize(user, corn);
      S.earnedSession = 0;
      return { user: S.view };
    },

    state() {
      return JSON.parse(JSON.stringify(S.view));
    },

    canTimes() {
      return utils.canTimes(S.view);
    },

    async popAll({ onEach, onDone, delayMs = 200 } = {}) {
      const count = this.canTimes();
      if (count <= 0) return onDone?.({ total: 0 });

      const rewardList = utils.getRewards(S.view.grade, count);
      let total = 0;

      for (let i = 0; i < count; i++) {
        utils.consume(S.view);
        const reward = utils.applyReward(S.view, rewardList[i]);
        total += reward;
        onEach?.({ token: reward, index: i + 1 });
        if (delayMs) await new Promise(r => setTimeout(r, delayMs));
      }

      S.earnedSession += total;
      onDone?.({ total });
    },

    async sync() {
      const payload = {
        kakaoId: S.kakaoId,
        nickname: S.view.nickname,
        wallet: S.view.wallet,
        corn_data: {
          ...S.view.inventory,
          popcorn: S.view.products.popcorn,
          cornColor: S.view.cornColor,
          grade: S.view.grade,
        }
      };
      for (const [url, method] of CFG.saveEndpoints) {
        try {
          const res = await fetch(S.apiBase + url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          if (res.ok) return true;
        } catch (_) { }
      }
      return false;
    }
  };

  global.Pung = Pung;
})(window);
