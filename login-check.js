// login-check.js
export function getUserInfoOrRedirect() {
  const nickname = localStorage.getItem("nickname");
  const kakaoId = localStorage.getItem("kakaoId");

  if (!nickname || !kakaoId) {
    alert("로그인이 필요합니다.");
    window.location.href = "https://byungil-cho.github.io/OrcaX/signup.html";
    return {};
  }

  return { nickname, kakaoId };
}
