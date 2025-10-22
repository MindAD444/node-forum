import express from 'express';
import Comment from '../models/Comment.js';
import Post from '../models/Post.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// Lấy danh sách bình luận theo Post ID
router.get('/:postId', async (req, res) => {
    try {
        const comments = await Comment.find({ post: req.params.postId })
            .populate('author', 'username') 
            .sort('createdAt');
        res.json(comments);
    } catch (err) {
        res.status(500).json({ error: 'Lỗi server khi tải bình luận' });
    }
});

// Đăng bình luận mới
router.post('/:postId', auth('user'), async (req, res) => {
    try {
        const { content } = req.body;
        const post = await Post.findById(req.params.postId);

        if (!post) return res.status(404).json({ error: 'Bài viết không tồn tại.' });
        if (!content || content.trim().length === 0) return res.status(400).json({ error: 'Nội dung bình luận không được để trống.' });

        const newComment = new Comment({
            post: req.params.postId,
            author: req.user._id,
            content: content.trim(),
        });
        await newComment.save();
        
        // Trả về comment đã được populate user để frontend render
        const populatedComment = await newComment.populate('author', 'username'); 

        res.status(201).json(populatedComment);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Lỗi server khi đăng bình luận' });
    }
});

// Xóa bình luận (Chủ bình luận HOẶC Admin)
router.delete('/:commentId', auth('user'), async (req, res) => {
    try {
        const comment = await Comment.findById(req.params.commentId);
        if (!comment) return res.status(404).json({ error: 'Không tìm thấy bình luận' });

        // Kiểm tra quyền
        const isOwner = comment.author.toString() === req.user._id.toString();
        if (!req.user.isAdmin && !isOwner) {
            return res.status(403).json({ error: 'Bạn không có quyền xóa bình luận này.' });
        }

        await Comment.findByIdAndDelete(req.params.commentId);
        res.json({ message: 'Đã xóa bình luận thành công.' });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi server khi xóa bình luận' });
    }
});

export default router;

