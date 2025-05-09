document.getElementById("applyForm").addEventListener("submit", async function (e) {
  e.preventDefault(); // 브라우저 기본 전송 막기

  const formData = new FormData(this);

  try {
    const res = await fetch("https://orcax-franchise-backend.onrender.com/apply", {
      method: "POST",
      body: formData
    });

    const result = await res.json();

    if (res.ok) {
      window.location.href = "thankyou.html"; // 성공 시 이동
    } else {
      document.getElementById("result").textContent = "❌ 오류: " + result.message;
    }
  } catch (err) {
    document.getElementById("result").textContent = "❌ 네트워크 오류: " + err.message;
  }
});

