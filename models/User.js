// models/User.js
import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, unique: true },
  password: { type: String },
  googleId: { type: String, unique: true, sparse: true },
  avatar: { 
    type: String, 
    default: "https://cdn.britannica.com/99/236599-050-1199AD2C/Mark-Zuckerberg-2019.jpg" 
  },
  usernameLastChangedAt: { type: Date, default: Date.now },
  usernameChangeCount: { type: Number, default: 0 },

  // --- THAY ĐỔI Ở ĐÂY ---
  role: {
    type: String,
    enum: ["user", "admin"], // Chỉ cho phép 2 giá trị này
    default: "user"
  },
  // ----------------------

  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("User", userSchema);