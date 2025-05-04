/**
 * Utility functions for scoring and ranking candidates
 */

/**
 * Applies the Delphi technique to refine weights with fuzzy aggregation
 * @param {Array} initialWeights - Array of weights from different HR personnel
 * @returns {Object} - Final weights after consensus
 */
const applyDelphiTechnique = (initialWeights) => {
  // Get all unique criteria names
  const allCriteria = new Set();
  initialWeights.forEach(hrWeights => {
    Object.keys(hrWeights).forEach(key => allCriteria.add(key));
  });
  
  // Group weights by criterion
  const weightsByAttribute = {};
  allCriteria.forEach(criterion => {
    weightsByAttribute[criterion] = [];
    initialWeights.forEach(hrWeights => {
      if (hrWeights[criterion]) {
        weightsByAttribute[criterion].push(hrWeights[criterion]);
      }
    });
  });
  
  // Aggregate weights using fuzzy outlier detection
  const finalWeights = {};
  Object.keys(weightsByAttribute).forEach(criterion => {
    const weights = weightsByAttribute[criterion];
    
    // Apply fuzzy outlier detection (remove extreme values)
    const filteredWeights = removeFuzzyOutliers(weights);
    
    // Calculate aggregated weight
    finalWeights[criterion] = filteredWeights.reduce((sum, w) => sum + w, 0) / filteredWeights.length;
  });
  
  // Normalize weights to sum to 1
  const totalWeight = Object.values(finalWeights).reduce((sum, weight) => sum + weight, 0);
  if (totalWeight > 0) {
    Object.keys(finalWeights).forEach(key => {
      finalWeights[key] = finalWeights[key] / totalWeight;
    });
  }
  
  return finalWeights;
};

/**
 * Remove outliers using fuzzy logic
 * @param {Array} values - Array of numeric values
 * @param {Number} fuzzyThreshold - Threshold for outlier detection (0-1)
 * @returns {Array} - Filtered array without outliers
 */
const removeFuzzyOutliers = (values, fuzzyThreshold = 0.2) => {
  if (values.length <= 2) return values;
  
  // Sort values
  const sorted = [...values].sort((a, b) => a - b);
  
  // Calculate median
  const mid = Math.floor(sorted.length / 2);
  const medianValue = sorted.length % 2 === 0 
    ? (sorted[mid - 1] + sorted[mid]) / 2 
    : sorted[mid];
  
  // Calculate median absolute deviation (MAD)
  const deviations = sorted.map(v => Math.abs(v - medianValue));
  const mad = calculateMedian(deviations);
  
  // Filter outliers using fuzzy threshold
  return values.filter(v => {
    const deviation = Math.abs(v - medianValue);
    // If MAD is 0, keep all values with the same value as median
    if (mad === 0) return v === medianValue;
    
    // Calculate fuzzy membership to "normal" set
    const normalMembership = Math.max(0, 1 - (deviation / (fuzzyThreshold * mad * 1.4826)));
    return normalMembership > 0.5; // Keep if membership to "normal" set is high
  });
};

/**
 * Calculate median of an array
 * @param {Array} arr - Array of numbers
 * @returns {Number} - Median value
 */
const calculateMedian = (arr) => {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 
    ? (sorted[mid - 1] + sorted[mid]) / 2 
    : sorted[mid];
};

/**
 * Applies hard criteria filtering with fuzzy thresholds
 * @param {Array} candidates - Array of candidates
 * @param {Object} criteria - Hard criteria thresholds
 * @param {Number} thresholdTolerance - Fuzzy threshold tolerance (0-1)
 * @returns {Array} - Filtered candidates
 */
const applyHardCriteriaFilter = (candidates, criteria, thresholdTolerance = 0.1) => {
  return candidates.filter(candidate => {
    for (const [key, threshold] of Object.entries(criteria)) {
      const candidateValue = candidate.attributes.get(key);
      
      // Skip if attribute doesn't exist
      if (candidateValue === undefined) return false;
      
      // Apply fuzzy threshold with tolerance for numeric values
      if (typeof candidateValue === 'number' && typeof threshold === 'number') {
        // Allow values slightly below threshold based on tolerance
        const fuzzyThreshold = threshold * (1 - thresholdTolerance);
        if (candidateValue < fuzzyThreshold) return false;
      } 
      // For non-numeric values, use exact matching
      else if (candidateValue < threshold) {
        return false;
      }
    }
    return true;
  });
};

/**
 * Calculate fuzzy score for an attribute with enhanced type-specific handling
 * @param {*} value - Raw attribute value
 * @param {*} targetValue - Ideal value
 * @param {Number} fuzzyFactor - How fuzzy the matching should be (0-1)
 * @param {String} membershipType - Type of membership function to use ('triangular', 'trapezoidal', 'gaussian', 'simple')
 * @returns {Number} - Fuzzy score between 0 and 1
 */
