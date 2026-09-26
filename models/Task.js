// models/Task.js - Study Task Schema (FR2)
const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  title: { type: String, required: true },
  subject: { type: String, required: true },
  date: { type: String, required: true }, // Format: YYYY-MM-DD
  time: { type: String, default: '10:00 AM' },
  duration: { type: Number, default: 1.5 }, // Hours
  priority: { type: String, enum: ['High', 'Medium', 'Low'], default: 'Medium' },
  completed: { type: Boolean, default: false },
  reminder: { type: String, default: '30 mins before' },
  category: { type: String, default: 'Study Session' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Task', TaskSchema);
