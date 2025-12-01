import express from 'express';
import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { sendMail } from '../utils/mailer.js';
import { OAuth2Client } from "google-auth-library";
import { connectDB } from "../config/db.js";
import auth from "../middleware/auth.js"; 

// --- CÁC THƯ VIỆN UPLOAD ẢNH (Mới) ---
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';

const router = express.Router();
const verificationCodes = {};
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// --- CẤU HÌNH CLOUDINARY STORAGE CHO AVATAR ---
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'forum-avatars', // Tên folder trên Cloudinary
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
    // Tạo tên file: avatar-ID_User-Timestamp
    public_id: (req, file) => `avatar-${req.user.id}-${Date.now()}`,
    transformation: [{ width: 500, height: 500, crop: 'limit' }] // Resize nhẹ để tối ưu
  },
});
const upload = multer({ storage: storage });

// ============================================================
// 1. REGISTER (Đăng ký)
// ============================================================

// STEP 1: Gửi mã xác thực
router.post('/register/request', async (req, res) => {
  const { username, email, password } = req.body;

  const existing = await User.findOne({ $or: [{ username }, { email }] });
  if (existing) return res.status(409).json({ error: "Tên hoặc Email đã tồn tại." });

  const code = Math.floor(100000 + Math.random() * 900000);
  verificationCodes[email] = { code, username, password, createdAt: Date.now() };

  await sendMail(email, code);
  res.json({ message: "Mã xác thực đã gửi!" });
});

// STEP 2: Xác thực và tạo user
router.post('/register/verify', async (req, res) => {
  const { email, code } = req.body;
  const record = verificationCodes[email];

  if (!record) return res.status(400).json({ error: "Chưa yêu cầu mã xác thực." });
  if (Date.now() - record.createdAt > 10 * 60 * 1000) return res.status(400).json({ error: "Mã hết hạn." });
  if (parseInt(code) !== record.code) return res.status(400).json({ error: "Mã không đúng." });

  const hashed = await bcrypt.hash(record.password, 10);

  await User.create({ username: record.username, email, password: hashed });

  delete verificationCodes[email];
  res.json({ message: "Đăng ký thành công." });
});

// ============================================================
// 2. LOGIN (Đăng nhập thường)
// ============================================================
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  // Tìm theo username HOẶC email
  const user = await User.findOne({ $or: [{ username }, { email: username }] });

  if (!user || !(await bcrypt.compare(password, user.password)))
    return res.status(400).json({ error: "Sai thông tin đăng nhập." });

  const token = jwt.sign(
    { id: user._id, username: user.username, isAdmin: user.isAdmin },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.json({ 
    token, 
    user: { 
      id: user._id, 
      username: user.username, 
      avatar: user.avatar, // Trả về avatar
      isAdmin: user.isAdmin 
    } 
  });
});

// ============================================================
// 3. GOOGLE LOGIN
// ============================================================
router.post("/google-login", async (req, res) => {
  try {
    const { id_token } = req.body;

    const ticket = await googleClient.verifyIdToken({
      idToken: id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const data = ticket.getPayload();
    const email = data.email;
    const googleId = data.sub;

    let user = await User.findOne({ email });

    if (!user) {
      // User chưa có → yêu cầu chọn tên
      return res.json({
        status: "NEW_USER",
        email,
        googleId
      });
    }

    // User đã tồn tại → login bình thường
    const token = jwt.sign(
      { id: user._id, username: user.username, isAdmin: user.isAdmin },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      status: "OK",
      token,
      user: { 
        id: user._id, 
        username: user.username, 
        avatar: user.avatar,
        isAdmin: user.isAdmin 
      }
    });

  } catch (err) {
    console.error("Google Login Error:", err);
    return res.status(400).json({ error: "Đăng nhập Google thất bại." });
  }
});

// Set username cho lần đầu login Google
router.post("/set-username", async (req, res) => {
  const { email, googleId, username } = req.body;

  const exists = await User.findOne({ username });
  if (exists) return res.status(400).json({ error: "Tên đã tồn tại." });

  const user = await User.create({ email, googleId, username });

  const token = jwt.sign(
    { id: user._id, username: user.username, isAdmin: user.isAdmin },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  return res.json({
    success: true,
    token,
    user: { id: user._id, username: user.username, isAdmin: user.isAdmin }
  });
});

// ============================================================
// 4. PROFILE USER (MỚI)
// ============================================================

// [GET] /auth/me - Lấy thông tin cá nhân
router.get('/me', auth('user'), async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ error: "Không tìm thấy người dùng" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: "Lỗi server" });
  }
});

// [PUT] /auth/me - Cập nhật thông tin (Tên & Avatar)
// Middleware 'upload.single('avatar')' sẽ xử lý file gửi lên có key là 'avatar'
router.put('/me', auth('user'), upload.single('avatar'), async (req, res) => {
  try {
    const { username } = req.body;
    const updateData = {};

    // 1. Xử lý đổi tên (nếu có gửi lên)
    if (username) {
      // Kiểm tra trùng tên (trừ tên hiện tại của chính mình)
      const existingUser = await User.findOne({ username, _id: { $ne: req.user.id } });
      if (existingUser) {
        return res.status(400).json({ error: "Tên người dùng đã tồn tại." });
      }
      updateData.username = username;
    }

    // 2. Xử lý đổi Avatar (nếu có file upload lên)
    if (req.file) {
      // Multer + Cloudinary đã tự động upload và trả về path (url ảnh)
      updateData.avatar = req.file.path;
    }

    // 3. Cập nhật vào DB
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      updateData,
      { new: true } // Trả về data mới sau khi update
    ).select('-password');

    res.json({ 
      message: "✅ Cập nhật hồ sơ thành công!", 
      user: updatedUser 
    });

  } catch (err) {
    console.error("Update Profile Error:", err);
    res.status(500).json({ error: "Lỗi server khi cập nhật profile" });
  }
});

export default router;