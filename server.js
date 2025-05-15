
const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const PORT = 5000;
const DATA_FILE = path.join(__dirname, 'notices.json');
const ADMIN_PASSWORD = '2025';

app.use(cors());
app.use(bodyParser.json());

// 공지사항 추가 API
app.post('/addNotice', (req, res) => {
  const { password, title, date, content } = req.body;

  if (password !== ADMIN_PASSWORD) {
    return res.status(403).json({ message: '비밀번호가 틀렸습니다.' });
  }

  if (!title || !date || !content) {
    return res.status(400).json({ message: '모든 항목을 입력해주세요.' });
  }

  const newNotice = { title, date, content };

  // 기존 공지사항 불러오기
  fs.readFile(DATA_FILE, 'utf8', (err, data) => {
    if (err) return res.status(500).json({ message: '공지사항 읽기 오류' });

    let notices = [];
    try {
      notices = JSON.parse(data);
    } catch (parseErr) {
      return res.status(500).json({ message: 'JSON 파싱 오류' });
    }

    // 새 공지사항을 앞에 추가
    notices.unshift(newNotice);

    // 다시 저장
    fs.writeFile(DATA_FILE, JSON.stringify(notices, null, 2), 'utf8', (writeErr) => {
      if (writeErr) return res.status(500).json({ message: '공지사항 저장 실패' });
      return res.json({ message: '공지사항이 성공적으로 저장되었습니다.' });
    });
  });
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`✅ 공지사항 서버가 포트 ${PORT}에서 실행 중입니다.`);
});