const calculateFuzzyScore = (value, targetValue, fuzzyFactor = 0.2, membershipType = 'simple') => {
  // Handle undefined or null values
  if (value === undefined || value === null) {
    return 0;
  }
  
  if (typeof value === 'number' && typeof targetValue === 'number') {
    // For numeric values, use the specified membership function type
    switch (membershipType) {
      case 'triangular':
        // Triangular membership function
        const a = targetValue * (1 - fuzzyFactor);
        const b = targetValue;
        const c = targetValue * (1 + fuzzyFactor);
        return triangularMF(value, a, b, c);
        
      case 'trapezoidal':
        // Trapezoidal membership function
        const a2 = targetValue * (1 - fuzzyFactor);
        const b2 = targetValue * (1 - fuzzyFactor/2);
        const c2 = targetValue * (1 + fuzzyFactor/2);
        const d2 = targetValue * (1 + fuzzyFactor);
        return trapezoidalMF(value, a2, b2, c2, d2);
        
      case 'gaussian':
        // Gaussian membership function
        const mean = targetValue;
        const sigma = targetValue * fuzzyFactor;
        return gaussianMF(value, mean, sigma);
        
      case 'simple':
      default:
        // Original simple approach with normalized distance
        const maxDiff = Math.max(targetValue * fuzzyFactor, 1);
        const actualDiff = Math.abs(value - targetValue);
        return Math.max(0, 1 - (actualDiff / maxDiff));
    }
  } else if (typeof value === 'string' && typeof targetValue === 'string') {
    // For string values, use fuzzy string matching
    return calculateStringSimilarity(value, targetValue);
  } else if (Array.isArray(value) && Array.isArray(targetValue)) {
    // For arrays, use enhanced array similarity
    return calculateArraySimilarity(value, targetValue);
  } else if (typeof value === 'boolean' && typeof targetValue === 'boolean') {
    // For boolean values, exact match
    return value === targetValue ? 1 : 0;
  }
  
  // Default fallback
  return value === targetValue ? 1 : 0;
};

/**
 * Define triangular membership function for fuzzy sets
 * @param {Number} x - Input value
 * @param {Number} a - Left point
 * @param {Number} b - Middle point (peak)
 * @param {Number} c - Right point
 * @returns {Number} - Membership degree (0-1)
 */
const triangularMF = (x, a, b, c) => {
  if (x <= a) return 0;
  if (x > a && x <= b) return (x - a) / (b - a);
  if (x > b && x <= c) return (c - x) / (c - b);
  return 0;
};

/**
 * Define trapezoidal membership function for fuzzy sets
 * @param {Number} x - Input value
 * @param {Number} a - Left bottom point
 * @param {Number} b - Left top point
 * @param {Number} c - Right top point
 * @param {Number} d - Right bottom point
 * @returns {Number} - Membership degree (0-1)
 */
const trapezoidalMF = (x, a, b, c, d) => {
  if (x <= a) return 0;
  if (x > a && x <= b) return (x - a) / (b - a);
  if (x > b && x <= c) return 1;
  if (x > c && x <= d) return (d - x) / (d - c);
  return 0;
};

/**
 * Define Gaussian membership function for fuzzy sets
 * @param {Number} x - Input value
 * @param {Number} mean - Mean of the Gaussian function
 * @param {Number} sigma - Standard deviation
 * @returns {Number} - Membership degree (0-1)
 */
const gaussianMF = (x, mean, sigma) => {
  return Math.exp(-0.5 * Math.pow((x - mean) / sigma, 2));
};

/**
 * Calculate string similarity using Levenshtein distance
 * @param {String} str1 - First string
 * @param {String} str2 - Second string
 * @returns {Number} - Similarity score (0-1)
 */
const calculateStringSimilarity = (str1, str2) => {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  // Handle empty strings
  if (s1.length === 0 && s2.length === 0) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;
  
  // Check for exact match first
  if (s1 === s2) return 1;
  
  // Initialize the Levenshtein distance matrix
  const matrix = Array(s1.length + 1).fill().map(() => Array(s2.length + 1).fill(0));
  
  // Fill the first row and column
  for (let i = 0; i <= s1.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= s2.length; j++) matrix[0][j] = j;
  
  // Fill the rest of the matrix
  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,     // deletion
        matrix[i][j - 1] + 1,     // insertion
        matrix[i - 1][j - 1] + cost  // substitution
      );
    }
  }
  
  // Normalize to 0-1 range
  const maxLength = Math.max(s1.length, s2.length);
  return 1 - (matrix[s1.length][s2.length] / maxLength);
};

