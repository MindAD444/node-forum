// =======================
//  Forum Server Backend (ESM)
// =======================

import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import cors from "cors";
import path from "path";
// import fs from "fs-extra"; // KHÔNG CẦN NỮA
import multer from "multer";
import { fileURLToPath } from "url";
// THÊM: Cloudinary imports
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";


dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =======================
//  __dirname cho ESM
// =======================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =======================
//  Cấu hình Cloudinary
// =======================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});


// =======================
//  MongoDB
// =======================
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("MongoDB error:", err));

// =======================
//  Schema
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
  createdAt: { type: Date, default: Date.now },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } 
});

const commentSchema = new mongoose.Schema({
  content: String,
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' },
  createdAt: { type: Date, default: Date.now },
});


const User = mongoose.model("User", userSchema);
const Post = mongoose.model("Post", postSchema);
const Comment = mongoose.model("Comment", commentSchema);


// =======================
//  Middleware xác thực
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
//  Upload files (Cloudinary)
// =======================
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "forum_uploads", // Thư mục trên Cloudinary
    allowed_formats: ["jpg", "jpeg", "png", "gif", "pdf", "docx"], 
    resource_type: "auto", // Quan trọng cho cả ảnh và file
  },
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // Giới hạn 10MB
});

// KHÔNG CẦN app.use("/uploads", express.static...) nữa
// =======================
//  Hàm tiện ích
// =======================
/**
 * Trích xuất public_id từ URL của Cloudinary để xóa file.
 * Cloudinary URL: https://res.cloudinary.com/.../v1600000000/forum_uploads/filename.jpg
 * public_id: forum_uploads/filename
 */
const extractPublicId = (url) => {
    try {
        const parts = url.split('/');
        // Bắt đầu từ thư mục chính đã định nghĩa ('forum_uploads')
        const startIndex = parts.indexOf('forum_uploads');
        if (startIndex === -1) return null;
        
        const publicIdWithExtension = parts.slice(startIndex).join('/');
        return publicIdWithExtension.split('.')[0]; // Xóa đuôi file
    } catch (e) {
        console.error("Lỗi khi trích xuất publicId:", e);
        return null;
    }
};

// =======================
//  Routes: Auth (Giữ nguyên)
// =======================
app.get("/me", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ message: "Không tìm thấy người dùng" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: "Lỗi server" });
  }
});

app.post("/register", async (req, res) => {
  try {
    const { username, password, isAdmin } = req.body;
    const existing = await User.findOne({ username });
    if (existing)
      return res.status(400).json({ message: "Tên người dùng đã tồn tại" });
    const hashed = await bcrypt.hash(password, 10);
    await new User({ username, password: hashed, isAdmin: !!isAdmin }).save();
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
//  Routes: Posts
// =======================
app.get("/posts", async (req, res) => {
  const posts = await Post.find({ approved: true })
    .populate('author', 'username')
    .sort({ createdAt: -1 });
  res.json(posts);
});

app.post("/posts", verifyToken, upload.array("files", 5), async (req, res) => {
  try {
    const { title, content } = req.body;
    if (!title || !content) {
        // Tùy chọn: Xóa các file đã upload nếu form bị lỗi (phức tạp)
        return res.status(400).json({ message: "Thiếu tiêu đề hoặc nội dung" });
    }
    
    // THAY ĐỔI: Lấy URL công khai từ Cloudinary
    const filePaths = req.files.map((f) => f.path); 
    
    const newPost = new Post({
      title,
      content,
      files: filePaths,
      approved: false,
      author: req.user.id, 
    });
    await newPost.save();
    res.json({ message: "Bài viết đã gửi, chờ duyệt." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server khi đăng bài" });
  }
});

app.delete("/posts/:id", verifyToken, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Không tìm thấy bài viết" });

    const canDelete = req.user.isAdmin || post.author.toString() === req.user.id;
    if (!canDelete) {
      return res.status(403).json({ message: "Bạn không có quyền xóa bài viết này" });
    }

    await Comment.deleteMany({ post: req.params.id }); 

    await Post.findByIdAndDelete(req.params.id);
    
    // THAY ĐỔI: Xóa files trên Cloudinary
    if (post.files && post.files.length > 0) {
        for (const filePath of post.files) {
            const publicId = extractPublicId(filePath);
            if (publicId) {
                // Tùy chọn: Xác định resource_type nếu bạn dùng cả video/raw file
                await cloudinary.uploader.destroy(publicId, { resource_type: "raw" }).catch(() => {});
                await cloudinary.uploader.destroy(publicId, { resource_type: "image" }).catch(() => {});
            }
        }
    }

    res.json({ message: "Đã xóa bài viết thành công" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server khi xóa bài" });
  }
});


// =======================
//  Routes: Comments (Giữ nguyên)
// =======================
app.get("/posts/:postId/comments", async (req, res) => {
  try {
    const comments = await Comment.find({ post: req.params.postId })
      .populate('author', 'username') 
      .sort({ createdAt: 1 });
    res.json(comments);
  } catch (err) {
    res.status(500).json({ error: "Lỗi server khi tải bình luận" });
  }
});

app.post("/posts/:postId/comments", verifyToken, async (req, res) => {
  try {
    const { content } = req.body;
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ message: "Không tìm thấy bài viết" });

    const newComment = new Comment({
      content,
      post: req.params.postId,
      author: req.user.id,
    });
    await newComment.save();
    
    const populatedComment = await Comment.findById(newComment._id).populate('author', 'username');

    res.status(201).json(populatedComment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server khi đăng bình luận" });
  }
});

app.delete("/comments/:commentId", verifyToken, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId).populate('author', 'username');
    if (!comment) return res.status(404).json({ message: "Không tìm thấy bình luận" });

    const canDelete = req.user.isAdmin || comment.author._id.toString() === req.user.id;
    
    if (!canDelete) {
      return res.status(403).json({ message: "Bạn không có quyền xóa bình luận này" });
    }

    await Comment.findByIdAndDelete(req.params.commentId);
    res.json({ message: "Đã xóa bình luận thành công" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server khi xóa bình luận" });
  }
});


// =======================
//  Admin (Giữ nguyên)
// =======================
app.get("/admin/posts", verifyToken, verifyAdmin, async (req, res) => {
  const pending = await Post.find({ approved: false })
    .populate('author', 'username')
    .sort({ createdAt: -1 });
  res.json(pending);
});

app.put("/admin/post/:id", verifyToken, verifyAdmin, async (req, res) => {
  await Post.findByIdAndUpdate(req.params.id, { approved: true });
  res.json({ message: "Đã duyệt bài" });
});

app.delete("/admin/post/:id", verifyToken, verifyAdmin, async (req, res) => {
  const post = await Post.findByIdAndDelete(req.params.id);
  await Comment.deleteMany({ post: req.params.id }); 
  res.json({ message: "Đã xóa bài viết" });
});

// ===============================================
//  Phục vụ File Tĩnh (Thư mục PUBLIC)
// ===============================================

app.use(express.static(path.join(__dirname, "public"))); 

// =======================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

