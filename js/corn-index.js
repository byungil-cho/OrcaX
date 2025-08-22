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
  document.getElementById("user-nickname").innerText = data.nickname;
  document.getElementById("water-count").innerText = data.water;
  document.getElementById("fertilizer-count").innerText = data.fertilizer;
  document.getElementById("token-count").innerText = data.tokens;
  document.getElementById("corn-count").innerText = data.corn;
  document.getElementById("popcorn-count").innerText = data.popcorn;
  document.getElementById("salt-count").innerText = data.salt;
  document.getElementById("sugar-count").innerText = data.sugar;
}
