import express from 'express';
import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { sendMail } from '../utils/mailer.js';
import { OAuth2Client } from "google-auth-library";
import { connectDB } from "../config/db.js";
await connectDB();

const router = express.Router();
const verificationCodes = {};
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ---------------- REGISTER STEP 1 ----------------
router.post('/register/request', async (req, res) => {
  const { username, email, password } = req.body;

  const existing = await User.findOne({ $or: [{ username }, { email }] });
  if (existing) return res.status(409).json({ error: "Tên hoặc Email đã tồn tại." });

  const code = Math.floor(100000 + Math.random() * 900000);
  verificationCodes[email] = { code, username, password, createdAt: Date.now() };

  await sendMail(email, code);
  res.json({ message: "Mã xác thực đã gửi!" });
});

// ---------------- REGISTER STEP 2 ----------------
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

// ---------------- LOGIN (NORMAL) ----------------
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ $or: [{ username }, { email: username }] });

  if (!user || !(await bcrypt.compare(password, user.password)))
    return res.status(400).json({ error: "Sai thông tin đăng nhập." });

  const token = jwt.sign(
    { id: user._id, username: user.username, isAdmin: user.isAdmin },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.json({ token, user: { id: user._id, username: user.username, isAdmin: user.isAdmin } });
});

// ---------------- GOOGLE LOGIN ----------------
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
      user: { id: user._id, username: user.username, isAdmin: user.isAdmin }
    });

  } catch (err) {
    console.error("Google Login Error:", err);
    return res.status(400).json({ error: "Đăng nhập Google thất bại." });
  }
});

// ---------------- GOOGLE SET USERNAME (FIRST TIME LOGIN) ----------------
router.post("/set-username", async (req, res) => {
  const { email, googleId, username } = req.body;

  const exists = await User.findOne({ username });
  if (exists) return res.status(400).json({ error: "Tên đã tồn tại." });

  const user = await User.create({ email, googleId, username });

  // ✅ Tạo token và trả về client
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
export default router;
