// services/faqSimilarityService.js - Doubt History Auto-FAQ Similarity Checker (FR4)
const Doubt = require('../models/Doubt');

const STOP_WORDS = new Set([
  'what', 'is', 'the', 'a', 'an', 'are', 'was', 'were', 'how', 'why', 'who', 'when', 'where',
  'can', 'you', 'explain', 'tell', 'me', 'about', 'please', 'solve', 'define', 'describe',
  'of', 'in', 'on', 'at', 'to', 'for', 'with', 'from', 'by', 'does', 'do', 'did'
]);

// Extract significant content keywords
function extractKeywords(text) {
  if (!text) return new Set();
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\w\s]/gi, '')
      .split(/\s+/)
      .filter(w => w.length > 1 && !STOP_WORDS.has(w))
  );
}

// Normalize text for token comparison
function normalizeText(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[^\w\s]/gi, '') // Strip punctuation
    .trim();
}

// Compute Jaccard Similarity index based on significant keywords
function computeJaccardSimilarity(str1, str2) {
  const norm1 = normalizeText(str1);
  const norm2 = normalizeText(str2);

  if (norm1 === norm2) return 1.0;

  const set1 = extractKeywords(str1);
  const set2 = extractKeywords(str2);

  if (set1.size === 0 || set2.size === 0) return 0;

  // If keyword sets are identical
  if (set1.size === set2.size && [...set1].every(w => set2.has(w))) {
    return 1.0;
  }

  let intersectionCount = 0;
  for (const word of set1) {
    if (set2.has(word)) {
      intersectionCount++;
    }
  }

  const unionSize = set1.size + set2.size - intersectionCount;
  return unionSize > 0 ? intersectionCount / unionSize : 0;
}

/**
 * FR4 – Check Doubt History database for sufficiently similar existing doubt
 * @param {string} query - The incoming user doubt question
 * @param {string} userId - Authenticated user ID
 * @returns {Promise<Object|null>} Stored doubt match if similarity >= threshold, else null
 */
async function findSimilarDoubt(query, userId) {
  try {
    // 1. Fetch user's doubts and global popular doubts from DB
    const existingDoubts = await Doubt.find().sort({ useCount: -1 }).limit(100);

    if (!existingDoubts || existingDoubts.length === 0) {
      return null;
    }

    // High threshold (0.90) ensures we only reuse cache for genuinely identical questions
    const SIMILARITY_THRESHOLD = 0.90;
    let bestMatch = null;
    let highestScore = 0;

    for (const doubt of existingDoubts) {
      const score = computeJaccardSimilarity(query, doubt.question);
      if (score > highestScore) {
        highestScore = score;
        bestMatch = doubt;
      }
    }

    if (highestScore >= SIMILARITY_THRESHOLD && bestMatch) {
      console.log(`⚡ Auto-FAQ Match found! Similarity: ${(highestScore * 100).toFixed(1)}% for "${bestMatch.question}"`);
      
      // Increment use count in DB asynchronously if using Mongoose
      try {
        bestMatch.useCount = (bestMatch.useCount || 1) + 1;
        await Doubt.findByIdAndUpdate(bestMatch._id, { $inc: { useCount: 1 } });
      } catch (e) {
        // Ignore background update error
      }

      return {
        doubt: bestMatch,
        similarityScore: highestScore,
        isAutoFaqMatch: true
      };
    }

    return null;
  } catch (err) {
    console.warn('Auto-FAQ similarity lookup notice:', err.message);
    return null;
  }
}

module.exports = {
  findSimilarDoubt,
  computeJaccardSimilarity,
  normalizeText
};
