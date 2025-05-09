document.getElementById("applyForm").addEventListener("submit", async function (e) {
  e.preventDefault();
  const formData = new FormData(this);

  try {
    const res = await fetch("https://orcax-franchise-backend.onrender.com/apply", {
      method: "POST",
      body: formData
    });

    const result = await res.json();

    if (res.ok) {
      // ✅ 여기서 thankyou.html로 이동해야 함!
      window.location.href = "thankyou.html";
    } else {
      document.getElementById("result").textContent = "❌ 오류: " + result.message;
    }
  } catch (err) {
    document.getElementById("result").textContent = "❌ 오류: " + err.message;
  }
});
