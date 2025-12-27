import express from 'express';
import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { sendMail } from '../utils/mailer.js';
import { OAuth2Client } from "google-auth-library";
import { connectDB } from "../config/db.js"; // Giữ import nhưng KHÔNG gọi await ở đây
import auth from "../middleware/auth.js"; 

// --- CÁC THƯ VIỆN UPLOAD ẢNH ---
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';

const router = express.Router();
const verificationCodes = {}; // Cache mã xác thực đăng ký
const resetCodes = {};        // Cache mã xác thực quên mật khẩu
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// --- CẤU HÌNH CLOUDINARY STORAGE CHO AVATAR ---
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'forum-avatars',
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
    public_id: (req, file) => `avatar-${req.user.id}-${Date.now()}`,
    transformation: [{ width: 500, height: 500, crop: 'limit' }]
  },
});
const upload = multer({ storage: storage });

// ============================================================
// 1. REGISTER (ĐĂNG KÝ)
// ============================================================

// STEP 1: Gửi mã xác thực
router.post('/register/request', async (req, res) => {
  const { username, email, password } = req.body;

  // CHỈ kiểm tra trùng Email, CHO PHÉP trùng Username
  const existingEmail = await User.findOne({ email });
  if (existingEmail) return res.status(409).json({ error: "Email đã tồn tại." });

  // Kiểm tra tên cấm (tùy chọn)
  if (username.toLowerCase() === 'admin' || username.toLowerCase() === 'mod') {
    return res.status(400).json({ error: "Tên người dùng không hợp lệ." });
  }

  const code = Math.floor(100000 + Math.random() * 900000);
  verificationCodes[email] = { code, username, password, createdAt: Date.now() };

  try {
    await sendMail(email, `Mã xác thực đăng ký của bạn là: ${code}`);
    res.json({ message: "Mã xác thực đã gửi!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi gửi email." });
  }
});

// STEP 2: Xác thực và tạo user
router.post('/register/verify', async (req, res) => {
  const { email, code } = req.body;
  const record = verificationCodes[email];

  if (!record) return res.status(400).json({ error: "Chưa yêu cầu mã." });
  if (Date.now() - record.createdAt > 10 * 60 * 1000) return res.status(400).json({ error: "Mã hết hạn." });
  if (parseInt(code) !== record.code) return res.status(400).json({ error: "Mã không đúng." });

  const hashed = await bcrypt.hash(record.password, 10);

  await User.create({ 
    username: record.username, 
    email, 
    password: hashed,
    // Avatar mặc định tạo từ tên
    avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(record.username)}&background=random`
  });

  delete verificationCodes[email];
  res.json({ message: "Đăng ký thành công." });
});

// ============================================================
// 2. LOGIN (ĐĂNG NHẬP)
// ============================================================
router.post('/login', async (req, res) => {
  const { username, password, remember } = req.body;
  
  // Tìm user theo username HOẶC email
  // Lưu ý: Nếu có nhiều người cùng username, logic này sẽ lấy người đầu tiên tìm thấy.
  // Khuyến khích đăng nhập bằng Email nếu cho phép trùng tên.
  const user = await User.findOne({ $or: [{ username }, { email: username }] });

  if (!user || !(await bcrypt.compare(password, user.password)))
    return res.status(400).json({ error: "Sai thông tin đăng nhập." });

 const expires = remember ? '30d' : '1d';
 const token = jwt.sign({ id: user._id, username: user.username, role: user.role }, process.env.JWT_SECRET, { expiresIn: expires });

 // Set HttpOnly cookie for the token
 const maxAge = remember ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000; // 30d or 1d
 res.cookie('token', token, {
   httpOnly: true,
   sameSite: 'Lax',
   secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
   maxAge
 });

 // Return user info (token is stored in HttpOnly cookie)
 res.json({
   user: {
     id: user._id,
     username: user.username,
     role: user.role,
     avatar: user.avatar
   }
 });
});

// ============================================================
// 3. GOOGLE LOGIN
// ============================================================
router.post("/google-login", async (req, res) => {
  try {
    const { id_token, remember } = req.body;
    let ticket;
    try {
      ticket = await googleClient.verifyIdToken({
        idToken: id_token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
    } catch (verifyErr) {
      // Try to decode token payload for debugging (no signature verification)
      try {
        const parts = id_token.split('.');
        const payloadJson = Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
        const payloadCandidate = JSON.parse(payloadJson);
        console.error('Google Login Error: verifyIdToken failed. Expected audience:', process.env.GOOGLE_CLIENT_ID, ' Token aud:', payloadCandidate.aud);
        return res.status(400).json({ error: 'Google token audience mismatch. Expected GOOGLE_CLIENT_ID does not match token audience. Check your client ID configuration.' });
      } catch (decodeErr) {
        console.error('Google Login Error (verify):', verifyErr);
        return res.status(400).json({ error: 'Google token verification failed.' });
      }
    }

    const payload = ticket.getPayload();
    const { email, sub: googleId, picture } = payload;
    let user = await User.findOne({ email });

    if (!user) {
      return res.json({ status: "NEW_USER", email, googleId });
    }

    // If Google provides a profile picture and user doesn't have an avatar saved,
    // update the user's avatar to the Google picture (only if not already set).
    if (picture && (!user.avatar || user.avatar.startsWith('https://ui-avatars.com'))) {
      user.avatar = picture;
      await user.save();
    }

    const expires = remember ? '30d' : '1d';
    const token = jwt.sign({ id: user._id, username: user.username, role: user.role }, process.env.JWT_SECRET, { expiresIn: expires });

    // Set HttpOnly cookie
    const maxAge = remember ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'Lax',
      secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
      maxAge
    });

    return res.json({
      status: "OK",
      user: { id: user._id, username: user.username, avatar: user.avatar, role: user.role }
    });

  } catch (err) {
    console.error("Google Login Error:", err);
    return res.status(400).json({ error: "Đăng nhập Google thất bại." });
  }
});

// Set username cho lần đầu login Google (CHO PHÉP TRÙNG TÊN)
router.post("/set-username", async (req, res) => {
  const { email, googleId, username, remember } = req.body;

  // BỎ kiểm tra trùng username
  const user = await User.create({ 
    email, 
    googleId, 
    username,
    avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=random`
  });

  const expires = remember ? '30d' : '1d';
  const token = jwt.sign({ id: user._id, username: user.username, role: user.role }, process.env.JWT_SECRET, { expiresIn: expires });
  const maxAge = remember ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
    maxAge
  });

  return res.json({ success: true, user: { id: user._id, username: user.username, role: user.role, avatar: user.avatar } });
});

