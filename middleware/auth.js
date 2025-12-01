import jwt from 'jsonwebtoken';
import User from '../models/User.js'; 

// Middleware xác thực token và kiểm tra vai trò
// requiredRole có thể là 'user' hoặc 'admin'
const auth = (requiredRole) => async (req, res, next) => {
  // 1. Lấy header Authorization và trích xuất token
  const authHeader = req.headers.authorization;
  // authHeader có dạng "Bearer <token>"
  const token = authHeader && authHeader.split(' ')[1];
  
  // 2. Xử lý trường hợp KHÔNG CÓ token (Missing token)
  // 🚨 Đây là nguyên nhân chính gây ra lỗi 401 mà bạn đang gặp
  if (!token) {
    return res.status(401).json({ error: 'Missing token' });
  }

  try {
    // 3. Xác thực token với khóa bí mật (JWT_SECRET)
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 4. Gắn thông tin người dùng đã giải mã vào request
    // req.user.id tương ứng với id: user._id trong payload lúc đăng nhập
    req.user = { 
        id: decoded.id, 
        _id: decoded.id, // Thuận tiện khi dùng Mongoose
        username: decoded.username,
        isAdmin: decoded.isAdmin 
    }; 
    
    // 5. Kiểm tra quyền Admin (nếu cần)
    if (requiredRole === 'admin' && req.user.isAdmin !== true) {
      return res.status(403).json({ error: 'Access denied. Admin only.' });
    }
    
    // 6. Cho phép request tiếp tục
    next();
  } catch (err) {
    // 7. Xử lý token không hợp lệ (hết hạn, sai key)
    res.status(403).json({ error: 'Invalid token' });
  }
};

export default auth;