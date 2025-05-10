document.getElementById("applyForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const resultBox = document.getElementById("result");

  try {
    const res = await fetch("https://orcax-franchise-backend.onrender.com/api/applications", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) throw new Error(`서버 응답 실패 (${res.status})`);

    const data = await res.json();
    console.log("✅ 신청 성공:", data);
    resultBox.textContent = "✅ 신청 완료되었습니다!";
    resultBox.style.color = "green";
  } catch (err) {
    console.error("❌ 전송 실패:", err);
    resultBox.textContent = "❌ 전송 실패! 서버 응답 없음 또는 오류.";
  }
});
