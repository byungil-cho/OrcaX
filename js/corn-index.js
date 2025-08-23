function updateUI(data) {
  // 닉네임 (옵션)
  if (data.nickname) {
    const nickEl = document.getElementById("user-nickname");
    if (nickEl) nickEl.innerText = data.nickname;
  }

  // 물 / 거름
  document.getElementById("water").innerText = data.inventory?.water ?? data.water ?? 0;
  document.getElementById("fertilizer").innerText = data.inventory?.fertilizer ?? data.fertilizer ?? 0;

  // 토큰
  document.getElementById("token").innerText = data.wallet?.orcx ?? data.tokens ?? 0;

  // 옥수수 (객체 → 숫자)
  document.getElementById("corn").innerText = data.corn?.count ?? data.agri?.corn ?? 0;

  // 팝콘
  document.getElementById("popcorn").innerText = data.food?.popcorn ?? data.popcorn ?? 0;

  // 첨가물
  document.getElementById("salt").innerText = data.additives?.salt ?? data.salt ?? 0;
  document.getElementById("sugar").innerText = data.additives?.sugar ?? data.sugar ?? 0;
}
