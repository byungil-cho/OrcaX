document.getElementById("applyForm").addEventListener("submit", async function (e) {
  e.preventDefault();

  const form = e.target;
  const formData = new FormData(form);
  const resultElement = document.getElementById("result");

  try {
    const res = await fetch("https://orcax-franchise-backend.onrender.com/apply", {
      method: "POST",
      body: formData
    });

    const result = await res.json();

    if (res.ok && result.success) {
      resultElement.textContent = "✅ 신청 완료! 범고래 접수 완료!";
      resultElement.style.color = "green";
      form.reset();
    } else {
      resultElement.textContent = "❌ 오류: " + (result.message || "신청 실패");
      resultElement.style.color = "red";
    }
  } catch (error) {
    console.error("❌ 네트워크 오류:", error);
    resultElement.textContent = "❌ 서버에 연결할 수 없습니다.";
    resultElement.style.color = "red";
  }
});
