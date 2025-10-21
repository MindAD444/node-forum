const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sendMail = require('../utils/mailer');

const verificationCodes = {}; // Lưu mã xác thực tạm

// 📩 Gửi mã xác thực
router.post('/register/request', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password)
      return res.status(400).json({ error: 'Thiếu thông tin đăng ký.' });

    // Tạo mã ngẫu nhiên 6 chữ số
    const code = Math.floor(100000 + Math.random() * 900000);

    // Lưu mã này trong bộ nhớ tạm (10 phút)
    verificationCodes[email] = { code, username, password, createdAt: Date.now() };

    // Gửi email
    await sendMail(email, code);

    res.json({ message: 'Đã gửi mã xác thực tới email của bạn.' });
  } catch (err) {
    console.error('❌ Lỗi gửi mã xác thực:', err);
    res.status(500).json({ error: 'Không thể gửi mã xác thực.' });
  }
});

// ✅ Xác minh mã và tạo tài khoản
router.post('/register/verify', async (req, res) => {
  try {
    const { email, code } = req.body;
    const record = verificationCodes[email];

    if (!record) return res.status(400).json({ error: 'Không tìm thấy mã xác thực.' });
    if (Date.now() - record.createdAt > 10 * 60 * 1000)
      return res.status(400).json({ error: 'Mã xác thực đã hết hạn.' });
    if (parseInt(code) !== record.code)
      return res.status(400).json({ error: 'Mã xác thực không đúng.' });

    // Tạo user mới
    const hashed = await bcrypt.hash(record.password, 10);
    const newUser = new User({
      username: record.username,
      email,
      password: hashed,
      role: 'user',
      isAdmin: false,
    });
    await newUser.save();

    delete verificationCodes[email];
    res.json({ message: 'Đăng ký thành công.' });
  } catch (err) {
    console.error('❌ Lỗi xác minh mã:', err);
    res.status(500).json({ error: 'Lỗi xác minh mã xác thực.' });
  }
});

module.exports = router;
