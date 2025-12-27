import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from 'cookie-parser';
import path from "path";
import { fileURLToPath } from "url";
import { v2 as cloudinary } from "cloudinary";
import authRoutes from "./routes/auth.js";
import postRoutes from "./routes/posts.js";
import knowledgeRoutes from "./routes/knowledge.js";
import adminRoutes from "./routes/admin.js";
import commentRoutes from "./routes/comments.js";
import { connectDB } from "./config/db.js";
import sitemapRoute from "./routes/sitemap.js";
import autoModerateRoutes from './routes/auto-moderate.js';

dotenv.config();

// 👉 BẮT BUỘC await để Mongoose connect xong trước khi xử lý route
await connectDB();

const app = express();

// Allow credentials for cookie-based auth; keep origin flexible for local dev
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

app.use("/auth", authRoutes);
app.use("/", sitemapRoute);
app.use("/posts", postRoutes);
app.use("/admin", adminRoutes);
app.use("/comments", commentRoutes);
app.use('/information', knowledgeRoutes);
app.use('/admin/auto-moderate', autoModerateRoutes);

app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
