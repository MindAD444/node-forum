const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const User = require('../models/User');
const auth = require('../middleware/auth');

// Lấy tất cả bài viết chờ duyệt
router.get('/posts', auth('admin'), async (req, res) => {
  const posts = await Post.find({ approved: false })
    .populate('author', 'username')
    .sort('-createdAt');
  res.json(posts);
});

// Duyệt bài
router.put('/post/:id', auth('admin'), async (req, res) => {
  try {
    const post = await Post.findByIdAndUpdate(req.params.id, { approved: true });
    if (!post) return res.status(404).json({ error: 'Không tìm thấy bài viết' });
    res.json({ message: 'Đã duyệt bài viết' });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server khi duyệt bài' });
  }
});

// Xóa bài
router.delete('/post/:id', auth('admin'), async (req, res) => {
  try {
    await Post.findByIdAndDelete(req.params.id);
    res.json({ message: 'Đã xóa bài viết' });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server khi xóa bài' });
  }
});

// Danh sách người dùng (chỉ admin)
router.get('/users', auth('admin'), async (req, res) => {
  const users = await User.find({}, '-password');
  res.json(users);
});

module.exports = router;
