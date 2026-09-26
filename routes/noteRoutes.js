// routes/noteRoutes.js - Smart Notes Generator Endpoints for ANY Document Topic (FR5)
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const Note = require('../models/Note');
const { generateSmartSummary } = require('../services/geminiService');
const { authenticateToken } = require('../middleware/auth');

// Multer upload config
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 30 * 1024 * 1024 }
});

let memoryNotes = [];

// GET /api/notes - Fetch user's uploaded smart notes
router.get('/', authenticateToken, async (req, res) => {
  try {
    let notes = [];
    try {
      notes = await Note.find({ userId: req.userId }).sort({ createdAt: -1 });
    } catch (e) {
      notes = memoryNotes.filter(n => n.userId === req.userId);
    }
    res.json({ notes });
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching smart notes' });
  }
});

// POST /api/notes/upload - Process uploaded document & generate AI summary on ANY topic
router.post('/upload', authenticateToken, upload.single('document'), async (req, res) => {
  try {
    let fileName = 'Uploaded_Material.pdf';
    let extractedText = '';
    let fileType = 'pdf';

    if (req.file) {
      fileName = req.file.originalname;
      const filePath = req.file.path;
      const ext = path.extname(fileName).toLowerCase();
      fileType = ext.replace('.', '') || 'pdf';

      if (ext === '.pdf') {
        try {
          const dataBuffer = fs.readFileSync(filePath);
          const pdfData = await pdfParse(dataBuffer);
          extractedText = (pdfData.text || '').replace(/\r\n/g, '\n').replace(/\x00/g, '').trim();
          console.log(`📄 PDF [${fileName}] parsed: ${extractedText.length} characters extracted.`);
        } catch (pdfErr) {
          console.warn(`PDF parse notice for [${fileName}]:`, pdfErr.message);
          extractedText = '';
        }
      } else {
        try {
          extractedText = fs.readFileSync(filePath, 'utf8').trim();
        } catch (e) {
          extractedText = req.body.rawText || '';
        }
      }

      // Cleanup temp uploaded file
      try {
        fs.unlinkSync(filePath);
      } catch {}
    } else if (req.body.text) {
      extractedText = req.body.text.trim();
      fileName = req.body.fileName || 'Pasted_Text_Notes.txt';
    }

    // If PDF text extraction is minimal (e.g. scanned PDF), formulate a topic context
    const cleanTopicName = fileName.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
    if (!extractedText || extractedText.length < 20) {
      extractedText = `Subject/Topic Title: ${cleanTopicName}\nThis is a complete academic study document covering: ${cleanTopicName}.`;
    }

    console.log(`✨ Generating AI summary with Gemini for [${cleanTopicName}]...`);
    const aiNotes = await generateSmartSummary(extractedText, fileName);

    const detectedSubject = (req.body.subject && req.body.subject !== 'Physics') 
      ? req.body.subject 
      : (aiNotes.subject || cleanTopicName);

    const newNoteData = {
      userId: req.userId,
      title: aiNotes.title || cleanTopicName,
      subject: detectedSubject,
      fileName,
      fileType,
      extractedText: extractedText.slice(0, 5000),
      summary: aiNotes.summary,
      keyConcepts: aiNotes.keyConcepts || [],
      createdAt: new Date()
    };

    let savedNote;
    try {
      const dbNote = new Note(newNoteData);
      savedNote = await dbNote.save();
    } catch (e) {
      savedNote = {
        ...newNoteData,
        _id: 'note_' + Date.now(),
        id: 'note_' + Date.now()
      };
      memoryNotes.unshift(savedNote);
    }

    // Broadcast real-time event if socket is available
    if (req.io && req.userId) {
      req.io.to(req.userId).emit('NOTE_CREATED', {
        note: savedNote
      });
    }

    res.status(201).json({
      success: true,
      note: {
        id: savedNote._id ? savedNote._id.toString() : savedNote.id,
        ...savedNote._doc ? savedNote._doc : savedNote
      }
    });
  } catch (error) {
    console.error('Note upload error:', error);
    res.status(500).json({ error: 'Server error processing document summary' });
  }
});

// DELETE /api/notes/:id
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const noteId = req.params.id;
    try {
      await Note.deleteOne({ _id: noteId, userId: req.userId });
    } catch (e) {
      memoryNotes = memoryNotes.filter(n => n.id !== noteId && n._id !== noteId);
    }
    res.json({ success: true, message: 'Note deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

module.exports = router;
