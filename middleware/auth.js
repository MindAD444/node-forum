import jwt from 'jsonwebtoken';
import User from '../models/User.js'; 
// Middleware xác thực token và kiểm tra vai trò
const auth = (requiredRole) => async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Missing token' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Lưu ý: Chỉ fetch user nếu cần thông tin đầy đủ, hoặc dùng decoded.id
    req.user = { 
        _id: decoded.id, 
        role: decoded.role, 
        isAdmin: decoded.isAdmin 
    }; 
    
    // Kiểm tra quyền Admin
    if (requiredRole === 'admin' && req.user.isAdmin !== true) {
      return res.status(403).json({ error: 'Access denied. Admin only.' });
    }
    
    next();
  } catch (err) {
    res.status(403).json({ error: 'Invalid token' });
  }
};

export default auth; 
