import express from 'express';
import Post from '../models/Post.js';
import Comment from '../models/Comment.js'; 
import auth from '../middleware/auth.js'; 
import { v2 as cloudinary } from 'cloudinary'; 
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';
import { connectDB } from "../config/db.js";
const router = express.Router();

// Cấu hình Cloudinary Storage
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'forum-uploads',
        format: async (req, file) => 'jpg', // Tùy chọn format
        public_id: (req, file) => Date.now() + '-' + file.originalname.split('.')[0],
    },
});
const upload = multer({ storage: storage });

// Lấy bài đã duyệt (Post Index)
router.get('/', async (req, res) => {
  const posts = await Post.find({ approved: true })
    .populate('author', 'username')
    .sort('-createdAt');
  res.json(posts);
});

// ===============================================
// ROUTE CHI TIẾT BÀI VIẾT: Lấy bài viết theo ID
// ===============================================
router.get('/:id', async (req, res) => {
    try {
        const post = await Post.findById(req.params.id)
            .populate('author', 'username _id') 
            .lean(); 

        if (!post) {
            return res.status(404).json({ error: 'Không tìm thấy bài viết' });
        }
        res.json(post);
    } catch (err) {
        // Log lỗi chi tiết nếu có lỗi BSON/Cast (ID không hợp lệ)
        console.error("Lỗi khi lấy chi tiết bài viết:", err); 
        res.status(404).json({ error: 'ID bài viết không hợp lệ.' }); // Trả về 404 cho lỗi ID không hợp lệ
    }
});
// ===============================================


// Đăng bài mới (Sử dụng Cloudinary)
router.post('/', auth('user'), upload.array('files', 5), async (req, res) => {
  try {
    const { title, content } = req.body;
    if (!title || !content)
      return res.status(400).json({ error: 'Thiếu tiêu đề hoặc nội dung' });

    const fileUrls = req.files ? req.files.map(f => f.path) : [];

    const newPost = new Post({
      title,
      content,
      files: fileUrls,
      author: req.user._id, 
      approved: false, // Yêu cầu duyệt bài
    });
    await newPost.save();
    res.json({ message: 'Bài viết đã gửi, chờ duyệt.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server khi đăng bài' });
  }
});

// Xóa bài viết (Chủ bài viết HOẶC Admin)
router.delete('/:id', auth('user'), async (req, res) => {
    try {
        const post = await Post.findById(req.params.id).populate('author', '_id');
        if (!post) return res.status(404).json({ error: 'Không tìm thấy bài viết' });

        const isOwner = post.author._id.toString() === req.user._id.toString();
        if (!req.user.isAdmin && !isOwner) {
            return res.status(403).json({ error: 'Bạn không có quyền xóa bài viết này.' });
        }
        
        await Post.findByIdAndDelete(req.params.id);
        await Comment.deleteMany({ post: req.params.id }); 
        
        res.json({ message: 'Đã xóa bài viết và tất cả bình luận liên quan.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Lỗi server khi xóa bài viết' });
    }
});

export default router;
