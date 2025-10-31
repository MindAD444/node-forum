import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { v2 as cloudinary } from "cloudinary";
import session from "express-session";
import passport from "passport";
import authRoutes from "./routes/auth.js";
import postRoutes from "./routes/posts.js";
import adminRoutes from "./routes/admin.js";
import commentRoutes from "./routes/comments.js";

dotenv.config();
const app = express();
import configureGoogleAuth from "./config/google.js";
// Middleware chung
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// SESSION (phải đặt trước passport)
app.use(session({
  secret: process.env.SESSION_SECRET || "super-secret",
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // quan trọng cho local test
}));

// Cấu hình Passport
configureGoogleAuth();
app.use(passport.initialize());
app.use(passport.session());

// __dirname cho ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cloudinary
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

// Routes
app.use("/auth", authRoutes);
app.use("/posts", postRoutes);
app.use("/admin", adminRoutes);
app.use("/comments", commentRoutes);

// Static frontend
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
