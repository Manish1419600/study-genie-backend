const { GoogleGenerativeAI } = require('@google/generative-ai');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

const PREFERRED_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
  'gemini-2.5-flash-lite',
  'gemini-3.8-flash'
];

async function generateSummaryTest(text, fileName) {
  const prompt = `You are StudyGenie AI Smart Notes Generator. Analyze the following uploaded document content from file "${fileName}" on ANY academic topic (Computer Science, Java, History, Biology, Physics, etc.).
Extract the true core theme and generate a comprehensive, highly accurate chapter summary and 3 to 5 key conceptual takeaways.

Document Content:
${text.slice(0, 15000)}

Return response strictly as a JSON object matching this schema:
{
  "title": "Clean, accurate topic title derived directly from the document",
  "summary": "Detailed, multi-paragraph markdown summary reflecting the actual content, using bullet points for key sections.",
  "keyConcepts": [
    { "title": "Concept Name", "description": "Accurate explanation based on the text" },
    { "title": "Concept Name", "description": "Accurate explanation based on the text" },
    { "title": "Concept Name", "description": "Accurate explanation based on the text" }
  ]
}`;

  for (const m of PREFERRED_MODELS) {
    try {
      const model = genAI.getGenerativeModel({
        model: m,
        generationConfig: { responseMimeType: "application/json" }
      });
      const res = await model.generateContent(prompt);
      const textOutput = res.response.text();
      const parsed = JSON.parse(textOutput);
      return { success: true, model: m, data: parsed };
    } catch (err) {
      console.warn(`Model ${m} error:`, err.message.slice(0, 100));
    }
  }

  return { success: false };
}

async function run() {
  const sampleJavaText = `
  Java Programming Assignment 3: Object-Oriented Banking System
  Objectives:
  1. Demonstrate Encapsulation: Private member variables with getters/setters for balance, accountNumber, and ownerName.
  2. Implement Inheritance: Base class BankAccount with subclasses SavingsAccount (adds interestRate) and CheckingAccount (adds overdraftLimit).
  3. Polymorphism: Override the withdraw() method in CheckingAccount to permit withdrawals beyond balance up to overdraftLimit with a $15 fee.
  4. Interfaces: Create a Transactional interface with methods deposit(), withdraw(), and printStatement().
  Submission Requirements: Include clean JUnit tests, JavaDoc comments, and UML class diagrams.
  `;

  console.log("Testing AI summary on Java assignment text...");
  const result = await generateSummaryTest(sampleJavaText, "Java_assignment.pdf");
  console.log("RESULT:", JSON.stringify(result, null, 2));
}

run();
