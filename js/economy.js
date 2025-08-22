// js/economy.js
import { apiPost } from "./api.js";

// 팝콘 → 물 교환
document.getElementById("popcornWaterForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const amount = parseInt(document.getElementById("popcornWaterAmount").value, 10);
  try {
    const result = await apiPost("/api/exchange/popcorn-water", { amount });
    alert(`교환 성공: ${result.message}`);
  } catch (err) {
    alert("교환 실패: " + err.message);
  }
});

// 팝콘 → NFT 교환
document.getElementById("popcornNftForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const result = await apiPost("/api/exchange/popcorn-nft", { amount: 1000 });
    alert(`NFT 교환 성공: ${result.message}`);
  } catch (err) {
    alert("NFT 교환 실패: " + err.message);
  }
});

// 토큰으로 자원 구매
document.getElementById("buyForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const resource = document.getElementById("buyResource").value;
  const amount = parseInt(document.getElementById("buyAmount").value, 10);

  try {
    const result = await apiPost("/api/exchange/buy", { resource, amount });
    alert(`구매 성공: ${result.message}`);
  } catch (err) {
    alert("구매 실패: " + err.message);
  }
});
