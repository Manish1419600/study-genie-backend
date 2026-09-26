// ChatHistory.js - Store and manage academic doubt chat history & FAQs

class ChatHistoryManager {
  constructor() {
    this.chats = [
      {
        id: 'doubt-1',
        userQuery: "Can you explain the intuition behind Schrödinger's wave equation and how ψ relates to probability density |ψ|²?",
        model: "Gemini 1.5 Flash",
        timestamp: "10:42 AM",
        cacheHit: true,
        cacheSpeed: "0.02s",
        cacheMatch: "99.4%",
        response: {
          equation: "Ĥψ = Eψ",
          equationSubtitle: "Total Energy Operator × Wavefunction = Energy Eigenvalue × Wavefunction",
          explanation: "Think of ψ (psi) not as a tangible physical wave (like water or sound), but as an **information wave** that encodes everything quantum mechanics permits us to know about a state.",
          keyPoints: [
            {
              title: "Born Rule Intuition",
              text: "Since ψ itself is a complex quantity (a + bi), it cannot directly represent real counts. Max Born recognized that squaring its magnitude gives real probabilities."
            },
            {
              title: "P(x) = |ψ(x)|² dx",
              text: "Gives the precise probability density of finding the particle inside interval dx."
            }
          ],
          hasGraph: true,
          graphTitle: "Wavefunction ψ(x) vs Probability Density |ψ(x)|²",
          graphState: "n = 1 Ground State"
        }
      },
      {
        id: 'doubt-2',
        userQuery: "What is the physical meaning of normalization?",
        model: "Gemini 1.5 Flash",
        timestamp: "10:44 AM",
        response: {
          equation: "∫ |ψ(x)|² dx = 1 (from -∞ to +∞)",
          explanation: "**Physical Certainty**: Normalization enforces that the particle **must exist somewhere** in the universe. Total probability summed across all space equals exactly 1."
        }
      }
    ];

    this.faqs = [
      "Eigenvalues & Energy (Physics)",
      "Le Chatelier Principle (Chemistry)",
      "Vector Integrals & Stokes Theorem (Math)",
      "Recursion & Dynamic Programming (CS)"
    ];

    this.savedNotes = [];
  }

  getHistory() {
    return this.chats;
  }

  getFaqs() {
    return this.faqs;
  }

  addMessage(query, answer, model = "Gemini 1.5 Flash") {
    const newChat = {
      id: `doubt-${Date.now()}`,
      userQuery: query,
      model,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      response: typeof answer === 'string' ? { explanation: answer } : answer
    };
    this.chats.push(newChat);
    return newChat;
  }

  saveToNotes(chatId) {
    const chat = this.chats.find(c => c.id === chatId);
    if (chat && !this.savedNotes.find(n => n.id === chatId)) {
      this.savedNotes.push({
        id: chat.id,
        title: chat.userQuery,
        content: chat.response.explanation,
        equation: chat.response.equation,
        savedAt: new Date().toISOString()
      });
      return true;
    }
    return false;
  }

  getSavedNotes() {
    return this.savedNotes;
  }
}

module.exports = new ChatHistoryManager();
