const express = require('express');
const multer = require('multer');
const Application = require('../models/application');

const router = express.Router();
const upload = multer();

// 신청 저장
router.post('/apply', upload.single('file'), async (req, res) => {
  try {
    const newApp = new Application({
      ...req.body,
      file: {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        buffer: req.file.buffer,
        size: req.file.size
      }
    });

    await newApp.save();
    res.json({ message: "신청 완료! 범고래 감자 접수함!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "서버 오류 발생!" });
  }
});

// 관리자용 신청서 목록 조회
router.get('/admin/applications', async (req, res) => {
  try {
    const applications = await Application.find().sort({ createdAt: -1 });
    res.json(applications);
  } catch (err) {
    res.status(500).json({ message: "신청서 목록 조회 실패" });
  }
});

// 업로드된 사업자등록증 보기
router.get('/admin/file/:id', async (req, res) => {
  try {
    const app = await Application.findById(req.params.id);
    if (!app || !app.file || !app.file.buffer) {
      return res.status(404).send('파일 없음');
    }

    res.set('Content-Type', app.file.mimetype);
    res.send(app.file.buffer);
  } catch (err) {
    res.status(500).send('파일 조회 오류');
  }
});

module.exports = router;
