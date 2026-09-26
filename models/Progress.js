// models/Progress.js - Progress Tracking Dashboard Schema (FR7)
const mongoose = require('mongoose');

const SubjectStatSchema = new mongoose.Schema({
  subject: { type: String, required: true },
  hoursSpent: { type: Number, default: 0 },
  quizCount: { type: Number, default: 0 },
  totalQuizScoreSum: { type: Number, default: 0 },
  masteryPercentage: { type: Number, default: 75 }
});

const DailyLogSchema = new mongoose.Schema({
  date: { type: String, required: true }, // YYYY-MM-DD
  hours: { type: Number, default: 0 },
  quizScore: { type: Number, default: 0 },
  tasksCompleted: { type: Number, default: 0 }
});

const ProgressSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true, index: true },
  totalStudyHours: { type: Number, default: 34.5 },
  quizzesTaken: { type: Number, default: 12 },
  totalQuizScoreSum: { type: Number, default: 1056 }, // Average ~88%
  tasksCompleted: { type: Number, default: 28 },
  streakDays: { type: Number, default: 12 },
  weeklyTargetHours: { type: Number, default: 38.0 },
  subjectStats: [SubjectStatSchema],
  dailyLogs: [DailyLogSchema],
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Progress', ProgressSchema);
