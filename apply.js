document.getElementById("applyForm").addEventListener("submit", async (e) => {
  e.preventDefault(); // 기본 form 제출 막기

  const form = e.target;
  const formData = new FormData(form);

  try {
    const res = await fetch("http://localhost:3030/api/applications", {
      method: "POST",
      body: formData,
    });

    const result = await res.json();
    console.log("✅ 서버 응답:", result);
    document.getElementById("result").textContent = "신청 완료!";
  } catch (err) {
    console.error("❌ 요청 실패:", err);
    document.getElementById("result").textContent = "전송 실패!";
  }
});
