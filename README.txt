OrcaX Corn — ADD-ONLY bundle
============================

이 번들은 '추가만' 필요한 파일만 포함합니다. (기존 서버 코드는 손대지 않음)

구성:
- js/corn-api.js         ← 백엔드(3060) 저장소 루트에 js 폴더를 만들고 여기에 그대로 복사
- corn-farm.html         ← GitHub Pages(OrcaX)로 업로드 (JS는 백엔드에서 로드)

배치 방법:
1) 백엔드 저장소(3060) 루트에 'js' 폴더가 없다면 생성하고, js/corn-api.js 파일을 그대로 넣으세요.
   → 브라우저에서 https://<ngrok-host>/js/corn-api.js 로 접속했을 때 파일 내용이 보여야 합니다.

2) (서버 코드 추가 없이) server-unified.js에 아래 한 줄이 이미 있다면 그대로 두세요.
   app.use('/js', express.static(path.join(__dirname, 'js')));
   ※ 없다면 이 한 줄만 추가하면 됩니다. (기존 코드 절대 수정 금지)

3) GitHub Pages(OrcaX) 쪽에는 corn-farm.html을 올리면 됩니다.
   파일 내부 스크립트 경로는 다음과 같습니다 (백엔드 JS 로드, 정적 페이지가 아님):
   <script src="https://climbing-wholly-grouper.jp.ngrok.io/js/corn-api.js"></script>

체크리스트:
- https://climbing-wholly-grouper.jp.ngrok.io/js/corn-api.js  → 200 OK
- https://byungil-cho.github.io/OrcaX/corn-farm.html          → 열었을 때 'JS 로드 실패' 문구가 없어야 정상
- DevTools Network에서 /api/userdata, /api/corn/* 요청이 ngrok 도메인으로 나가는지 확인