// Logout (clear HttpOnly cookie)
router.post('/logout', (req, res) => {
  res.clearCookie('token', { path: '/' });
  res.json({ success: true, message: 'Đã đăng xuất.' });
});

// ============================================================
// 4. QUÊN MẬT KHẨU (FORGOT PASSWORD)
// ============================================================

// BƯỚC 1: Yêu cầu & Gửi mã
router.post('/forgot-password/request', async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  
  if (!user) {
    // Trả về thành công ảo để bảo mật
    return res.json({ message: "Nếu email tồn tại, mã xác thực đã được gửi." });
  }

  const code = Math.floor(100000 + Math.random() * 900000);
  resetCodes[email] = { code, createdAt: Date.now() };

  try {
    await sendMail(email, `Mã đổi mật khẩu: ${code} (Hết hạn trong 5 phút)`);
    res.json({ message: "Mã xác thực đã được gửi!" });
  } catch (err) {
    res.status(500).json({ error: "Lỗi server khi gửi email." });
  }
});

// BƯỚC 2: Xác thực & Đổi mật khẩu
router.post('/forgot-password/reset', async (req, res) => {
  const { email, code, newPassword } = req.body;
  const record = resetCodes[email];
  
  if (!record || record.code.toString() !== code.toString()) {
    return res.status(400).json({ error: "Mã xác thực không đúng." });
  }
  if (Date.now() - record.createdAt > 5 * 60 * 1000) { // 5 phút
    delete resetCodes[email];
    return res.status(400).json({ error: "Mã đã hết hạn." });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "User không tồn tại." });

    const hashed = await bcrypt.hash(newPassword, 10);
    user.password = hashed;
    await user.save();

    delete resetCodes[email];
    res.json({ message: "✅ Đổi mật khẩu thành công!" });
  } catch (err) {
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ============================================================
// 5. PROFILE USER
// ============================================================

// [GET] /auth/me - Lấy thông tin
router.get('/me', auth('user'), async (req, res) => {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
});

// [PUT] /auth/me - Cập nhật thông tin (Tên & Avatar)
// Middleware 'upload.single('avatar')' sẽ xử lý file gửi lên có key là 'avatar'
router.put('/me', auth('user'), upload.single('avatar'), async (req, res) => {
  try {
    const { username } = req.body;
    const updateData = {};

    // Load user data để kiểm tra lịch sử đổi tên
    const user = await User.findById(req.user._id); 
    if (!user) return res.status(404).json({ error: "Không tìm thấy người dùng." });

    // 1. Xử lý đổi tên (nếu có gửi lên và khác tên cũ)
    if (username && username.trim() && username !== user.username) {
      // Kiểm tra trùng tên (trừ tên hiện tại của chính mình)
      const existingUser = await User.findOne({ username: username.trim(), _id: { $ne: req.user.id } });
      if (existingUser) {
        return res.status(400).json({ error: "Tên người dùng đã tồn tại." });
      }

      // --- LOGIC CHẶN ĐỔI TÊN THEO THỜI GIAN (7 ngày & 14 ngày) ---
      const now = Date.now();
      const lastChanged = user.usernameLastChangedAt ? user.usernameLastChangedAt.getTime() : user.createdAt.getTime();
      const oneDay = 24 * 60 * 60 * 1000;
      
      let cooldownDays = 0;
      if (user.usernameChangeCount === 0) {
        // Lần đổi tên thứ nhất (sau khi đăng ký/đặt tên lần đầu). Cho phép đổi luôn.
        cooldownDays = 0; 
      } else if (user.usernameChangeCount === 1) {
        // Lần đổi tên thứ hai: Cooldown 7 ngày
        cooldownDays = 7;
      } else {
        // Lần đổi tên thứ ba trở đi: Cooldown 14 ngày
        cooldownDays = 14;
      }

      const cooldownDuration = cooldownDays * oneDay;
      const nextChangeTime = lastChanged + cooldownDuration;

      if (cooldownDays > 0 && now < nextChangeTime) {
        const remainingTimeMs = nextChangeTime - now;
        const remainingDays = Math.ceil(remainingTimeMs / oneDay);
        return res.status(403).json({ 
          error: `Bạn chỉ có thể đổi tên sau ${cooldownDays} ngày. Vui lòng đợi thêm khoảng ${remainingDays} ngày nữa.` 
        });
      }
      
      // Nếu pass: Cập nhật tên và thời gian/số lần đổi
      updateData.username = username.trim();
      updateData.usernameLastChangedAt = now;
      updateData.$inc = { usernameChangeCount: 1 }; // Tăng số lần đổi
      // -------------------------------------------------------------------
    }

    // 2. Xử lý đổi Avatar
    if (req.file) {
      updateData.avatar = req.file.path;
    }

    // 3. Cập nhật vào DB
    // Cần phải xử lý $inc (nếu có) riêng biệt trong findByIdAndUpdate
    const incData = updateData.$inc;
    delete updateData.$inc;

    const updateQuery = { ...updateData };
    if (incData) {
        updateQuery.$inc = incData;
    }

    // Nếu không có gì để update, trả về luôn
    if (Object.keys(updateQuery).length === 0 && !updateQuery.$inc) {
        return res.json({ message: "Không có thay đổi nào được gửi lên." });
    }


    const updatedUser = await User.findByIdAndUpdate(
      req.user.id, 
      updateQuery, 
      { new: true, runValidators: true }
    );
    
    if (!updatedUser) {
        return res.status(404).json({ error: "Lỗi cập nhật người dùng." });
    }

    res.json({
      message: "Cập nhật thành công!",
      user: {
        id: updatedUser._id,
        username: updatedUser.username,
        role: updatedUser.role,
        avatar: updatedUser.avatar
      }
    });
  } catch (err) {
    console.error("PUT /auth/me error:", err);
    res.status(500).json({ error: "Lỗi server khi cập nhật hồ sơ" });
  }
});
// ============================================================
// 6. ĐỔI MẬT KHẨU (CHANGE PASSWORD)
// ============================================================
router.put('/change-password', auth('user'), async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    // Tìm user trong DB (cần lấy cả trường password để so sánh)
    const user = await User.findById(req.user.id);

    if (!user) return res.status(404).json({ error: "Người dùng không tồn tại." });

    // Nếu user này đăng nhập bằng Google (không có password), cho phép đặt mật khẩu mới
    if (!user.password) {
      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: "Mật khẩu mới phải có ít nhất 6 ký tự." });
      }
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);
      user.password = hashedPassword;
      await user.save();
      return res.json({ message: "Đã thiết lập mật khẩu mới cho tài khoản. Bạn có thể đăng nhập bằng mật khẩu này." });
    }

    // 1. Kiểm tra mật khẩu hiện tại
    if (!currentPassword) {
      return res.status(400).json({ error: "Vui lòng cung cấp mật khẩu hiện tại." });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Mật khẩu hiện tại không đúng." });
    }

    // 2. Hash mật khẩu mới
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // 3. Cập nhật và lưu
    user.password = hashedPassword;
    await user.save();

    res.json({ message: "Đổi mật khẩu thành công!" });

  } catch (err) {
    console.error("Change Password Error:", err);
    res.status(500).json({ error: "Lỗi server khi đổi mật khẩu." });
  }
});

export default router;