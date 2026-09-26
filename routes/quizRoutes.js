// routes/quizRoutes.js - Quiz Generator & Evaluation (FR6)
const express = require('express');
const router = express.Router();
const Quiz = require('../models/Quiz');
const Note = require('../models/Note');
const Progress = require('../models/Progress');
const { generateQuizMCQs } = require('../services/geminiService');
const { authenticateToken } = require('../middleware/auth');

let memoryQuizzes = [];

// GET /api/quiz - Fetch user's quizzes
router.get('/', authenticateToken, async (req, res) => {
  try {
    let quizzes = [];
    try {
      quizzes = await Quiz.find({ userId: req.userId }).sort({ createdAt: -1 });
    } catch (e) {
      quizzes = memoryQuizzes.filter(q => q.userId === req.userId);
    }
    res.json({ quizzes });
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching quizzes' });
  }
});

// GET /api/quiz/:id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const quizId = req.params.id;
    let quiz = null;
    try {
      quiz = await Quiz.findById(quizId);
    } catch (e) {
      quiz = memoryQuizzes.find(q => q.id === quizId || q._id === quizId);
    }

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    res.json({ quiz });
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching quiz' });
  }
});

// POST /api/quiz/generate - Generate MCQs from topic/note content
router.post('/generate', authenticateToken, async (req, res) => {
  try {
    const { topic, noteId, difficulty } = req.body;
    const selectedDifficulty = ['Easy', 'Medium', 'Hard'].includes(difficulty) ? difficulty : 'Medium';

    let quizPrompt = topic || 'General Study Topic';
    let subject = 'General Academic';

    if (noteId) {
      try {
        const note = await Note.findById(noteId);
        if (note) {
          quizPrompt = note.extractedText || note.summary || note.title;
          subject = note.subject || 'General';
        }
      } catch (e) {}
    }

    const generatedData = await generateQuizMCQs(quizPrompt, selectedDifficulty);

    const newQuizData = {
      userId: req.userId,
      title: generatedData.title || `${topic || 'Study Topic'} (${selectedDifficulty} Quiz)`,
      subject: subject || req.body.subject || 'Academic',
      difficulty: selectedDifficulty,
      questions: generatedData.questions || [],
      attempts: [],
      createdAt: new Date()
    };

    let savedQuiz;
    try {
      const dbQuiz = new Quiz(newQuizData);
      savedQuiz = await dbQuiz.save();
    } catch (e) {
      savedQuiz = {
        ...newQuizData,
        _id: 'quiz_' + Date.now(),
        id: 'quiz_' + Date.now()
      };
      memoryQuizzes.unshift(savedQuiz);
    }

    res.status(201).json({
      success: true,
      quiz: {
        id: savedQuiz._id ? savedQuiz._id.toString() : savedQuiz.id,
        ...savedQuiz._doc ? savedQuiz._doc : savedQuiz
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error generating quiz' });
  }
});

// POST /api/quiz/:id/submit - Submit quiz attempt & get immediate score
router.post('/:id/submit', authenticateToken, async (req, res) => {
  try {
    const quizId = req.params.id;
    const { userAnswers } = req.body;

    if (!Array.isArray(userAnswers)) {
      return res.status(400).json({ error: 'Answers array is required.' });
    }

    let quiz = null;
    try {
      quiz = await Quiz.findById(quizId);
    } catch (e) {
      quiz = memoryQuizzes.find(q => q.id === quizId || q._id === quizId);
    }

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found.' });
    }

    let score = 0;
    const totalQuestions = quiz.questions.length;
    const questionBreakdown = quiz.questions.map((q, idx) => {
      const selected = userAnswers[idx];
      const isCorrect = selected === q.correctAnswerIndex;
      if (isCorrect) score++;

      return {
        questionText: q.questionText,
        options: q.options,
        userAnswer: selected,
        correctAnswerIndex: q.correctAnswerIndex,
        isCorrect,
        explanation: q.explanation
      };
    });

    const percentage = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;
    const attemptObj = {
      score,
      totalQuestions,
      percentage,
      userAnswers,
      submittedAt: new Date()
    };

    try {
      if (quiz._id && Quiz.findByIdAndUpdate) {
        await Quiz.findByIdAndUpdate(quiz._id, { $push: { attempts: attemptObj } });
      } else {
        quiz.attempts.push(attemptObj);
      }
    } catch (err) {
      if (quiz) quiz.attempts.push(attemptObj);
    }

    try {
      await Progress.findOneAndUpdate(
        { userId: req.userId },
        {
          $inc: { quizzesTaken: 1, totalQuizScoreSum: percentage },
          $set: { updatedAt: new Date() }
        }
      );
    } catch (err) {}

    if (req.io) {
      req.io.emit('PROGRESS_UPDATED', { userId: req.userId });
    }

    res.json({
      success: true,
      score,
      totalQuestions,
      percentage,
      attempt: attemptObj,
      breakdown: questionBreakdown
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error processing quiz evaluation' });
  }
});

module.exports = router;
