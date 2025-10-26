import express from "express";
import Comment from "../models/Comment.js";
import Post from "../models/Post.js";
import auth from "../middleware/auth.js";
import mongoose from "mongoose";

const router = express.Router();

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(String(id));
}

// Lấy tất cả bình luận thuộc bài viết
router.get("/:postId", async (req, res) => {
  try {
    const postId = req.params.postId;

    if (!isValidObjectId(postId)) {
      return res.status(400).json({ error: "postId không hợp lệ" });
    }

    const comments = await Comment.find({ post: postId })
      .populate("author", "username")
      .sort("createdAt");

    res.json(comments);
  } catch (err) {
    console.error("GET /comments error:", err);
    res.status(500).json({ error: "Lỗi server khi tải bình luận" });
  }
});

// Gửi bình luận
router.post("/:postId", auth("user"), async (req, res) => {
  try {
    const postId = req.params.postId;
    const { content } = req.body;

    if (!content || !content.trim()) return res.status(400).json({ error: "Nội dung không được để trống" });

    const newComment = await Comment.create({
      post: postId,
      author: req.user._id,
      content: content.trim(),
    });

    await newComment.populate("author", "username");
    res.status(201).json(newComment);
  } catch (err) {
    console.error("POST /comments error:", err);
    res.status(500).json({ error: "Lỗi server khi tạo bình luận" });
  }
});

// ✅ Xoá bình luận — chỉ chủ comment hoặc Admin mới được phép
router.delete("/:commentId", auth("user"), async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);

    if (!comment) return res.status(404).json({ error: "Bình luận không tồn tại." });

    const isOwner = comment.author.toString() === req.user._id.toString();

    if (!req.user.isAdmin && !isOwner)
      return res.status(403).json({ error: "Bạn không có quyền xoá bình luận này." });

    await Comment.findByIdAndDelete(req.params.commentId);

    res.json({ message: "Đã xoá bình luận thành công." });
  } catch (err) {
    console.error("DELETE /comments error:", err);
    res.status(500).json({ error: "Lỗi server khi xoá bình luận" });
  }
});

export default router;
