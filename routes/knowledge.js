// routes/knowledge.js
import express from 'express';
import Parser from 'rss-parser';

const router = express.Router();        // DÒNG NÀY BỊ THIẾU TRƯỚC ĐÓ
const parser = new Parser();

const feeds = {
  tech: 'https://hnrss.org/newest',
  science: 'https://www.sciencedaily.com/rss/all.xml',
  health: 'https://medlineplus.gov/rss/healthdaylatest.xml',
  vn: 'https://vnexpress.net/rss/khoa-hoc.rss'
};

router.get('/knowledge', async (req, res) => {
  const category = req.query.category || 'tech';
  const url = feeds[category] || feeds.tech;

  try {
    const feed = await parser.parseURL(url);
    const items = feed.items.slice(0, 5).map(item => ({
      title: item.title,
      link: item.link,
      desc: (item.contentSnippet || item.content || '').slice(0, 150) + '...',
      date: new Date(item.pubDate || item.isoDate).toLocaleDateString('vi-VN')
    }));
    res.json(items);
  } catch (err) {
    console.error('Lỗi RSS:', err.message);
    res.json([]); // trả mảng rỗng để frontend không crash
  }
});

export default router;
