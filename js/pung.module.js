// pung.module.js (ES6 모듈 + 프론트 뻥튀기 로직 포함)

export const Pung = {
  init({ kakaoId, user, corn, apiBase }) {
    console.log('[Pung] 초기화');
    console.log('사용자:', kakaoId, user);
    // UI 반영 예시
    if (user?.orcx !== undefined) {
      const el = document.getElementById('orcx');
      if (el) el.textContent = user.orcx;
    }
  },

  pung({ kakaoId, water = 0, salt = 0, sugar = 0, grade = "A", loan = false }) {
    const result = [];
    const GRADE_TABLE = {
      A: [1000, 900, 800],
      B: [800, 700, 600],
      C: [600, 500, 400],
      D: [400, 300, 200],
      E: [200, 100, 50],
      F: [100, 50, 10]
    };

    const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

    // 5~9개 수확
    const count = Math.floor(Math.random() * 5) + 5;
    for (let i = 0; i < count; i++) {
      const isPopcorn = Math.random() < 0.1; // 10% 확률 꽝
      if (isPopcorn) {
        result.push({ type: "팝콘", value: 0 });
      } else {
        const value = pickRandom(GRADE_TABLE[grade] || [0]);
        result.push({ type: grade, value });
      }
    }

    const gross = result.reduce((sum, r) => sum + r.value, 0);
    const net = loan ? Math.floor(gross * 0.7) : gross;

    return {
      grade,
      count,
      tokens: result,
      totalBeforeTax: gross,
      totalAfterTax: net,
      loan
    };
  }
};
