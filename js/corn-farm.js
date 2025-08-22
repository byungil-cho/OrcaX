// corn-farm.js
const farmBackground = document.getElementById("farmBackground");
const cornStageImg = document.getElementById("cornStage");
const statusText = document.getElementById("status-text");
const progressBar = document.getElementById("progress-bar");
const cornIcon = document.getElementById("corn-icon");
const nicknameEl = document.getElementById("nickname");

// 닉네임 (카카오 로그인 기반)
const nickname = localStorage.getItem("nickname") || "로그인 필요";
nicknameEl.textContent = nickname;

// 농장 상태
let farm = {
  planted: false,
  growth: 0,
  days: 0,
  seedColor: localStorage.getItem("seedColor") || "yellow"
};

// 배경 매핑 (farm_XX.png)
const farmStages = {
  0: "img/farm_00.png", // 입구/휴농
  1: "img/farm_03.png", // 1일차
  2: "img/farm_05.png", // 2일차
  3: "img/farm_07.png", // 3일차
  4: "img/farm_09.png", // 4일차
  5: "img/farm_10.png", // 5일차
  fail: "img/farm_12.png" // 폐농
};

// 옥수수 성장 이미지 (a_corn_xx_xx.png)
function getCornStage(days, growth) {
  if (!farm.planted) return "img/a_corn_06_01.png"; // 씨앗 전
  if (growth < 20) return "img/a_corn_06_01.png"; // 씨앗
  if (growth < 40) return "img/a_corn_06_03.png"; // 새싹
  if (growth < 60) return "img/a_corn_06_05.png"; // 중간 성장
  if (growth < 80) return "img/a_corn_06_07.png"; // 거의 다 자람
  return "img/a_corn_06_09.png"; // 수확 직전
}

// UI 업데이트
function updateUI() {
  progressBar.style.width = `${farm.growth}%`;
  cornStageImg.src = getCornStage(farm.days, farm.growth);

  if (!farm.planted) {
    statusText.textContent = "아직 씨앗을 심지 않았습니다.";
    farmBackground.style.backgroundImage = `url(${farmStages[0]})`;
  } else if (farm.growth < 100) {
    statusText.textContent = `성장 중... (${farm.growth}% 진행됨, ${farm.days}일 경과)`;
    farmBackground.style.backgroundImage = `url(${farmStages[farm.days] || farmStages[fail]})`;
  } else {
    statusText.textContent = `수확 가능! (${farm.days}일 농사)`;
    farmBackground.style.backgroundImage = `url(${farmStages[farm.days] || farmStages[5]})`;
  }

  // 씨앗 색상 반영
  const seedIcons = {
    yellow: "img/corn-yellow.png",
    red: "img/corn-red.png",
    black: "img/corn-black.png"
  };
  cornIcon.src = seedIcons[farm.seedColor];
}

// 이벤트: 씨앗 심기
document.getElementById("btn-plant").onclick = () => {
  farm.planted = true;
  farm.growth = 0;
  farm.days = 0;
  farm.seedColor = "yellow"; // 기본 자기자본
  localStorage.setItem("seedColor", farm.seedColor);
  updateUI();
};

// 이벤트: 물 주기
document.getElementById("btn-water").onclick = () => {
  if (!farm.planted) return alert("먼저 씨앗을 심으세요!");
  farm.growth = Math.min(100, farm.growth + 10);
  farm.days++;
  updateUI();
};

// 이벤트: 거름 주기
document.getElementById("btn-fertilize").onclick = () => {
  if (!farm.planted) return alert("먼저 씨앗을 심으세요!");
  farm.growth = Math.min(100, farm.growth + 15);
  farm.days++;
  updateUI();
};

// 이벤트: 수확
document.getElementById("btn-harvest").onclick = () => {
  if (farm.growth < 100) return alert("아직 다 자라지 않았습니다!");

  let grade = "F";
  if (farm.days === 5) grade = "A";
  else if (farm.days === 6) grade = "B";
  else if (farm.days === 7) grade = "C";
  else if (farm.days === 8) grade = "D";
  else if (farm.days === 9) grade = "E";

  alert(`${grade} 등급 옥수수를 수확했습니다!`);

  farm = { planted: false, growth: 0, days: 0, seedColor: farm.seedColor };
  updateUI();
};

// 이벤트: 팝콘 튀기기
document.getElementById("btn-popcorn").onclick = () => {
  alert("옥수수를 팝콘으로 튀겼습니다!");
};

updateUI();
