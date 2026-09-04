const mongoose = require('mongoose');

// Define the blueprint for the Link collection
const linkSchema = new mongoose.Schema({
  url: {
    type: String,
    required: [true, 'URL is required'],
    trim: true
  },
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [150, 'Title cannot exceed 150 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters'],
    default: ''
  },
  category: {
    type: String,
    trim: true,
    default: 'General'
  },
  tags: {
    type: [String],
    default: []
  },
  // Optional Open Graph image URL extracted during link creation
  image: {
    type: String,
    default: ''
  },
  visibility: {
    type: String,
    required: [true, 'Visibility is required'],
    enum: {
      values: ['public', 'private'],
      message: 'Visibility must be either public or private'
    },
    default: 'public'
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Link must belong to an owner']
  },
  views: {
    type: Number,
    default: 0
  },
  likes: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

/**
 * Text index — enables full-text $text search across title, description, and tags.
 * Without this index, MongoDB would need to scan every document in the collection
 * one by one to match text, which becomes very slow as the database grows.
 * With the index, MongoDB pre-builds a searchable word map, making text searches fast.
 */
linkSchema.index(
  { title: 'text', description: 'text', tags: 'text' },
  { name: 'link_text_search' }
);

// Compile the schema into a Mongoose Model
const Link = mongoose.model('Link', linkSchema);

module.exports = Link;
