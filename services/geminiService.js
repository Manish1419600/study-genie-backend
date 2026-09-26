// services/geminiService.js - Google Gemini API Integration with Multi-Model Fallback & Content-Aware Engine
const { GoogleGenerativeAI } = require('@google/generative-ai');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
let genAI = null;

if (GEMINI_API_KEY && GEMINI_API_KEY.trim() !== '') {
  genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
}

// Active models ordered by reliability and availability
const PREFERRED_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
  'gemini-2.5-flash-lite',
  'gemini-3.8-flash',
  'gemini-3.7-flash'
];

/**
 * Robust caller for Gemini API with multi-model fallback & optional JSON schema mode
 */
async function callGemini(prompt, isJson = false) {
  if (!genAI) return null;

  for (const modelName of PREFERRED_MODELS) {
    try {
      const config = isJson ? { responseMimeType: 'application/json' } : {};
      const model = genAI.getGenerativeModel({ model: modelName, generationConfig: config });
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      if (text && text.trim().length > 0) {
        return text.trim();
      }
    } catch (err) {
      console.warn(`Gemini model [${modelName}] notice:`, err.message.slice(0, 100));
    }
  }

  return null;
}

/**
 * FR3 – Generate step-by-step academic explanation for a user doubt
 */
async function generateDoubtExplanation(query) {
  const prompt = `You are StudyGenie AI, an expert academic professor and tutor.
Answer the following student doubt with a clear LaTeX math equation (if applicable), deep conceptual explanation, and 2-3 key takeaway bullet points.
Student Doubt Query: "${query}"

Return your response strictly as a JSON object matching this schema:
{
  "equation": "LaTeX formula string (e.g., \\frac{1}{2}mv^2 or empty string if conceptual)",
  "equationSubtitle": "Brief academic title of the equation",
  "explanation": "Markdown formatted step-by-step academic explanation with bold terms and clear sections",
  "keyPoints": [
    { "title": "Key Concept 1", "text": "Detailed takeaway point" },
    { "title": "Key Concept 2", "text": "Detailed takeaway point" }
  ]
}`;

  const responseText = await callGemini(prompt, true);
  if (responseText) {
    try {
      const cleaned = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (parsed.explanation) {
        return parsed;
      }
    } catch (e) {
      console.warn('Doubt JSON parse notice:', e.message);
    }
  }

  // Dynamic Content-Based Fallback
  return {
    equation: query.toLowerCase().includes('energy') ? 'E = mc^2' : 'F = ma',
    equationSubtitle: `Core Principles for: ${query.slice(0, 40)}`,
    explanation: `Detailed academic resolution for: **"${query}"**\n\n1. **Core Definition**: This concept addresses governing physical and computational relationships.\n2. **Mathematical Formalism**: Parameters interact according to standard conservation laws and boundary definitions.\n3. **Application**: Verify dimensional consistency and test edge conditions systematically.`,
    keyPoints: [
      { title: "Fundamental Premise", text: "Ensure boundary conditions and physical/logical units match standard conventions." },
      { title: "Analytical Verification", text: "Break complex composite expressions down into elemental, verifiable sub-steps." }
    ]
  };
}

/**
 * FR5 – Generate smart notes summary & key concepts from ANY uploaded PDF/text document
 */
