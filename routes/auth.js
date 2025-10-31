import express from 'express';
import User from '../models/User.js'; 
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { sendMail } from '../utils/mailer.js'; 
import { OAuth2Client } from "google-auth-library";

const router = express.Router();
const verificationCodes = {};

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ======================= REGISTER STEP 1 =======================
router.post('/register/request', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    // Kiểm tra tồn tại
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
        return res.status(409).json({ error: 'Tên đăng nhập hoặc Email đã được sử dụng.' });
    }

    const code = Math.floor(100000 + Math.random() * 900000);
    verificationCodes[email] = { code, username, password, createdAt: Date.now() };

    await sendMail(email, code);
    res.json({ message: 'Đã gửi mã xác thực tới email của bạn.' });
  } catch (err) {
    res.status(500).json({ error: 'Không thể gửi mã xác thực.' });
  }
});

// ======================= REGISTER STEP 2 =======================
router.post('/register/verify', async (req, res) => {
  try {
    const { email, code } = req.body;
    const record = verificationCodes[email];
    if (!record) return res.status(400).json({ error: 'Vui lòng yêu cầu lại mã xác thực.' });

    if (Date.now() - record.createdAt > 10 * 60 * 1000)
      return res.status(400).json({ error: 'Mã xác thực đã hết hạn.' });

    if (parseInt(code) !== record.code)
      return res.status(400).json({ error: 'Mã xác thực không đúng.' });

    const hashed = await bcrypt.hash(record.password, 10);
    await User.create({ username: record.username, email, password: hashed });
    delete verificationCodes[email];

    res.json({ message: 'Đăng ký thành công.' });
  } catch {
    res.status(500).json({ error: 'Lỗi tạo tài khoản.' });
  }
});

// ======================= LOGIN =======================
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  const user = await User.findOne({ 
    $or: [{ username }, { email: username }]
  });

  if (!user || !(await bcrypt.compare(password, user.password)))
    return res.status(400).json({ error: 'Sai thông tin đăng nhập.' });

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });

  res.json({ token, user: { id: user._id, username: user.username }});
});

// ======================= GOOGLE LOGIN =======================
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
      // User mới → chuyển đến trang đặt username
      return res.json({ newUser: true, email, googleId });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.cookie("token", token, { httpOnly: true, sameSite: "lax" });

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(400).json({ error: "Google Login Failed" });
  }
});

// ======================= SET USERNAME (NEW GOOGLE USER) =======================
router.post("/set-username", async (req, res) => {
  const { email, googleId, username } = req.body;

  const exists = await User.findOne({ username });
  if (exists) return res.status(400).json({ error: "Tên đã tồn tại." });

  const user = await User.create({ email, googleId, username });

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
  res.cookie("token", token, { httpOnly: true, sameSite: "lax" });

  res.json({ success: true });
});

export default router;
