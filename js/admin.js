// js/admin.js
import { apiGet, apiPost } from "./api.js";

document.addEventListener("DOMContentLoaded", () => {
  loadWithdrawals();

  document.getElementById("tab-withdraw").addEventListener("click", loadWithdrawals);
  document.getElementById("tab-deposit").addEventListener("click", loadDeposits);
  document.getElementById("tab-loan").addEventListener("click", loadLoans);
});

async function loadWithdrawals() {
  const data = await apiGet("/api/admin/withdrawals");
  renderTable("출금 요청", data, ["nickname", "amount", "wallet"]);
}

async function loadDeposits() {
  const data = await apiGet("/api/admin/deposits");
  renderTable("입금 요청", data, ["nickname", "amount", "txHash"]);
}

async function loadLoans() {
  const data = await apiGet("/api/admin/loans");
  renderTable("대출 현황", data, ["nickname", "amount", "interest"]);
}

function renderTable(title, rows, keys) {
  const container = document.getElementById("admin-content");
  let html = `<h3>${title}</h3><table><thead><tr>`;
  keys.forEach(k => { html += `<th>${k}</th>`; });
  html += "</tr></thead><tbody>";
  rows.forEach(r => {
    html += "<tr>";
    keys.forEach(k => { html += `<td>${r[k]}</td>`; });
    html += "</tr>";
  });
  html += "</tbody></table>";
  container.innerHTML = html;
}