/**
 * Calculate similarity between two arrays using fuzzy logic
 * @param {Array} sourceArray - The source array to compare
 * @param {Array} targetArray - The target array to compare against
 * @param {Object} options - Optional configuration parameters
 * @returns {Number} - Similarity score (0-1)
 */
const calculateArraySimilarity = (sourceArray, targetArray, options = {}) => {
  const { 
    caseSensitive = false, 
    partial = true, 
    threshold = 0.7 
  } = options;

  if (!Array.isArray(sourceArray) || !Array.isArray(targetArray)) {
    return 0;
  }
  
  if (sourceArray.length === 0 && targetArray.length === 0) {
    return 1;
  }
  
  if (sourceArray.length === 0 || targetArray.length === 0) {
    return 0;
  }

  // Create a copy to avoid modifying original arrays
  const source = [...sourceArray];
  const target = [...targetArray];
  
  // Matrix to store similarity scores between all items
  const similarityMatrix = [];
  
  // Calculate similarity between each pair of items
  for (let i = 0; i < source.length; i++) {
    similarityMatrix[i] = [];
    for (let j = 0; j < target.length; j++) {
      // Handle different data types
      if (typeof source[i] === 'string' && typeof target[j] === 'string') {
        similarityMatrix[i][j] = calculateStringSimilarity(
          caseSensitive ? source[i] : source[i].toLowerCase(), 
          caseSensitive ? target[j] : target[j].toLowerCase()
        );
      } else if (typeof source[i] === 'number' && typeof target[j] === 'number') {
        // For numbers, calculate how close they are to each other
        const maxDiff = Math.max(Math.abs(source[i]), Math.abs(target[j]));
        const diff = Math.abs(source[i] - target[j]);
        similarityMatrix[i][j] = maxDiff === 0 ? 1 : Math.max(0, 1 - diff / maxDiff);
      } else if (source[i] === target[j]) {
        // Exact match for other types
        similarityMatrix[i][j] = 1;
      } else {
        // Different types or values
        similarityMatrix[i][j] = 0;
      }
    }
  }
  
  // Find best matches greedily
  let totalSimilarity = 0;
  let matchCount = 0;
  
  // Process the larger array first
  const processLargerFirst = source.length > target.length;
  const primaryArray = processLargerFirst ? similarityMatrix : similarityMatrix.map((row, i) => 
    target.map((_, j) => similarityMatrix[i][j])
  );
  
  // Find best matches greedily
  for (let i = 0; i < primaryArray.length; i++) {
    if (primaryArray[i].length === 0) continue;
    
    // Find the best match for this item
    let bestMatchIdx = -1;
    let bestMatchScore = threshold - 0.01; // Only consider matches above threshold
    
    for (let j = 0; j < primaryArray[i].length; j++) {
      if (primaryArray[i][j] > bestMatchScore) {
        bestMatchScore = primaryArray[i][j];
        bestMatchIdx = j;
      }
    }
    
    // If we found a match above threshold
    if (bestMatchIdx !== -1) {
      totalSimilarity += bestMatchScore;
      matchCount++;
      
      // Remove the matched item to prevent reuse
      for (let k = 0; k < primaryArray.length; k++) {
        if (primaryArray[k].length > bestMatchIdx) {
          primaryArray[k].splice(bestMatchIdx, 1);
        }
      }
    }
  }
  
  // Calculate final similarity score
  const maxPossibleMatches = Math.min(source.length, target.length);
  if (maxPossibleMatches === 0) return 0;
  
  // Weight the score by both match quality and coverage
  const matchQuality = matchCount > 0 ? totalSimilarity / matchCount : 0;
  const coverage = matchCount / maxPossibleMatches;
  
  // Combine match quality and coverage with emphasis on coverage
  return (matchQuality * 0.4) + (coverage * 0.6);
};

/**
 * Apply weighted sum model to calculate stage score with confidence weights
 * @param {Object} attributes - Candidate attributes
 * @param {Object} weights - Criteria weights
 * @param {Object} confidenceScores - Confidence in each attribute (optional)
 * @returns {Object} - Weighted score and confidence
 */
const applyWSM = (attributes, weights, confidenceScores = {}) => {
  let score = 0;
  let totalWeight = 0;
  let totalConfidence = 0;
  
  for (const [key, weight] of Object.entries(weights)) {
    if (attributes[key] !== undefined) {
      const attributeValue = attributes[key];
      const confidence = confidenceScores[key] || 1.0;
      
      // Apply confidence-adjusted weight
      const adjustedWeight = weight * confidence;
      score += attributeValue * adjustedWeight;
      totalWeight += adjustedWeight;
      totalConfidence += confidence;
    }
  }
  
  // Normalize by actual weights used
  const weightedScore = totalWeight > 0 ? score / totalWeight : 0;
  const averageConfidence = Object.keys(weights).length > 0 ? 
    totalConfidence / Object.keys(weights).length : 1.0;
  
  return {
    score: weightedScore,
    confidence: averageConfidence
  };
};

