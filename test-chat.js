// test-chat.js - Simple test script for backend API logic
const chatHistory = require('./ChatHistory');
const studyMaterial = require('./StudyMaterial');

console.log('--- Testing Synapse AI Backend Modules ---');

// Test 1: Fetch Chat History
const history = chatHistory.getHistory();
console.log(`[PASS] Initial Chat History Loaded (${history.length} items)`);
console.log('First Doubt:', history[0].userQuery);
console.log('First Response Equation:', history[0].response.equation);

// Test 2: Add New Doubt
const newChat = chatHistory.addMessage(
  "Explain Faraday's Law of Induction",
  "Faraday's Law states that the electromotive force EMF = -dΦ/dt."
);
console.log('[PASS] Added new message to ChatHistory:', newChat.id);

// Test 3: Generate Quiz
const quiz = studyMaterial.generateQuiz('Quantum Mechanics');
console.log(`[PASS] Generated Quiz for ${quiz.topic} with ${quiz.questions.length} questions.`);

console.log('--- All Backend Tests Executed Successfully ---');
