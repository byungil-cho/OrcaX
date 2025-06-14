// 공통 닉네임 불러오기
function getNickname() {
  return localStorage.getItem('nickname');
}

// 서버에서 유저 제품 정보 가져오기
async function fetchUserData() {
  const nickname = getNickname();
  if (!nickname) return null;

  try {
    const response = await fetch(`https://climbing-wholly-grouper.jp.ngrok.io/api/products/${nickname}`);
    const data = await response.json();
    console.log("📦 현재 보관소", data.inventory);
    return data;
  } catch (error) {
    console.error("❌ fetchUserData 오류:", error);
    return null;
  }
}

// 보관소 UI 업데이트
function updateDisplay(inventory = []) {
  const inventoryBox = document.getElementById("inventoryBox");
  if (!inventoryBox) return;

  inventoryBox.innerHTML = "";
  inventory.forEach((item) => {
    const div = document.createElement("div");
    div.className = "product-item";
    div.textContent = `🛒 ${item.name} × ${item.count}`;
    inventoryBox.appendChild(div);
  });
}

// 저장 함수 (사용 시 선택)
async function saveUserData(data) {
  try {
    const response = await fetch("https://climbing-wholly-grouper.jp.ngrok.io/api/products/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    const result = await response.json();
    console.log("✅ 저장 결과:", result);
  } catch (error) {
    console.error("❌ 저장 오류:", error);
  }
}

// 초기 로딩
window.addEventListener("DOMContentLoaded", async () => {
  const userData = await fetchUserData();
  if (userData && userData.inventory) {
    updateDisplay(userData.inventory);
  } else {
    console.warn("⚠️ 유저 데이터 없음");
  }
});
