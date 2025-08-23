// js/corn-index.js
// 옥수수 농장 입구 화면 제어 스크립트

import { apiGet } from "./api.js";

document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 요약 데이터 불러오기
    const summary = await apiGet("/api/corn/summary");
    updateUI(summary);
  } catch (err) {
    console.error("Error loading summary:", err);
    alert("옥수수 농장 데이터를 불러오지 못했습니다.");
  }

  // 농장 입장 클릭 이벤트
  const farmImage = document.getElementById("farm-entry");
  if (farmImage) {
    farmImage.addEventListener("click", () => {
      window.location.href = "corn-farm.html";
    });
  }
});

/**
 * 유저 요약 정보를 UI에 표시
 */
function updateUI(data) {
  // 물 / 거름
  document.getElementById("water").innerText = data.inventory?.water ?? data.water ?? 0;
  document.getElementById("fertilizer").innerText = data.inventory?.fertilizer ?? data.fertilizer ?? 0;

  // 토큰
  document.getElementById("token").innerText = data.wallet?.orcx ?? data.tokens ?? 0;

   // 팝콘
  document.getElementById("popcorn").innerText = data.food?.popcorn ?? data.popcorn ?? 0;

  // 첨가물
  document.getElementById("salt").innerText = data.additives?.salt ?? data.salt ?? 0;
  document.getElementById("sugar").innerText = data.additives?.sugar ?? data.sugar ?? 0;
}
