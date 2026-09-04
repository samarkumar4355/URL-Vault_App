const mongoose = require('mongoose');

// Define the blueprint for the Like relationship collection
const likeSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Like must belong to a user']
  },
  link: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Link',
    required: [true, 'Like must be associated with a link']
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Compound unique index on user and link
// Ensures a user can like a particular link only once at the database level
likeSchema.index({ user: 1, link: 1 }, { unique: true });

const Like = mongoose.model('Like', likeSchema);

module.exports = Like;
