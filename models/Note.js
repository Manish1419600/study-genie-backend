// models/Note.js - Smart Notes Schema (FR5)
const mongoose = require('mongoose');

const NoteSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  title: { type: String, required: true },
  subject: { type: String, default: 'General' },
  fileName: { type: String, required: true },
  fileType: { type: String, default: 'pdf' },
  extractedText: { type: String },
  summary: { type: String, required: true },
  keyConcepts: [{ title: String, description: String }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Note', NoteSchema);
