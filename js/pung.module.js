// pung.module.js (ES6 module version)

export const Pung = {
  init({ kakaoId, user, corn, apiBase }) {
    console.log('[Pung] 초기화 시작');
    console.log('kakaoId:', kakaoId);
    console.log('user:', user);
    console.log('corn:', corn);
    console.log('apiBase:', apiBase);

    // 자원 상태 보여주기 예시
    if (user?.orcx !== undefined) {
      const statusEl = document.getElementById('orcx');
      if (statusEl) statusEl.textContent = user.orcx;
    }

    // 향후: corn 상태 또는 대출 상태, 등급에 따른 이미지, 색상 변화 적용 가능
    // 필요한 경우 여기에서 서버와 추가 통신하거나 로직 실행 가능
  },

  // 자원 투입 후 뻥튀기 처리
  async pung(userInput, apiBase) {
    try {
      const res = await fetch(`${apiBase}/api/resources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userInput)
      });
      const data = await res.json();
      console.log('뻥튀기 결과:', data);
      return data;
    } catch (err) {
      console.error('뻥튀기 오류:', err);
      throw err;
    }
  }
};
