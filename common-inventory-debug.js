
const API_BASE = "https://climbing-wholly-grouper.jp.ngrok.io";
const nickname = localStorage.getItem("nickname");
const farmName = localStorage.getItem("farmName");

const userData = {
  nickname,
  water: 0,
  fertilizer: 0,
  token: 0,
  potatoCount: 0,
  barleyCount: 0,
  inventory: []
};

async function fetchUserData() {
  try {
    const res = await fetch(`${API_BASE}/api/userdata?nickname=${nickname}`, {
      method: "GET",
      headers: { "Cache-Control": "no-cache" }
    });
    const data = await res.json();

    console.log("📦 받아온 전체 userData:", data);
    console.log("📦 받아온 보관소 (inventory):", data.inventory);
    console.log("📌 inventory 타입:", typeof data.inventory);
    console.log("📏 inventory 길이:", data.inventory?.length);

    userData.potatoCount = data.potatoCount ?? 0;
    userData.water = data.water ?? 0;
    userData.fertilizer = data.fertilizer ?? 0;
    userData.token = data.token ?? 0;
    userData.barleyCount = data.barleyCount ?? 0;
    userData.inventory = data.inventory ?? [];
    updateDisplay();
  } catch (err) {
    console.error("❌ fetchUserData 에러:", err);
  }
}

function updateDisplay() {
  document.getElementById("potatoCount").innerText = userData.potatoCount;
  document.getElementById("waterCount").innerText = userData.water;
  document.getElementById("fertilizerCount").innerText = userData.fertilizer;
  document.getElementById("tokenCount").innerText = userData.token;
  document.getElementById("barleyCount").innerText = userData.barleyCount;

  const list = document.getElementById("inventoryItems");
  if (!list) {
    console.warn("⚠️ inventoryItems 요소가 없습니다.");
    return;
  }

  list.innerHTML = "";
  userData.inventory.forEach((item, idx) => {
    const li = document.createElement("li");
    li.innerHTML = `<input type="checkbox" value="\${idx}"> \${item.type} × \${item.count}`;
    list.appendChild(li);
  });
}

window.addEventListener("DOMContentLoaded", fetchUserData);
