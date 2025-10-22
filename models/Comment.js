import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema({
  post: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Post', 
    required: true 
  },
  author: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  content: { 
    type: String, 
    required: true, 
    trim: true,
    maxlength: 500
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
});

const Comment = mongoose.model('Comment', commentSchema);
export default Comment;

