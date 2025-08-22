// js/popup.js
import { apiPost, apiGet } from "./api.js";

document.addEventListener("DOMContentLoaded", async () => {
  let nickname = "-";
  try {
    const user = await apiGet("/api/user");
    nickname = user.nickname;
  } catch {
    console.warn("닉네임 불러오기 실패");
  }
  document.getElementById("nickname").innerText = nickname;

  async function puffCorn() {
    try {
      const result = await apiPost("/api/corn/puff", {});
      document.getElementById("resultBox").innerText = result.message;
    } catch (err) {
      document.getElementById("resultBox").innerText = "❌ 오류 발생";
    }
  }

  puffCorn();
  document.getElementById("retryBtn").addEventListener("click", puffCorn);
});
