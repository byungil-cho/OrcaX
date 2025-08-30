// admin.js (ES6 모듈)

document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  loadAllData();
  checkServerStatus();
});

function initTabs() {
  const tabs = ["withdraw", "deposit", "loan-request", "loan"];
  tabs.forEach(tab => {
    const link = document.getElementById(`tab-${tab}`);
    const content = document.getElementById(`content-${tab}`);

    link.addEventListener("click", () => {
      document.querySelectorAll(".tab-content").forEach(div => div.hidden = true);
      content.hidden = false;
    });
  });
}

async function loadAllData() {
  await loadWithdraws();
  await loadDeposits();
  await loadLoanRequests();
  await loadLoanStatus();
}

async function loadWithdraws() {
  const res = await fetch("/api/get-withdraws");
  const list = await res.json();
  const tbody = document.getElementById("withdraw-list");
  tbody.innerHTML = "";
  list.forEach(row => {
    const tr = document.createElement("tr");
    const minCheck = row.amount >= 50000;
    tr.innerHTML = `
      <td>${row.nickname}</td>
      <td>${row.amount}</td>
      <td>${row.date}</td>
      <td>
        ${minCheck ? `<button onclick="approveWithdraw('${row.id}')">승인</button>` : "<span style='color:red'>금액 부족</span>"}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function loadDeposits() {
  const res = await fetch("/api/get-deposits");
  const list = await res.json();
  const tbody = document.getElementById("deposit-list");
  tbody.innerHTML = "";
  list.forEach(row => {
    const tr = document.createElement("tr");
    const minCheck = row.amount >= 50000;
    tr.innerHTML = `
      <td>${row.nickname}</td>
      <td>${row.amount}</td>
      <td>${row.date}</td>
      <td>
        ${minCheck ? `<button onclick="confirmDeposit('${row.id}')">확인</button>` : "<span style='color:red'>금액 부족</span>"}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function loadLoanRequests() {
  const res = await fetch("/api/get-loan-requests");
  const list = await res.json();
  const tbody = document.getElementById("loan-request-list");
  tbody.innerHTML = "";
  list.forEach(row => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.nickname}</td>
      <td>${row.amount}</td>
      <td>${row.date}</td>
      <td>
        <button onclick="approveLoan('${row.id}')">승인</button>
        <button onclick="rejectLoan('${row.id}')">거절</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function loadLoanStatus() {
  const res = await fetch("/api/get-loan-status");
  const list = await res.json();
  const tbody = document.getElementById("loan-status-list");
  tbody.innerHTML = "";
  list.forEach(row => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.nickname}</td>
      <td>${row.amount}</td>
      <td>${row.interest}%</td>
      <td>${row.remaining}</td>
      <td>${row.status}</td>
    `;
    tbody.appendChild(tr);
  });
}

// 처리 액션 함수
async function approveWithdraw(id) {
  await fetch(`/api/approve-withdraw/${id}`, { method: "POST" });
  loadWithdraws();
}

async function confirmDeposit(id) {
  await fetch(`/api/confirm-deposit/${id}`, { method: "POST" });
  loadDeposits();
}

async function approveLoan(id) {
  await fetch(`/api/approve-loan/${id}`, { method: "POST" });
  loadLoanRequests();
  loadLoanStatus();
}

async function rejectLoan(id) {
  await fetch(`/api/reject-loan/${id}`, { method: "POST" });
  loadLoanRequests();
}

async function checkServerStatus() {
  try {
    const res = await fetch("/api/ping");
    if (res.ok) {
      const el = document.createElement("div");
      el.textContent = "🟢 서버 연결됨";
      el.style.color = "green";
      el.style.fontSize = "0.9rem";
      document.querySelector("main").prepend(el);
    } else {
      showServerDown();
    }
  } catch (err) {
    showServerDown();
  }
}

function showServerDown() {
  const el = document.createElement("div");
  el.textContent = "🔴 서버 연결 실패";
  el.style.color = "red";
  el.style.fontSize = "0.9rem";
  document.querySelector("main").prepend(el);
}