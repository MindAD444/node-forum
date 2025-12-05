// models/User.js

import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, unique: true },
  password: { type: String }, // Có thể rỗng nếu đăng nhập bằng Google
  googleId: { type: String, unique: true, sparse: true },
  
  // --- THÊM TRƯỜNG AVATAR ---
  avatar: { 
    type: String, 
    default: "https://ui-avatars.com/api/?name=User&background=random" // Ảnh mặc định nếu chưa có
  },
  
  // 🔑 --- THÊM TRƯỜNG CHO CHÍNH SÁCH ĐỔI TÊN NGƯỜI DÙNG ---
  usernameLastChangedAt: { type: Date, default: Date.now }, // Lần cuối đổi tên (hoặc đăng ký/đặt tên lần đầu)
  usernameChangeCount: { type: Number, default: 0 }, // Số lần đổi tên sau lần đăng ký
  // --------------------------------------------------------

  isAdmin: {
    type: Boolean,
    default: false
  },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("User", userSchema);