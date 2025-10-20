const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');

// Đăng ký
router.post('/register', async (req, res) => {
  const { username, password, isAdmin } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Thiếu thông tin đăng ký' });

  const exist = await User.findOne({ username });
  if (exist) return res.status(400).json({ error: 'Tên người dùng đã tồn tại' });

  const hashed = await bcrypt.hash(password, 10);
  const user = new User({
    username,
    password: hashed,
    role: isAdmin ? 'admin' : 'user',
    isAdmin: !!isAdmin,
  });
  await user.save();
  res.json({ message: 'Đăng ký thành công' });
});

// Đăng nhập
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user) return res.status(400).json({ error: 'Không tìm thấy người dùng' });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(400).json({ error: 'Sai mật khẩu' });

  const token = jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );

  res.json({ token });
});

// Lấy thông tin user hiện tại
router.get('/me', auth(), async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
