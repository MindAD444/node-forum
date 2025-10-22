import express from 'express';
import Post from '../models/Post.js';
import Comment from '../models/Comment.js'; 
import auth from '../middleware/auth.js'; 
import { v2 as cloudinary } from 'cloudinary'; 
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';

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
        // Cần populate author để lấy ID của tác giả
        const post = await Post.findById(req.params.id).populate('author', '_id');
        if (!post) return res.status(404).json({ error: 'Không tìm thấy bài viết' });

        // Kiểm tra quyền (So sánh ID tác giả và ID người dùng đăng nhập)
        const isOwner = post.author._id.toString() === req.user._id.toString();
        if (!req.user.isAdmin && !isOwner) {
            return res.status(403).json({ error: 'Bạn không có quyền xóa bài viết này.' });
        }
        
        await Post.findByIdAndDelete(req.params.id);
        await Comment.deleteMany({ post: req.params.id }); 
        
        // TODO: (Tối ưu) Logic xóa file trên Cloudinary có thể được thêm vào đây
        
        res.json({ message: 'Đã xóa bài viết và tất cả bình luận liên quan.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Lỗi server khi xóa bài viết' });
    }
});

export default router;

