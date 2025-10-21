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
// import fs from "fs-extra"; // Đã bỏ: Không còn lưu file cục bộ
import multer from "multer";
import { fileURLToPath } from "url";
// THÊM: Cloudinary imports
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
// THÊM: Nodemailer import
import nodemailer from "nodemailer"; 


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
//  Cấu hình Gửi Email Xác Thực (OTP)
// =======================
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // Mật khẩu ứng dụng (App Password)
  },
});

transporter.verify((error, success) => {
  if (error) console.error("❌ Lỗi SMTP:", error);
  else console.log("📨 Gmail SMTP hoạt động.");
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
  email: { type: String, unique: true, required: false } // THÊM EMAIL
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


// =======================
//  Hàm tiện ích
// =======================
/**
 * Trích xuất public_id từ URL của Cloudinary để xóa file.
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
//  Routes: Auth
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


// =======================
//  Đăng ký bằng Email Xác Thực (OTP)
// =======================
const verificationCodes = {}; // Bộ nhớ tạm để lưu mã OTP

app.post("/register/request", async (req, res) => { 
  try {
    const { username, email, password } = req.body; 

    if (!username || !email || !password)
      return res.status(400).json({ message: "Thiếu thông tin đăng ký" });

    // Kiểm tra tên người dùng đã tồn tại
    const existingUsername = await User.findOne({ username });
    if (existingUsername) return res.status(400).json({ message: "Tên người dùng đã tồn tại" });
    
    // Kiểm tra email đã tồn tại
    const existingEmail = await User.findOne({ email });
    if (existingEmail) return res.status(400).json({ message: "Email đã được sử dụng." });


    const code = Math.floor(100000 + Math.random() * 900000);
    
    // Lưu tạm thời thông tin user và mã OTP
    verificationCodes[email] = {
      code,
      username,
      password,
      createdAt: Date.now(),
    };

    const mailOptions = {
      from: `"Forum" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Mã xác thực tài khoản Forum",
      html: `
        <div style="font-family:Arial,sans-serif;padding:16px;background:#f5f5f5">
          <h2 style="color:#007bff">Xin chào ${username}!</h2>
          <p>Bạn vừa yêu cầu đăng ký tài khoản Forum.</p>
          <p>Mã xác thực của bạn là:</p>
          <h1 style="letter-spacing:3px">${code}</h1>
          <p>Mã này có hiệu lực trong 10 phút.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    res.json({ message: "✅ Đã gửi mã xác thực đến email của bạn." });
  } catch (err) {
    console.error("❌ Lỗi gửi mã:", err);
    res.status(500).json({ message: "Không thể gửi mã xác thực. Vui lòng kiểm tra email hợp lệ." });
  }
});

app.post("/register/verify", async (req, res) => { 
  try {
    const { email, code } = req.body;
    const record = verificationCodes[email];
    
    if (!record)
      return res.status(400).json({ message: "Không tìm thấy yêu cầu xác thực. Vui lòng yêu cầu lại." });

    if (Date.now() - record.createdAt > 10 * 60 * 1000) {
        delete verificationCodes[email];
        return res.status(400).json({ message: "Mã xác thực đã hết hạn." });
    }

    if (parseInt(code) !== record.code)
      return res.status(400).json({ message: "Mã xác thực không đúng." });

    // Tạo tài khoản
    const hashed = await bcrypt.hash(record.password, 10);
    await new User({
      username: record.username,
      email: email, // Lưu email vào DB
      password: hashed,
      isAdmin: false,
    }).save();

    delete verificationCodes[email];
    res.json({ message: "🎉 Đăng ký thành công!" });
  } catch (err) {
    console.error("❌ Lỗi xác minh mã:", err);
    res.status(500).json({ message: "Lỗi xác minh mã. Vui lòng thử lại." });
  }
});


app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body; // username có thể là username HOẶC email
    
    // Tìm kiếm user bằng username HOẶC email
    const user = await User.findOne({ 
        $or: [
            { username: username }, // Trường hợp nhập tên đăng nhập
            { email: username }     // Trường hợp nhập email
        ]
    });
    
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
        return res.status(400).json({ message: "Thiếu tiêu đề hoặc nội dung" });
    }
    
    // Lấy URL công khai từ Cloudinary
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
    
    // Xóa files trên Cloudinary
    if (post.files && post.files.length > 0) {
        for (const filePath of post.files) {
            const publicId = extractPublicId(filePath);
            if (publicId) {
                // Xóa cả image và raw file (để bao quát PDF/DOCX)
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
//  Routes: Comments
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
//  Admin
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

