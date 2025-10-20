// =======================
// Forum Server Backend (ESM)
// =======================

import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import cors from "cors";
import path from "path";
import fs from "fs-extra";
import multer from "multer";
import { fileURLToPath } from "url";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =======================
// __dirname cho ESM
// =======================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =======================
// MongoDB
// =======================
// Sử dụng fallback nếu MONGO_URI không có
mongoose
  .connect(process.env.MONGO_URI || "mongodb://localhost:27017/forumdb") 
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("MongoDB error:", err));

// =======================
// Schema
// =======================
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: String,
  isAdmin: { type: Boolean, default: false },
});

const postSchema = new mongoose.Schema({
  title: String,
  content: String,
  files: [String],
  approved: { type: Boolean, default: false },
  // Thêm trường tham chiếu đến User làm tác giả
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, 
  createdAt: { type: Date, default: Date.now },
});

// Thêm Schema cho Bình luận
const commentSchema = new mongoose.Schema({
  content: { type: String, required: true },
  post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
});

const User = mongoose.model("User", userSchema);
const Post = mongoose.model("Post", postSchema);
// Định nghĩa Model Comment
const Comment = mongoose.model("Comment", commentSchema);


// =======================
// Middleware xác thực
// =======================
function verifyToken(req, res, next) {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Không có token" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secretkey");
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ message: "Token không hợp lệ" });
  }
}

function verifyAdmin(req, res, next) {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ message: "Không có quyền truy cập" });
  }
  next();
}

// =======================
// Upload files (multer)
// =======================
fs.ensureDirSync("uploads");

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) =>
    cb(null, Date.now() + "-" + file.originalname.replace(/\s+/g, "_")),
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// =======================
// Routes: Auth
// =======================
app.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    const existing = await User.findOne({ username });
    if (existing)
      return res.status(400).json({ message: "Tên người dùng đã tồn tại" });
    const hashed = await bcrypt.hash(password, 10);
    // Luôn tạo user với isAdmin: false
    await new User({ username, password: hashed, isAdmin: false }).save(); 
    res.json({ message: "Đăng ký thành công" });
  } catch (err) {
    res.status(500).json({ error: "Lỗi server khi đăng ký" });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user)
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ message: "Sai mật khẩu" });

    const token = jwt.sign(
      { id: user._id, isAdmin: user.isAdmin },
      process.env.JWT_SECRET || "secretkey",
      { expiresIn: "1d" }
    );
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: "Lỗi server khi đăng nhập" });
  }
});

// =======================
// Routes: Get Current User
// =======================
app.get("/me", verifyToken, async (req, res) => {
  try {
    // Tìm user bằng ID từ token và loại bỏ password
    const user = await User.findById(req.user.id).select("-password"); 
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }
    // Trả về thông tin user (bao gồm _id, username, isAdmin)
    res.json(user); 
  } catch (err) {
    res.status(500).json({ error: "Lỗi server" });
  }
});


// =======================
// Routes: Posts
// =======================
app.get("/posts", async (req, res) => {
  // Thêm populate('author', 'username') để lấy tên tác giả
  const posts = await Post.find({ approved: true })
    .populate('author', 'username') 
    .sort({ createdAt: -1 });
  res.json(posts);
});

app.post("/posts", verifyToken, upload.array("files", 5), async (req, res) => {
  try {
    const { title, content } = req.body;
    if (!title || !content)
      return res.status(400).json({ message: "Thiếu tiêu đề hoặc nội dung" });
    const filePaths = req.files.map((f) => `/uploads/${f.filename}`);
    const newPost = new Post({
      title,
      content,
      files: filePaths,
      approved: false,
      // Lưu ID của người đăng bài làm tác giả
      author: req.user.id, 
    });
    await newPost.save();
    res.json({ message: "Bài viết đã gửi, chờ duyệt." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server khi đăng bài" });
  }
});

// Route xóa bài viết (Admin hoặc Tác giả)
app.delete("/posts/:id", verifyToken, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: "Không tìm thấy bài viết" });
    }

    const user = req.user;

    // Kiểm tra quyền: Hoặc là admin, HOẶC là tác giả bài viết
    if (user.isAdmin || post.author.toString() === user.id) {
      await Post.findByIdAndDelete(req.params.id);
      
      // Xóa tất cả comment của bài viết này
      await Comment.deleteMany({ post: req.params.id }); 

      return res.json({ message: "Đã xóa bài viết thành công" });
    }

    // Nếu không có quyền
    return res.status(403).json({ message: "Bạn không có quyền xóa bài viết này" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server khi xóa bài" });
  }
});


// =======================
// Routes: Comments
// =======================

// Lấy tất cả bình luận của 1 bài viết
app.get("/posts/:id/comments", async (req, res) => {
  try {
    const comments = await Comment.find({ post: req.params.id })
      .populate('author', 'username') // Lấy username của tác giả comment
      .sort('createdAt');
    res.json(comments);
  } catch (err) {
    res.status(500).json({ error: "Lỗi server khi tải bình luận" });
  }
});

// Đăng bình luận mới
app.post("/posts/:id/comments", verifyToken, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ message: "Nội dung bình luận không được trống" });
    }

    const newComment = new Comment({
      content: content,
      post: req.params.id,
      author: req.user.id
    });

    await newComment.save();
    
    // Trả về bình luận mới đã populate để hiển thị ngay
    const populatedComment = await Comment.findById(newComment._id)
                                    .populate('author', 'username');

    res.status(201).json(populatedComment);
  } catch (err) {
    res.status(500).json({ error: "Lỗi server khi đăng bình luận" });
  }
});

// Route xóa bình luận (Admin hoặc Tác giả)
app.delete("/comments/:id", verifyToken, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      return res.status(404).json({ message: "Không tìm thấy bình luận" });
    }

    const user = req.user;

    // Kiểm tra quyền: Hoặc là admin, HOẶC là tác giả bình luận
    if (user.isAdmin || comment.author.toString() === user.id) {
      await Comment.findByIdAndDelete(req.params.id);
      return res.json({ message: "Đã xóa bình luận thành công" });
    }

    // Nếu không có quyền
    return res.status(403).json({ message: "Bạn không có quyền xóa bình luận này" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server khi xóa bình luận" });
  }
});


// =======================
// Admin
// =======================
app.get("/admin/posts", verifyToken, verifyAdmin, async (req, res) => {
  // Thêm populate('author', 'username')
  const pending = await Post.find({ approved: false })
    .populate('author', 'username')
    .sort({ createdAt: -1 });
  res.json(pending);
});

app.put("/admin/post/:id", verifyToken, verifyAdmin, async (req, res) => {
  await Post.findByIdAndUpdate(req.params.id, { approved: true });
  res.json({ message: "Đã duyệt bài" });
});


// =======================
// Public
// =======================
app.use(express.static(path.join(__dirname, "public")));

// =======================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

