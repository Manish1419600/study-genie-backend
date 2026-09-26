// routes/doubtRoutes.js - Dynamic User Doubt Solver & Real-Time Auto-FAQ (FR3 & FR4)
const express = require('express');
const router = express.Router();
const Doubt = require('../models/Doubt');
const { generateDoubtExplanation } = require('../services/geminiService');
const { findSimilarDoubt, normalizeText } = require('../services/faqSimilarityService');
const { authenticateToken } = require('../middleware/auth');

let memoryDoubts = [];

// GET /api/doubts/history - Fetch user's doubts & popular user FAQs
router.get('/history', authenticateToken, async (req, res) => {
  try {
    let userDoubts = [];
    let faqs = [];

    try {
      userDoubts = await Doubt.find({ userId: req.userId }).sort({ createdAt: -1 });
      faqs = await Doubt.find({ userId: req.userId }).sort({ useCount: -1 }).limit(10);
    } catch (e) {
      userDoubts = memoryDoubts.filter(d => d.userId === req.userId);
      faqs = userDoubts;
    }

    res.json({
      history: userDoubts,
      faqs: faqs.map(f => ({
        id: f._id ? f._id.toString() : f.id,
        question: f.question,
        subject: f.subject,
        useCount: f.useCount || 1,
        answer: f.answer
      }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching doubt history' });
  }
});

// POST /api/doubts/ask - FR3 & FR4 Core Endpoint
router.post('/ask', authenticateToken, async (req, res) => {
  try {
    const { query, subject } = req.body;
    if (!query || !query.trim()) {
      return res.status(400).json({ error: 'Academic doubt query is required.' });
    }

    const trimmedQuery = query.trim();
    const normQ = normalizeText(trimmedQuery);

    // FR4 Step 1: Check Doubt History database for Auto-FAQ similarity match FIRST
    const similarityMatch = await findSimilarDoubt(trimmedQuery, req.userId);

    if (similarityMatch && similarityMatch.doubt) {
      const cachedDoubt = similarityMatch.doubt;

      return res.json({
        success: true,
        source: 'AUTO_FAQ_CACHE',
        isAutoFaqMatch: true,
        similarityScore: Math.round(similarityMatch.similarityScore * 100),
        chat: {
          id: cachedDoubt._id ? cachedDoubt._id.toString() : 'faq_' + Date.now(),
          question: trimmedQuery,
          answer: cachedDoubt.answer,
          isAutoFaqMatch: true,
          matchQuestion: cachedDoubt.question,
          createdAt: new Date()
        }
      });
    }

    // FR4 Step 2: No match found -> Query Gemini API (FR3)
    const aiAnswer = await generateDoubtExplanation(trimmedQuery);

    // FR4 Step 3: Store pair in MongoDB
    const newDoubtData = {
      userId: req.userId,
      question: trimmedQuery,
      normalizedQuestion: normQ,
      answer: aiAnswer,
      subject: subject || 'General Academic',
      isAutoFaqMatch: false,
      useCount: 1,
      createdAt: new Date()
    };

    let savedDoubt;
    try {
      const dbDoubt = new Doubt(newDoubtData);
      savedDoubt = await dbDoubt.save();
    } catch (dbErr) {
      savedDoubt = {
        ...newDoubtData,
        _id: 'doubt_' + Date.now(),
        id: 'doubt_' + Date.now()
      };
      memoryDoubts.unshift(savedDoubt);
    }

    res.json({
      success: true,
      source: 'GEMINI_API',
      isAutoFaqMatch: false,
      chat: {
        id: savedDoubt._id ? savedDoubt._id.toString() : savedDoubt.id,
        question: trimmedQuery,
        answer: aiAnswer,
        isAutoFaqMatch: false,
        createdAt: savedDoubt.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error generating doubt response' });
  }
});

// POST /api/doubts/save-note
router.post('/save-note', authenticateToken, async (req, res) => {
  try {
    const { doubtId } = req.body;
    try {
      await Doubt.findByIdAndUpdate(doubtId, { savedToNotes: true });
    } catch (e) {
      const d = memoryDoubts.find(m => m.id === doubtId || m._id === doubtId);
      if (d) d.savedToNotes = true;
    }
    res.json({ success: true, message: 'Doubt saved to personal notebook' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save note' });
  }
});

module.exports = router;
