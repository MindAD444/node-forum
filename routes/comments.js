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

// Gửi bình luận (không có parent nữa)
router.post("/:postId", auth("user"), async (req, res) => {
  try {
    const postId = req.params.postId;
    const { content } = req.body;

    if (!isValidObjectId(postId)) {
      return res.status(400).json({ error: "postId không hợp lệ" });
    }

    if (!content || content.trim() === "") {
      return res.status(400).json({ error: "Nội dung không được để trống." });
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

export default router;
