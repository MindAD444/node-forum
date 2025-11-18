import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, unique: true },
  password: { type: String }, // Có thể rỗng nếu đăng nhập bằng Google
  googleId: { type: String, unique: true, sparse: true },
  isAdmin: {
    type: Boolean,
    default: false
  },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("User", userSchema);
