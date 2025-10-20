// middleware/admin.js
module.exports = (req, res, next) => {
  // req.user có thể là decoded token (id, role) hoặc object user nếu bạn thay auth để fetch DB
  const user = req.user || {};
  // check role in token or isAdmin flag (if you later populate full user)
  if (!user || (user.role !== 'admin' && user.isAdmin !== true)) {
    return res.status(403).json({ message: 'Access denied. Admin only.' });
  }
  next();
};
