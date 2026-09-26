// services/faqSimilarityService.js - Doubt History Auto-FAQ Similarity Checker (FR4)
const Doubt = require('../models/Doubt');

// Normalize text for token comparison
function normalizeText(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[^\w\s]/gi, '') // Strip punctuation
    .trim();
}

// Compute Jaccard Similarity index between two question strings
function computeJaccardSimilarity(str1, str2) {
  const norm1 = normalizeText(str1);
  const norm2 = normalizeText(str2);

  if (norm1 === norm2) return 1.0;

  // Exact substring check
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    const lenRatio = Math.min(norm1.length, norm2.length) / Math.max(norm1.length, norm2.length);
    if (lenRatio > 0.6) return 0.85;
  }

  const set1 = new Set(norm1.split(/\s+/).filter(w => w.length > 2));
  const set2 = new Set(norm2.split(/\s+/).filter(w => w.length > 2));

  if (set1.size === 0 || set2.size === 0) return 0;

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

    const SIMILARITY_THRESHOLD = 0.65; // 65% token similarity threshold
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
