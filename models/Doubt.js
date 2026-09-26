// models/Doubt.js - Doubt History & Auto-FAQ Schema (FR3 & FR4)
const mongoose = require('mongoose');

const DoubtSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  question: { type: String, required: true },
  normalizedQuestion: { type: String, required: true, index: true },
  answer: {
    equation: String,
    equationSubtitle: String,
    explanation: { type: String, required: true },
    keyPoints: [{ title: String, text: String }],
    hasGraph: Boolean,
    graphTitle: String,
    graphState: String
  },
  subject: { type: String, default: 'General Academic' },
  isAutoFaqMatch: { type: Boolean, default: false },
  useCount: { type: Number, default: 1 },
  savedToNotes: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Doubt', DoubtSchema);