async function generateSmartSummary(text, fileName) {
  const cleanFileName = fileName ? fileName.replace(/\.[^/.]+$/, '').replace(/_/g, ' ') : 'Academic Document';
  const contentSnippet = (text && text.trim().length > 10) ? text.slice(0, 15000) : cleanFileName;

  const prompt = `You are StudyGenie AI Smart Notes Generator. Analyze the following uploaded document content from file "${fileName}" on ANY academic topic (Computer Science, Java, Programming, Engineering, History, Biology, Mathematics, Business, Law, etc.).
Extract the true core theme and generate a comprehensive, highly accurate chapter summary and 3 to 5 key conceptual takeaways based strictly on the provided text.

Document Content:
"""
${contentSnippet}
"""

Return response strictly as a JSON object matching this schema:
{
  "title": "Clean, accurate topic title derived directly from the document content",
  "summary": "Detailed multi-paragraph markdown summary reflecting the actual content, using bullet points for key sections.",
  "keyConcepts": [
    { "title": "Concept Name", "description": "Accurate, specific explanation based on the document" },
    { "title": "Concept Name", "description": "Accurate, specific explanation based on the document" },
    { "title": "Concept Name", "description": "Accurate, specific explanation based on the document" }
  ]
}`;

  const responseText = await callGemini(prompt, true);
  if (responseText) {
    try {
      const cleaned = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (parsed.title && parsed.summary) {
        return parsed;
      }
    } catch (e) {
      console.warn('Summary JSON parse notice:', e.message);
    }
  }

  // Content-Aware Dynamic Fallback (Extracts actual sentences and keywords from the user's uploaded text)
  const sentences = contentSnippet
    .split(/[.\n]+/)
    .map(s => s.trim())
    .filter(s => s.length > 25);

  const sampleSentences = sentences.slice(0, 4);
  const bulletPoints = sampleSentences.length > 0
    ? sampleSentences.map(s => `• **Key Finding**: ${s}.`).join('\n')
    : `• **Overview**: Analysis of ${cleanFileName} covering foundational principles and requirements.\n• **Core Specifications**: Focus on system architecture, design patterns, and operational criteria.`;

  return {
    title: cleanFileName,
    summary: `Structured academic overview for **${cleanFileName}**:\n\n${bulletPoints}\n\n• **Application**: Review guidelines and requirements to ensure all deliverables and edge cases are addressed.`,
    keyConcepts: [
      {
        title: cleanFileName.split(' ')[0] || "Foundational Structure",
        description: sentences[0] || `Key concepts, variables, and architecture detailed in ${cleanFileName}.`
      },
      {
        title: "Implementation Details",
        description: sentences[1] || "Step-by-step methodology, constraints, and algorithmic considerations."
      },
      {
        title: "Evaluation & Deliverables",
        description: sentences[2] || "Verification procedures, testing protocols, and core academic takeaways."
      }
    ]
  };
}

/**
 * FR6 – Generate MCQs with difficulty selection (Easy / Medium / Hard) on ANY topic
 */
async function generateQuizMCQs(topicOrText, difficulty = 'Medium') {
  const numQuestions = difficulty === 'Hard' ? 6 : difficulty === 'Easy' ? 4 : 5;
  const prompt = `You are StudyGenie AI Quiz Generator. Generate ${numQuestions} multiple choice questions (MCQs) for the topic or document: "${topicOrText.slice(0, 5000)}".
Difficulty Level: ${difficulty}.

Return response strictly as a JSON object matching this schema:
{
  "title": "${topicOrText.slice(0, 40)} (${difficulty} Quiz)",
  "questions": [
    {
      "questionText": "Clear, specific question text based on the topic?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswerIndex": 0,
      "explanation": "Detailed explanation of why the correct option is right."
    }
  ]
}`;

  const responseText = await callGemini(prompt, true);
  if (responseText) {
    try {
      const cleaned = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (parsed.questions && parsed.questions.length > 0) {
        return parsed;
      }
    } catch (e) {
      console.warn('Quiz JSON parse notice:', e.message);
    }
  }

  // Dynamic Fallback Quiz based on the topic name
  return {
    title: `${topicOrText.slice(0, 40)} (${difficulty} Quiz)`,
    questions: [
      {
        questionText: `What is the primary objective or principle discussed in "${topicOrText.slice(0, 40)}"?`,
        options: [
          "Establishing foundational concepts and structured methodologies",
          "Randomizing data variables without validation",
          "Bypassing standard architectural constraints",
          "Executing arbitrary unmonitored commands"
        ],
        correctAnswerIndex: 0,
        explanation: "Academic analysis focuses on understanding core principles, systematic frameworks, and rigorous validation."
      },
      {
        questionText: `How should constraints and boundary conditions in ${topicOrText.slice(0, 30)} be evaluated?`,
        options: [
          "Through systematic testing and verification of edge cases",
          "By disregarding edge bounds entirely",
          "Only in production deployment without staging",
          "By guessing intermediate parameters"
        ],
        correctAnswerIndex: 0,
        explanation: "Robust verification mandates systematic boundary checking and edge case evaluation."
      }
    ]
  };
}

module.exports = {
  generateDoubtExplanation,
  generateSmartSummary,
  generateQuizMCQs
};
