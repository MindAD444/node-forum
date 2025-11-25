import express from "express";
import Post from "../models/Post.js";
import auth from "../middleware/auth.js";
import { requireAdmin } from "../middleware/admin.js";

const router = express.Router();

// Lấy danh sách bài chờ duyệt
router.get("/pending", auth("user"),  async (req, res) => {
  try {
    const posts = await Post.find({ approved: false })
      .populate("author", "username")
      .sort("-createdAt");

    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: "Lỗi server khi tải bài chờ duyệt" });
  }
});

// Duyệt bài
router.put("/approve/:id", auth("user"), requireAdmin, async (req, res) => {
  try {
    await Post.findByIdAndUpdate(req.params.id, { approved: true });
    res.json({ message: "✅ Bài viết đã được duyệt!" });
  } catch (err) {
    res.status(500).json({ error: "Lỗi server" });
  }
});

// Xóa bài khi admin từ chối
router.delete("/reject/:id", auth("user"), requireAdmin, async (req, res) => {
  try {
    await Post.findByIdAndDelete(req.params.id);
    res.json({ message: "❌ Bài viết đã bị từ chối và xóa!" });
  } catch (err) {
    res.status(500).json({ error: "Lỗi server" });
  }
});

export default router;
