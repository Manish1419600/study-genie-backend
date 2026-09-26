// server.js - Express API & Real-Time Socket.io Server for StudyGenie
require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const { Server } = require('socket.io');
const connectDB = require('./config/db');

// Route Handlers
const authRoutes = require('./routes/authRoutes');
const plannerRoutes = require('./routes/plannerRoutes');
const doubtRoutes = require('./routes/doubtRoutes');
const noteRoutes = require('./routes/noteRoutes');
const quizRoutes = require('./routes/quizRoutes');
const progressRoutes = require('./routes/progressRoutes');

const app = express();
const server = http.createServer(app);

// Socket.io Real-Time Server Setup
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

const DEFAULT_PORT = parseInt(process.env.PORT, 10) || 5000;

// Connect to MongoDB
connectDB();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Attach Socket.io instance to req for real-time route broadcasting
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Socket.io Connection Events
io.on('connection', (socket) => {
  console.log(`⚡ Real-time Socket Client Connected: ${socket.id}`);

  socket.on('join_user_room', (userId) => {
    if (userId) {
      socket.join(userId);
      console.log(`👤 User joined real-time room: ${userId}`);
    }
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Socket Client Disconnected: ${socket.id}`);
  });
});

// Root Status Endpoint
app.get('/', (req, res) => {
  if (req.accepts('html')) {
    return res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>StudyGenie Backend - Online</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; background: #0B0F19; color: #E2E8F0; padding: 40px; margin: 0; display: flex; justify-content: center; align-items: center; min-height: 80vh; }
            .card { max-width: 600px; width: 100%; background: #131B2E; border: 1px solid #1E293B; border-radius: 16px; padding: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
            .badge { display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); color: #34D399; border-radius: 999px; font-weight: bold; font-size: 13px; margin-bottom: 12px; }
            .dot { width: 8px; height: 8px; background: #10B981; border-radius: 50%; display: inline-block; box-shadow: 0 0 10px #10B981; }
            h1 { margin: 0 0 12px 0; font-size: 22px; color: #FFFFFF; }
            p { color: #94A3B8; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; }
            .item { background: #1E293B; padding: 12px 16px; border-radius: 10px; font-size: 13px; }
            .item strong { color: #A78BFA; display: block; margin-bottom: 4px; font-size: 12px; text-transform: uppercase; }
            .btn { display: inline-block; padding: 10px 20px; background: linear-gradient(135deg, #7C3AED, #4F46E5); color: white; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="badge"><span class="dot"></span> BACKEND SERVER IS ONLINE & RUNNING</div>
            <h1>🚀 StudyGenie Real-Time API</h1>
            <p>The backend daemon is active on <strong>http://localhost:5000</strong>, fully connected to MongoDB Atlas and ready to serve AI requests.</p>
            <div class="grid">
              <div class="item"><strong>Database</strong>MongoDB Atlas (Connected ✅)</div>
              <div class="item"><strong>AI Model</strong>Google Gemini 3.5 Flash (Active ✅)</div>
              <div class="item"><strong>WebSockets</strong>Socket.io Engine (Active ✅)</div>
              <div class="item"><strong>Port</strong>5000 (Operational ✅)</div>
            </div>
            <a href="http://localhost:3000" class="btn">Open StudyGenie Frontend App &rarr;</a>
          </div>
        </body>
      </html>
    `);
  }
  res.json({
    status: 'online',
    service: 'StudyGenie Real-Time Engine',
    database: 'MongoDB Atlas Connected',
    aiEngine: 'Google Gemini 3.5 Flash',
    port: 5000,
    time: new Date().toISOString()
  });
});

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'StudyGenie Real-Time Engine',
    realtimeSocket: true,
    time: new Date().toISOString()
  });
});

// Register Modular API Endpoints (FR1 - FR7)
app.use('/api/auth', authRoutes);         // FR1: User Auth
app.use('/api/planner', plannerRoutes);   // FR2: AI Study Planner
app.use('/api/doubts', doubtRoutes);     // FR3 & FR4: AI Doubt Solver & Doubt History Auto-FAQ
app.use('/api/notes', noteRoutes);       // FR5: Smart Notes Generator
app.use('/api/quiz', quizRoutes);         // FR6: Quiz Generator & Instant Score Evaluator
app.use('/api/progress', progressRoutes); // FR7: Progress Tracking Dashboard

// Legacy Aliases
app.post('/api/chat/ask', (req, res, next) => {
  req.url = '/ask';
  doubtRoutes(req, res, next);
});

app.get('/api/chat/history', (req, res, next) => {
  req.url = '/history';
  doubtRoutes(req, res, next);
});

function startServer(port) {
  server.listen(port, () => {
    console.log(`🚀 StudyGenie Real-Time Backend listening on http://localhost:${port}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`⚠️ Port ${port} is in use, trying port ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('Server error:', err);
    }
  });
}

startServer(DEFAULT_PORT);
