document.getElementById("applyForm").addEventListener("submit", async function (e) {
  e.preventDefault();
  const formData = new FormData(this);

  try {
    const res = await fetch("https://orcax-franchise-backend.onrender.com/apply", {
      method: "POST",
      body: formData
    });

    const result = await res.json();
    document.getElementById("result").textContent = "✅ " + result.message;
  } catch (err) {
    document.getElementById("result").textContent = "❌ 오류: " + err.message;
  }
});


