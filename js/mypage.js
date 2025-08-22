// js/mypage.js
import { apiGet, apiPost } from "./api.js";

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const user = await apiGet("/api/user");
    document.getElementById("nickname").innerText = user.nickname;
    document.getElementById("token-balance").innerText = user.tokens;
  } catch {
    alert("유저 정보를 불러올 수 없습니다.");
  }

  document.getElementById("withdrawForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const wallet = document.getElementById("wallet").value;
    const amount = parseInt(document.getElementById("withdrawAmount").value, 10);
    await apiPost("/api/withdraw", { wallet, amount });
    alert("출금 요청이 접수되었습니다.");
  });

  document.getElementById("depositForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const txHash = document.getElementById("txHash").value;
    const amount = parseInt(document.getElementById("depositAmount").value, 10);
    await apiPost("/api/deposit", { txHash, amount });
    alert("입금 요청이 접수되었습니다.");
  });

  document.getElementById("loanForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const amount = parseInt(document.getElementById("loanAmount").value, 10);
    await apiPost("/api/loan", { amount });
    alert("대출 신청이 완료되었습니다.");
  });
});
