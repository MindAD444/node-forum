import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { v2 as cloudinary } from "cloudinary";
import authRoutes from "./routes/auth.js";
import postRoutes from "./routes/posts.js";
import adminRoutes from "./routes/admin.js";
import commentRoutes from "./routes/comments.js"; // MỚI: Route Bình luận

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// __dirname cho ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cấu hình Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// MongoDB 
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("MongoDB error:", err));

// ĐĂNG KÝ ROUTE HANDLERS
app.use("/auth", authRoutes);
app.use("/posts", postRoutes);
app.use("/admin", adminRoutes);
app.use("/comments", commentRoutes); 

// Phục vụ File Tĩnh (Frontend)
app.use(express.static(path.join(__dirname, "public"))); 

// Khởi động Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

