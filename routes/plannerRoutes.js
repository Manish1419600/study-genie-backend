// routes/plannerRoutes.js - Dynamic 100% User-Input Driven Planner Tasks (FR2)
const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const Progress = require('../models/Progress');
const { authenticateToken } = require('../middleware/auth');

let memoryTasks = [];

// GET /api/planner/tasks - Fetch purely the authenticated user's tasks
router.get('/tasks', authenticateToken, async (req, res) => {
  try {
    let tasks = [];
    try {
      tasks = await Task.find({ userId: req.userId }).sort({ date: 1, time: 1 });
    } catch (e) {
      tasks = memoryTasks.filter(t => t.userId === req.userId);
    }

    const pendingTasksCount = tasks.filter(t => !t.completed).length;
    const aiSuggestion = pendingTasksCount > 0
      ? {
          text: `You have ${pendingTasksCount} upcoming study tasks. Keep up your study pace!`,
          actionText: "View Schedule"
        }
      : {
          text: "No pending tasks. Click 'New Task' above to add your first study session!",
          actionText: "Add New Task"
        };

    res.json({
      tasks: tasks.map(t => ({
        id: t._id ? t._id.toString() : t.id,
        _id: t._id ? t._id.toString() : t.id,
        title: t.title,
        subject: t.subject,
        date: t.date,
        time: t.time,
        duration: t.duration,
        priority: t.priority,
        completed: t.completed,
        reminder: t.reminder,
        category: t.category
      })),
      aiSuggestion
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching tasks' });
  }
});

// POST /api/planner/tasks - Create task from user input
router.post('/tasks', authenticateToken, async (req, res) => {
  try {
    const { title, subject, date, time, duration, priority, reminder, category } = req.body;

    if (!title || !subject || !date) {
      return res.status(400).json({ error: 'Task title, subject, and date are required.' });
    }

    const newTaskData = {
      userId: req.userId,
      title,
      subject,
      date: date || new Date().toISOString().split('T')[0],
      time: time || '10:00 AM',
      duration: Number(duration) || 1.5,
      priority: priority || 'Medium',
      completed: false,
      reminder: reminder || '30 mins before',
      category: category || 'Study Session'
    };

    let savedTask;
    try {
      const dbTask = new Task(newTaskData);
      savedTask = await dbTask.save();
    } catch (e) {
      savedTask = {
        ...newTaskData,
        _id: 'task_' + Date.now(),
        id: 'task_' + Date.now()
      };
      memoryTasks.push(savedTask);
    }

    if (req.io) {
      req.io.emit('TASK_CHANGED', { action: 'create', userId: req.userId });
    }

    res.status(201).json({
      success: true,
      task: {
        id: savedTask._id ? savedTask._id.toString() : savedTask.id,
        ...savedTask._doc ? savedTask._doc : savedTask
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error creating task' });
  }
});

// PUT /api/planner/tasks/:id - Update task / Toggle completion
router.put('/tasks/:id', authenticateToken, async (req, res) => {
  try {
    const taskId = req.params.id;
    const updateData = req.body;

    let updatedTask = null;
    try {
      updatedTask = await Task.findOneAndUpdate(
        { _id: taskId, userId: req.userId },
        { $set: updateData },
        { new: true }
      );
    } catch (e) {
      const idx = memoryTasks.findIndex(t => t.id === taskId || t._id === taskId);
      if (idx !== -1) {
        memoryTasks[idx] = { ...memoryTasks[idx], ...updateData };
        updatedTask = memoryTasks[idx];
      }
    }

    if (updateData.completed && updatedTask) {
      try {
        await Progress.findOneAndUpdate(
          { userId: req.userId },
          { $inc: { tasksCompleted: 1, totalStudyHours: updatedTask.duration || 1.5 } }
        );
      } catch (err) {}
    }

    if (req.io) {
      req.io.emit('TASK_CHANGED', { action: 'update', userId: req.userId });
      req.io.emit('PROGRESS_UPDATED', { userId: req.userId });
    }

    res.json({
      success: true,
      task: updatedTask
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error updating task' });
  }
});

// DELETE /api/planner/tasks/:id
router.delete('/tasks/:id', authenticateToken, async (req, res) => {
  try {
    const taskId = req.params.id;
    try {
      await Task.deleteOne({ _id: taskId, userId: req.userId });
    } catch (e) {
      memoryTasks = memoryTasks.filter(t => t.id !== taskId && t._id !== taskId);
    }

    if (req.io) {
      req.io.emit('TASK_CHANGED', { action: 'delete', userId: req.userId });
    }

    res.json({ success: true, message: 'Task deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error deleting task' });
  }
});

module.exports = router;
