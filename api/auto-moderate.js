import Post from '../../models/Post.js';
import 'dotenv/config';
import fetch from 'node-fetch';

// --- COPY HÀM HỖ TRỢ VÀ HÀM moderateWithAI + cleanupRejectedPosts từ routes/auto-moderate.js ---

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  await cleanupRejectedPosts();

  try {
    const pending = await Post.find({
      approved: false,
      moderatedAt: { $exists: false }
    }).limit(5);

    if (pending.length === 0) {
      return res.status(200).json({ message: "Không có bài mới cần duyệt." });
    }

    console.log(`[CRON] Bắt đầu duyệt ${pending.length} bài...`);
    for (const post of pending) {
      await moderateWithAI(post);
    }

    res.status(200).json({
      message: `Đã xử lý xong batch ${pending.length} bài.`,
      processed: pending.length
    });

  } catch (err) {
    console.error('Lỗi cron job:', err);
    res.status(500).json({ error: 'Lỗi server' });
  }
}