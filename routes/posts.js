const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Post = require('../models/Post');
const auth = require('../middleware/auth');

// Cấu hình upload file
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|pdf|doc|docx/;
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.test(ext)) cb(null, true);
    else cb(new Error('File type not allowed'));
  },
});

// Lấy bài đã duyệt
router.get('/', async (req, res) => {
  const posts = await Post.find({ approved: true })
    .populate('author', 'username')
    .sort('-createdAt');
  res.json(posts);
});

// Đăng bài mới
router.post('/', auth('user'), upload.array('files', 5), async (req, res) => {
  try {
    const { title, content } = req.body;
    if (!title || !content)
      return res.status(400).json({ error: 'Thiếu tiêu đề hoặc nội dung' });

    const files = req.files ? req.files.map(f => '/uploads/' + f.filename) : [];
    const post = new Post({
      title,
      content,
      files,
      author: req.user.id,
      approved: false,
    });
    await post.save();
    res.json({ message: 'Bài gửi thành công, chờ duyệt!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server khi đăng bài' });
  }
});

module.exports = router;
