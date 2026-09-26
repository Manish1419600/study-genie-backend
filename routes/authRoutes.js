// routes/authRoutes.js - Dynamic User Auth with Clean User-Specific Data Initialization (FR1)
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Progress = require('../models/Progress');
const { authenticateToken, JWT_SECRET } = require('../middleware/auth');

const memoryUsers = [];

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, university, major } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    let existingUser = null;
    try {
      existingUser = await User.findOne({ email: email.toLowerCase() });
    } catch (e) {
      existingUser = memoryUsers.find(u => u.email === email.toLowerCase());
    }

    if (existingUser) {
      return res.status(400).json({ error: 'An account with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

    let newUserObj = {
      _id: userId,
      id: userId,
      name,
      email: email.toLowerCase(),
      university: university || 'Stanford University',
      major: major || 'Computer Science',
      createdAt: new Date()
    };

    try {
      const dbUser = new User({
        name,
        email: email.toLowerCase(),
        password: hashedPassword,
        university: newUserObj.university,
        major: newUserObj.major
      });
      await dbUser.save();
      newUserObj._id = dbUser._id.toString();
      newUserObj.id = dbUser._id.toString();

      // Initialize clean user progress stats (driven 100% by user inputs)
      const freshProgress = new Progress({
        userId: newUserObj._id,
        totalStudyHours: 0,
        quizzesTaken: 0,
        totalQuizScoreSum: 0,
        tasksCompleted: 0,
        streakDays: 1,
        weeklyTargetHours: 30.0,
        subjectStats: [],
        dailyLogs: []
      });
      await freshProgress.save();
    } catch (dbErr) {
      console.warn('DB User save notice:', dbErr.message);
      memoryUsers.push({ ...newUserObj, password: hashedPassword });
    }

    const token = jwt.sign({ userId: newUserObj.id, email: newUserObj.email }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: newUserObj.id,
        name: newUserObj.name,
        email: newUserObj.email,
        university: newUserObj.university,
        major: newUserObj.major
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error registering user' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    let user = null;
    try {
      user = await User.findOne({ email: email.toLowerCase() });
    } catch (e) {
      user = memoryUsers.find(u => u.email === email.toLowerCase());
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const userIdStr = user._id ? user._id.toString() : user.id;
    const token = jwt.sign({ userId: userIdStr, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: userIdStr,
        name: user.name,
        email: user.email,
        university: user.university || 'Stanford University',
        major: user.major || 'Computer Science'
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error logging in' });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req, res) => {
  try {
    let user = null;
    try {
      user = await User.findById(req.userId).select('-password');
    } catch (e) {
      user = memoryUsers.find(u => u.id === req.userId || u._id === req.userId);
    }

    if (!user) {
      return res.status(404).json({ error: 'User profile not found.' });
    }

    res.json({
      user: {
        id: user._id ? user._id.toString() : user.id,
        name: user.name,
        email: user.email,
        university: user.university || 'Stanford University',
        major: user.major || 'Computer Science'
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching user profile' });
  }
});

module.exports = router;
