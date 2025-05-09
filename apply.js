const express = require('express');
const multer = require('multer');
const Application = require('../models/application');
const nodemailer = require('nodemailer');
require('dotenv').config();

const router = express.Router();
const upload = multer();

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

    // ✅ 이메일 발송
    const transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const mailOptions = {
      from: `"OrcaX 접수알림" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_RECEIVER,
      subject: `[OrcaX 신청] ${req.body.name}님 가맹점 신청이 도착했습니다!`,
      html: `
        <h3>📄 OrcaX 가맹 신청서 접수</h3>
        <p><strong>상호명:</strong> ${req.body.name}</p>
        <p><strong>연락처:</strong> ${req.body.phone}</p>
        <p><strong>업종:</strong> ${req.body.type}</p>
        <p><strong>주소:</strong> ${req.body.address}</p>
        <p><strong>지역:</strong> ${req.body.region}</p>
        <p><strong>비고:</strong> ${req.body.message || "없음"}</p>
        <p><strong>신청시간:</strong> ${new Date().toLocaleString()}</p>
      `
    };

    await transporter.sendMail(mailOptions);

    res.json({ message: "신청 완료 및 관리자 알림 전송 완료!" });

  } catch (err) {
    console.error("❌ 오류:", err);
    res.status(500).json({ message: "서버 오류 발생!" });
  }
});

module.exports = router;

