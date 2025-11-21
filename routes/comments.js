import express from "express";
import Comment from "../models/Comment.js";
import Post from "../models/Post.js";
import auth from "../middleware/auth.js";
import mongoose from "mongoose";

const router = express.Router();

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(String(id));
}

/* -------------------------------------------------------
   LẤY BÌNH LUẬN (PHÂN TRANG)
------------------------------------------------------- */
router.get("/:postId", async (req, res) => {
  try {
    const postId = req.params.postId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    if (!isValidObjectId(postId)) {
      return res.status(400).json({ error: "postId không hợp lệ" });
    }

    const skip = (page - 1) * limit;

    const comments = await Comment.find({ post: postId })
      .populate("author", "username")
      .sort({ createdAt: 1 }) // cũ nhất trước
      .skip(skip)
      .limit(limit)
      .lean();

    const totalComments = await Comment.countDocuments({ post: postId });
    const totalPages = Math.ceil(totalComments / limit);

    res.json({
      comments,
      totalPages,
      currentPage: page,
      totalComments
    });

  } catch (err) {
    console.error("GET /comments error:", err);
    res.status(500).json({ error: "Lỗi server khi tải bình luận" });
  }
});

/* -------------------------------------------------------
   TẠO BÌNH LUẬN MỚI
------------------------------------------------------- */
router.post("/:postId", auth("user"), async (req, res) => {
  try {
    const postId = req.params.postId;
    const { content } = req.body;

    if (!isValidObjectId(postId)) {
      return res.status(400).json({ error: "ID bài viết không hợp lệ" });
    }

    if (!content || !content.trim()) {
      return res.status(400).json({ error: "Nội dung bình luận không được để trống" });
    }

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

/* -------------------------------------------------------
   XOÁ BÌNH LUẬN (chủ comment hoặc admin)
------------------------------------------------------- */
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

    if (!req.user.isAdmin && !isOwner) {
      return res.status(403).json({ error: "Bạn không có quyền xoá bình luận này." });
    }

    await Comment.findByIdAndDelete(commentId);

    res.json({ message: "Đã xoá bình luận thành công." });

  } catch (err) {
    console.error("DELETE /comments error:", err);
    res.status(500).json({ error: "Lỗi server khi xoá bình luận" });
  }
});

export default router;