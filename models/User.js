import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, sparse: true },
  email: { type: String, unique: true, sparse: true },
  password: { type: String },
  googleId: { type: String, unique: true, sparse: true },
  isAdmin: { type: Boolean, default: false }
}, { timestamps: true });

export default mongoose.model("User", userSchema);
