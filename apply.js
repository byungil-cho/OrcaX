document.getElementById("applyForm").addEventListener("submit", async function (e) {
  e.preventDefault();

  const form = e.target;
  const formData = new FormData(form);

  const resultDiv = document.getElementById("result");
  resultDiv.innerText = "🚀 전송 중...";

  try {
    const res = await fetch("https://orcax-franchise-backend.onrender.com/api/applications", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      throw new Error("서버 응답 오류 (" + res.status + ")");
    }

    const data = await res.json();
    resultDiv.innerHTML = "✅ 전송 성공: " + data.message;
  } catch (err) {
    console.error("❌ 전송 실패:", err);
    resultDiv.innerHTML = "❌ 전송 실패! " + err.message;
  }
});