/**
 * Aggregate scores from all stages with fuzzy confidence weighting
 * @param {Object} stageScores - Scores from each stage
 * @param {Object} stageWeights - Weight of each stage
 * @param {Object} stageConfidences - Confidence in each stage (optional)
 * @returns {Object} - Final aggregate score and confidence
 */
const aggregateStageScores = (stageScores, stageWeights, stageConfidences = {}) => {
  let finalScore = 0;
  let totalWeight = 0;
  let totalConfidence = 0;
  
  for (const [stage, score] of Object.entries(stageScores)) {
    if (stageWeights[stage]) {
      const weight = stageWeights[stage];
      const confidence = stageConfidences[stage] || 1.0;
      
      // Apply confidence-adjusted weight
      const adjustedWeight = weight * confidence;
      finalScore += score * adjustedWeight;
      totalWeight += adjustedWeight;
      totalConfidence += confidence;
    }
  }
  
  // Normalize by actual weights used
  const normalizedScore = totalWeight > 0 ? finalScore / totalWeight : 0;
  const averageConfidence = Object.keys(stageWeights).length > 0 ? 
    totalConfidence / Object.keys(stageWeights).length : 1.0;
  
  return {
    score: normalizedScore,
    confidence: averageConfidence
  };
};

/**
 * Rank candidates based on final scores with confidence consideration
 * @param {Array} candidates - Array of candidates with scores
 * @returns {Array} - Ranked candidates (descending order)
 */
const rankCandidates = (candidates) => {
  // First create a deep copy to avoid modifying the original array
  const rankedCandidates = candidates.map(candidate => ({
    ...candidate,
    // Ensure there's a finalScore property
    finalScore: candidate.finalScore || 0,
    // Add confidence as a factor if available
    confidenceScore: candidate.confidence || 1.0
  }));
  
  // Sort primarily by finalScore, but use confidence as a tiebreaker
  rankedCandidates.sort((a, b) => {
    // If scores are very close (within 0.05), use confidence as tiebreaker
    if (Math.abs(b.finalScore - a.finalScore) < 0.05) {
      return b.confidenceScore - a.confidenceScore;
    }
    // Otherwise sort by score
    return b.finalScore - a.finalScore;
  });
  
  // Add percentile and relative standing
  rankedCandidates.forEach((candidate, index) => {
    candidate.percentile = 100 * (1 - (index / rankedCandidates.length));
    candidate.rank = index + 1;
  });
  
  return rankedCandidates;
};

/**
 * Alpha-cut filtering function
 * @param {Object} attributes - Attribute values
 * @param {Object} confidenceScores - Confidence scores for attributes
 * @param {Number} alphaCutThreshold - Minimum confidence threshold
 * @returns {Object} - Filtered attributes
 */
const applyAlphaCut = (attributes, confidenceScores, alphaCutThreshold = 0.5) => {
  const filteredAttributes = {};
  
  for (const [key, value] of Object.entries(attributes)) {
    const confidence = confidenceScores[key] || 1.0;
    if (confidence >= alphaCutThreshold) {
      filteredAttributes[key] = value;
    }
  }
  
  return filteredAttributes;
};

/**
 * OWA (Ordered Weighted Averaging) implementation
 * @param {Object} attributes - Attribute values
 * @param {Object} weights - Criteria weights
 * @param {Array} owaWeights - OWA operator weights
 * @returns {Number} - Aggregated score
 */
const applyOWA = (attributes, weights, owaWeights) => {
  // Sort attribute values in descending order
  const sortedPairs = Object.entries(attributes)
    .sort((a, b) => b[1] - a[1]);
  
  // Apply OWA weights
  let score = 0;
  let totalAppliedWeight = 0;
  
  sortedPairs.forEach((pair, index) => {
    const [key, value] = pair;
    const criterionWeight = weights[key] || 0;
    const owaWeight = index < owaWeights.length ? owaWeights[index] : 0;
    
    score += value * criterionWeight * owaWeight;
    totalAppliedWeight += criterionWeight * owaWeight;
  });
  
  return totalAppliedWeight > 0 ? score / totalAppliedWeight : 0;
};

module.exports = {
  applyDelphiTechnique,
  applyHardCriteriaFilter,
  calculateFuzzyScore,
  triangularMF,
  trapezoidalMF,
  gaussianMF,
  calculateStringSimilarity,
  calculateArraySimilarity,
  applyWSM,
  aggregateStageScores,
  rankCandidates,
  removeFuzzyOutliers,
  calculateMedian,
  applyAlphaCut,
  applyOWA
}; 