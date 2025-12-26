import express from "express";
import Comment from "../models/Comment.js";
import Post from "../models/Post.js";
import auth from "../middleware/auth.js";
import mongoose from "mongoose";

const router = express.Router();

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(String(id));
}

router.get("/:postId", async (req, res) => {
  try {
    const postId = req.params.postId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    if (!isValidObjectId(postId)) {
      return res.status(400).json({ error: "postId không hợp lệ" });
    }

    const skip = (page - 1) * limit;

    // Return only top-level (root) comments and include direct replies count for lazy-loading
    const roots = await Comment.find({ post: postId, parent: null })
      .populate("author", "username")
      .sort({ createdAt: 1 })
      .lean();

    // Aggregate counts of direct replies per parent
    const counts = await Comment.aggregate([
      { $match: { post: new mongoose.Types.ObjectId(postId), parent: { $ne: null } } },
      { $group: { _id: "$parent", count: { $sum: 1 } } }
    ]);
    const countMap = {};
    counts.forEach(c => { countMap[c._id.toString()] = c.count; });

    const results = roots.map(r => ({
      ...r,
      repliesCount: countMap[r._id.toString()] || 0
    }));

    res.json({ comments: results });

  } catch (err) {
    console.error("GET /comments error:", err);
    res.status(500).json({ error: "Lỗi server khi tải bình luận" });
  }
});

router.post("/:postId", auth("user"), async (req, res) => {
  try {
    const postId = req.params.postId;
    const { content, parent } = req.body;

    if (!isValidObjectId(postId)) {
      return res.status(400).json({ error: "ID bài viết không hợp lệ" });
    }

    if (!content || !content.trim()) {
      return res.status(400).json({ error: "Nội dung bình luận không được để trống" });
    }

    // Extract mentions in the format @username (case-insensitive)
    const rawMentions = Array.from(new Set((content.match(/@([a-zA-Z0-9_\-\.]+)/g) || []).map(m => m.slice(1))));
    let mentionIds = [];
    if (rawMentions.length > 0) {
      const User = (await import('../models/User.js')).default;
      // Build case-insensitive regex queries for each username
      const or = rawMentions.map(u => ({ username: new RegExp(`^${u.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}$`, 'i') }));
      const users = await User.find({ $or: or }).select('_id');
      mentionIds = users.map(u => u._id);
    }

    const newComment = await Comment.create({
      post: postId,
      author: req.user._id,
      content: content.trim(),
      parent: parent && isValidObjectId(parent) ? parent : null,
      mentions: mentionIds,
    });

    await newComment.populate("author", "username");

    res.status(201).json(newComment);

  } catch (err) {
    console.error("POST /comments error:", err);
    res.status(500).json({ error: "Lỗi server khi tạo bình luận" });
  }
});

// GET direct replies for a comment (lazy-load)
router.get('/:postId/replies/:commentId', async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    if (!isValidObjectId(postId) || !isValidObjectId(commentId)) return res.status(400).json({ error: 'ID không hợp lệ' });

    const replies = await Comment.find({ post: postId, parent: commentId })
      .populate('author', 'username')
      .sort({ createdAt: 1 })
      .lean();

    // Include repliesCount for each reply (to know if they have nested replies)
    const ids = replies.map(r => r._id);
    const counts = await Comment.aggregate([
      { $match: { post: new mongoose.Types.ObjectId(postId), parent: { $in: ids.map(i => new mongoose.Types.ObjectId(i)) } } },
      { $group: { _id: '$parent', count: { $sum: 1 } } }
    ]);
    const countMap = {};
    counts.forEach(c => { countMap[c._id.toString()] = c.count; });

    const results = replies.map(r => ({ ...r, repliesCount: countMap[r._id.toString()] || 0 }));
    res.json({ replies: results });
  } catch (err) {
    console.error('GET replies error:', err);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

router.delete("/:commentId", auth("user"), async (req, res) => {
  try {
    const { commentId } = req.params;

    if (!isValidObjectId(commentId)) {
      return res.status(400).json({ error: "ID bình luận không hợp lệ" });
    }

    const comment = await Comment.findById(commentId);

    if (!comment) {
      return res.status(404).json({ error: "Bình luận không tồn tại." });
    }

    const isOwner = comment.author.toString() === req.user._id.toString();

    if (req.user.role !== "admin" && !isOwner) {
      return res.status(403).json({ error: "Bạn không có quyền xóa bình luận này" });
    }

    // Cascade delete: remove the comment and all its descendant replies
    const toDelete = [commentId];
    for (let i = 0; i < toDelete.length; i++) {
      const parentIds = toDelete.slice(i).map(id => new mongoose.Types.ObjectId(id));
      const children = await Comment.find({ parent: { $in: parentIds } }).select('_id').lean();
      children.forEach(c => toDelete.push(c._id.toString()));
    }
    await Comment.deleteMany({ _id: { $in: toDelete.map(id => new mongoose.Types.ObjectId(id)) } });
    res.json({ message: "Đã xóa bình luận và các trả lời liên quan" });
  } catch (err) {
    res.status(500).json({ error: "Lỗi server" });
  }
});

export default router;
