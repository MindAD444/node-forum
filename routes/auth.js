import express from 'express';
import User from '../models/User.js'; 
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { sendMail } from '../utils/mailer.js'; 
import { google } from "googleapis";
import passport from "passport";
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);
const router = express.Router();
const verificationCodes = {}; // Lưu mã xác thực tạm (in-memory)

// 📩 Gửi yêu cầu đăng ký (Bước 1)
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

    res.json({ message: 'Đã gửi mã xác thực tới email của bạn. Mã có hiệu lực 10 phút.' });
  } catch (err) {
    console.error('❌ Lỗi gửi mã xác thực:', err);
    res.status(500).json({ error: 'Không thể gửi mã xác thực. Vui lòng kiểm tra cấu hình email server.' });
  }
});

// ✅ Xác minh mã và tạo tài khoản (Bước 2)
router.post('/register/verify', async (req, res) => {
  try {
    const { email, code } = req.body;
    const record = verificationCodes[email];

    if (!record) return res.status(400).json({ error: 'Không tìm thấy mã xác thực. Vui lòng gửi lại.' });
    
    // Kiểm tra hết hạn (10 phút)
    if (Date.now() - record.createdAt > 10 * 60 * 1000) {
      delete verificationCodes[email];
      return res.status(400).json({ error: 'Mã xác thực đã hết hạn.' });
    }
    if (parseInt(code) !== record.code)
      return res.status(400).json({ error: 'Mã xác thực không đúng.' });

    // Tạo user mới
    const hashed = await bcrypt.hash(record.password, 10);
    const newUser = new User({
      username: record.username,
      email,
      password: hashed,
    });
    await newUser.save();

    delete verificationCodes[email]; 
    res.json({ message: 'Đăng ký thành công.' });
  } catch (err) {
    console.error('❌ Lỗi tạo tài khoản:', err);
    res.status(500).json({ error: 'Lỗi server khi tạo tài khoản.' });
  }
});

// 🔑 Đăng nhập
// GOOGLE LOGIN
// Redirect user to Google login page
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

// Google callback
router.get("/google/callback", passport.authenticate("google", { failureRedirect: "/login.html" }), async (req, res) => {

  // Check if user already has an account
  let user = await User.findOne({ email: req.user.email });

  if (user) {
    // Create login token
    const token = jwt.sign({ userId: user._id, isAdmin: user.isAdmin }, process.env.JWT_SECRET);
    return res.redirect(`/login-success.html?token=${token}&username=${user.username}&userId=${user._id}&isAdmin=${user.isAdmin}`);
  }

  // If user doesn't exist → require username setup
  let pending = await PendingUser.findOne({ email: req.user.email });
  if (!pending) {
    pending = new PendingUser({ googleId: req.user.googleId, email: req.user.email });
    await pending.save();
  }

  return res.redirect(`/choose-username.html?email=${pending.email}`);
});

// Final step: choose username and create real account
router.post("/set-username", async (req, res) => {
  const { email, username } = req.body;
  if (!email || !username) return res.status(400).json({ error: "Thiếu dữ liệu" });

  const exists = await User.findOne({ username });
  if (exists) return res.status(400).json({ error: "Tên đã tồn tại" });

  const pending = await PendingUser.findOne({ email });
  if (!pending) return res.status(404).json({ error: "Không tìm thấy dữ liệu tạm" });

  const user = new User({
    email,
    username,
    googleId: pending.googleId,
    password: null, // login google không cần password
  });
  await user.save();
  await PendingUser.deleteOne({ email });

  const token = jwt.sign({ userId: user._id, isAdmin: false }, process.env.JWT_SECRET);
  res.json({ token, username, userId: user._id });
});
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    // Tìm kiếm bằng username hoặc email
    const user = await User.findOne({ 
        $or: [{ username }, { email: username }] 
    }); 

    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(400).json({ error: 'Sai tên đăng nhập/email hoặc mật khẩu.' });
    }

    const token = jwt.sign(
        { id: user._id, role: user.role, isAdmin: user.isAdmin },
        process.env.JWT_SECRET,
        { expiresIn: '1d' }
    );
    // Trả về ID để dùng trong Frontend cho logic xóa
    res.json({ 
        token, 
        user: { 
            id: user._id, 
            username: user.username, 
            isAdmin: user.isAdmin 
        } 
    });
});

export default router;

