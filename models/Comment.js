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
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
    default: null,
  },
  content: { 
    type: String, 
    required: true, 
    trim: true,
    maxlength: 669
  },
  mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
});

const Comment = mongoose.model('Comment', commentSchema);
export default Comment;

