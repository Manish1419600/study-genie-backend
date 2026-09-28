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

// POST /api/doubts/ask - FR3 & FR4 Core Endpoint (Supports Text & Camera Images)
router.post('/ask', authenticateToken, async (req, res) => {
  try {
    const { query, subject, image, mimeType } = req.body;
    if ((!query || !query.trim()) && !image) {
      return res.status(400).json({ error: 'Academic doubt query or camera image is required.' });
    }

    const trimmedQuery = (query && query.trim()) ? query.trim() : 'Transcribe, solve and explain the academic problem in this image with step-by-step mathematical reasoning.';
    const normQ = normalizeText(trimmedQuery);

    // If no image, check Doubt History database for Auto-FAQ similarity match FIRST
    if (!image) {
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
    }

    // Query Gemini API (FR3) with optional Camera Image
    const aiAnswer = await generateDoubtExplanation(trimmedQuery, image, mimeType);

    // Store pair in MongoDB
    const newDoubtData = {
      userId: req.userId,
      question: trimmedQuery,
      normalizedQuestion: normQ,
      answer: aiAnswer,
      subject: subject || (image ? 'Camera OCR & Visual Doubt' : 'General Academic'),
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
        hasImage: !!image,
        createdAt: savedDoubt.createdAt
      }
    });
  } catch (error) {
    console.error('Error generating doubt response:', error);
    res.status(500).json({ error: 'Server error generating doubt response' });
  }
});

// DELETE /api/doubts/clear - Clear user's entire doubt history
router.delete('/clear', authenticateToken, async (req, res) => {
  try {
    try {
      await Doubt.deleteMany({ userId: req.userId });
    } catch (e) {
      memoryDoubts = memoryDoubts.filter(d => d.userId !== req.userId);
    }
    res.json({ success: true, message: 'Doubt history cleared successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear doubt history.' });
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
