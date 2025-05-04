const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Candidate = require('../models/Candidate');
const Job = require('../models/Job');
const { 
  calculateFuzzyScore, 
  applyWSM, 
  aggregateStageScores, 
  rankCandidates,
  applyHardCriteriaFilter,
  applyOWA
} = require('../utils/scoring');

// Calculate initial scores for candidates using fuzzy logic (pre-interview)
router.post('/initial/:jobId', [
  body('targetValues').isObject().withMessage('Target values must be an object'),
  body('fuzzyFactor').optional().isFloat({ min: 0, max: 1 }).withMessage('Fuzzy factor must be between 0 and 1'),
  body('membershipType').optional().isIn(['simple', 'triangular', 'trapezoidal', 'gaussian']).withMessage('Invalid membership function type'),
  body('confidenceWeights').optional().isObject().withMessage('Confidence weights must be an object if provided')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { jobId } = req.params;
    const { 
      targetValues, 
      fuzzyFactor = 0.2, 
      membershipType = 'simple',
      confidenceWeights = {}  // Optional per-attribute confidence weights
    } = req.body;
    
    // Get job and its criteria weights
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }
    
    // Debug: Log job weights
    // console.log('Job finalWeights:', job.finalWeights);
    
    // If job.finalWeights is undefined or empty, return error
    if (!job.finalWeights || Object.keys(job.finalWeights).length === 0) {
      return res.status(400).json({ 
        message: 'Job criteria weights are not defined. Please set weights for this job first.',
        jobId
      });
    }
    
    // Get all candidates for the job
    const candidates = await Candidate.find({ jobId });
    if (candidates.length === 0) {
      return res.status(404).json({ message: 'No candidates found for this job' });
    }
    
    // Debug: Log first candidate's attributes
    if (candidates.length > 0) {
      console.log('First candidate attributes:', 
        candidates[0].attributes instanceof Map 
          ? Object.fromEntries(candidates[0].attributes) 
          : candidates[0].attributes
      );
      console.log('Target values:', targetValues);
    }
    
    // Calculate initial scores using enhanced fuzzy logic
    const updatedCandidates = await Promise.all(
      candidates.map(async candidate => {
        // Create weights and attributes for fuzzy scoring
        const weights = job.finalWeights || {}; // Job criteria weights
        
        // IMPORTANT FIX: Convert Map to plain object if needed
        const weightsObject = weights instanceof Map ? 
          Object.fromEntries(weights.entries()) : weights;
        
        const attributes = {}; // Will hold fuzzy scores
        const attributeConfidences = {}; // Will hold confidence scores
        
        // Prepare atomic updates for MongoDB
        const attributeUpdates = {};
        let foundAttributes = false;
        
        // Calculate fuzzy scores for each attribute
        for (const [key, targetValue] of Object.entries(targetValues)) {
          // Safely access attribute value whether from Map or plain object
          let candidateValue;
          if (candidate.attributes instanceof Map) {
            candidateValue = candidate.attributes.get(key);
          } else if (candidate.attributes && typeof candidate.attributes === 'object') {
            candidateValue = candidate.attributes[key];
          }
          
          // Debug: Log attribute match attempts
          console.log(`Checking attribute ${key} for candidate ${candidate._id}: ${candidateValue !== undefined ? 'found' : 'not found'}`);
          
          if (candidateValue !== undefined) {
            foundAttributes = true;
            // Calculate fuzzy score using the specified membership function
            const fuzzyScore = calculateFuzzyScore(
              candidateValue, 
              targetValue, 
              fuzzyFactor,
              membershipType
            );
            
            // Debug: Log calculated fuzzy score
            console.log(`Calculated fuzzy score for ${key}: ${fuzzyScore} (candidate value: ${candidateValue}, target: ${targetValue})`);
            
            // Store for WSM calculation
            attributes[key] = fuzzyScore;
            
            // Add any confidence weighting
            attributeConfidences[key] = confidenceWeights[key] || 1.0;
            
            // Store for MongoDB update
            attributeUpdates[`attributes.${key}_fuzzyScore`] = fuzzyScore;
            attributeUpdates[`attributes.${key}_membershipFunction`] = membershipType;
            attributeUpdates[`attributes.${key}_confidence`] = attributeConfidences[key];
          }
        }
        
        // If no matching attributes were found, provide a helpful error
        if (!foundAttributes) {
          console.log(`No matching attributes found for candidate ${candidate._id}`);
        }
        
        // Apply WSM with confidence-weighted attributes
        const scoreResult = applyWSM(attributes, weightsObject, attributeConfidences);
        
        // Debug: Log WSM results
        console.log(`Score calculation for ${candidate._id}:`, {
          attributes,
          weights: weightsObject, 
          confidences: attributeConfidences,
          result: scoreResult
        });
        
        // Store overall confidence
        attributeUpdates['attributes.initialScore_confidence'] = scoreResult.confidence;
        
        // Update candidate with atomic operations
        return await Candidate.findByIdAndUpdate(
          candidate._id,
          { 
            $set: {
              ...attributeUpdates,
              initialScore: scoreResult.score,
              confidenceScore: scoreResult.confidence
            }
          },
          { new: true }
        );
      })
    );
    
    // Format candidates for ranking (with proper Map handling)
    const candidatesForRanking = updatedCandidates.map(c => {
      const plainObj = c.toObject ? c.toObject() : {...c};
      return {
        ...plainObj,
        finalScore: plainObj.initialScore || 0,
        confidence: plainObj.confidenceScore || 
                   (plainObj.attributes && 
                    (plainObj.attributes instanceof Map 
                      ? plainObj.attributes.get('initialScore_confidence') 
                      : plainObj.attributes['initialScore_confidence'])) || 
                   1.0
      };
    });
    
    // Apply ranking algorithm with confidence as tiebreaker
    const rankedCandidates = rankCandidates(candidatesForRanking);
    
    res.json({
      jobId,
      jobTitle: job.title,
      totalCandidates: candidates.length,
      fuzzyLogicSettings: {
        membershipFunction: membershipType,
        fuzzyFactor
      },
      rankedCandidates: rankedCandidates.map(c => ({
        id: c._id,
        name: `${c.firstName} ${c.lastName}`,
        email: c.email,
        initialScore: c.initialScore || c.finalScore,
        confidence: c.confidence || c.confidenceScore || 1.0,
        rank: c.rank,
        percentile: c.percentile
      }))
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Shortlist candidates based on initial scores and thresholds
router.post('/shortlist/:jobId', [
  body('threshold').isFloat({ min: 0, max: 1 }).withMessage('Threshold must be between 0 and 1'),
  body('maxCandidates').optional().isInt({ min: 1 }).withMessage('Max candidates must be a positive integer'),
  body('criteriaThresholds').optional().isObject().withMessage('Criteria thresholds must be an object'),
  body('alphaCutThreshold').optional().isFloat({ min: 0, max: 1 }).withMessage('Alpha-cut threshold must be between 0 and 1'),
  body('thresholdFuzzyFactor').optional().isFloat({ min: 0, max: 0.5 }).withMessage('Threshold fuzzy factor must be between 0 and 0.5')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { jobId } = req.params;
    const { 
      threshold, 
      maxCandidates, 
      criteriaThresholds = {}, 
      alphaCutThreshold = 0.5,  // Minimum confidence to consider an attribute
      thresholdFuzzyFactor = 0.1 // How much tolerance to apply to thresholds
    } = req.body;
    
    // Get job
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }
    
    // Get all candidates for the job with initial scores
    let candidates = await Candidate.find({ 
      jobId,
      initialScore: { $exists: true }
    }).sort({ initialScore: -1 });
    
    if (candidates.length === 0) {
      return res.status(404).json({ message: 'No scored candidates found for this job' });
    }
    
    // Apply hard criteria filtering with fuzzy thresholds
    let filteredCandidates = [...candidates];
    
    if (Object.keys(criteriaThresholds).length > 0) {
      // Filter based on criteria thresholds
      filteredCandidates = candidates.filter(candidate => {
        // For each criteria threshold
        for (const [key, thresholdValue] of Object.entries(criteriaThresholds)) {
          // Get the candidate's value and confidence for this attribute
          let candidateValue, candidateConfidence;
          
          // Handle different attribute storage strategies (Map or plain object)
          if (candidate.attributes instanceof Map) {
            candidateValue = candidate.attributes.get(key);
            candidateConfidence = candidate.attributes.get(`${key}_confidence`) || 1.0;
          } else if (candidate.attributes && typeof candidate.attributes === 'object') {
            candidateValue = candidate.attributes[key];
            candidateConfidence = candidate.attributes[`${key}_confidence`] || 1.0;
          }
          
          // Skip if attribute doesn't exist
          if (candidateValue === undefined) return false;
          
          // Skip low-confidence attributes if using alpha-cut
          if (candidateConfidence < alphaCutThreshold) return false;
          
          // Apply fuzzy threshold with tolerance based on data type
          if (typeof candidateValue === 'number' && typeof thresholdValue === 'number') {
            // For numeric values: apply fuzzy factor
            const fuzzyThreshold = thresholdValue * (1 - thresholdFuzzyFactor);
            if (candidateValue < fuzzyThreshold) return false;
          } 
          else if (typeof candidateValue === 'string' && typeof thresholdValue === 'string') {
            // For strings: use similarity score
            const similarity = calculateStringSimilarity(candidateValue, thresholdValue);
            if (similarity < 0.7) return false; // Must be at least 70% similar
          }
          else if (Array.isArray(candidateValue) && Array.isArray(thresholdValue)) {
            // For arrays: check if threshold array is subset
            const similarity = calculateArraySimilarity(candidateValue, thresholdValue);
            if (similarity < 0.7) return false; // Must contain most threshold elements
          }
          // For boolean or other types: require exact match
          else if (candidateValue !== thresholdValue) {
            return false;
          }
        }
        return true;
      });
    }
    
    // Apply fuzzy threshold to initial score (allow scores slightly below threshold)
    const scoreThreshold = threshold * (1 - thresholdFuzzyFactor); 
    let shortlistedCandidates = filteredCandidates.filter(c => c.initialScore >= scoreThreshold);
    
    // Weight shortlisted candidates by confidence score
    shortlistedCandidates = shortlistedCandidates.map(c => ({
      ...c.toObject(),
      // Include confidence score as tiebreaker
      confidenceScore: c.confidenceScore || 
                      (c.attributes instanceof Map 
                        ? c.attributes.get('initialScore_confidence') 
                        : c.attributes.initialScore_confidence) || 
                      1.0
    }));
    
    // Rank by initial score with confidence as tiebreaker
    shortlistedCandidates = rankCandidates(shortlistedCandidates).map(c => ({
      ...c,
      finalScore: c.initialScore // Convert finalScore from ranking back to initialScore
    }));
    
    // Limit to maxCandidates if specified
    if (maxCandidates && shortlistedCandidates.length > maxCandidates) {
      shortlistedCandidates = shortlistedCandidates.slice(0, maxCandidates);
    }
    
    // Update shortlisted status for all candidates
    const shortlistedIds = shortlistedCandidates.map(c => c._id);
    
    // Mark candidates as shortlisted
    await Candidate.updateMany(
      { jobId, _id: { $in: shortlistedIds } },
      { 
        isShortlisted: true, 
        status: 'screening',
        passedThreshold: true
      }
    );
    
    // Mark non-shortlisted candidates
    await Candidate.updateMany(
      { jobId, _id: { $nin: shortlistedIds } },
      { 
        isShortlisted: false,
        passedThreshold: false 
      }
    );
    
    res.json({
      jobId,
      jobTitle: job.title,
      fuzzyLogic: {
        scoreThreshold: scoreThreshold,
        originalThreshold: threshold,
        fuzzyFactor: thresholdFuzzyFactor,
        alphaCutConfidence: alphaCutThreshold
      },
      totalCandidates: candidates.length,
      shortlistedCount: shortlistedCandidates.length,
      shortlistedCandidates: shortlistedCandidates.map(c => ({
        rank: c.rank,
        id: c._id,
        name: `${c.firstName} ${c.lastName}`,
        email: c.email,
        initialScore: c.initialScore,
        confidence: c.confidenceScore,
        percentile: c.percentile,
        status: 'screening'
      }))
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get shortlisted candidates for a job
router.get('/shortlisted/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    // Check if job exists
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }
    
    // Get shortlisted candidates
    const shortlistedCandidates = await Candidate.find({
      jobId,
      isShortlisted: true
    }).sort({ initialScore: -1 });
    
    if (shortlistedCandidates.length === 0) {
      return res.status(404).json({ message: 'No shortlisted candidates found for this job' });
    }
    
    res.json({
      jobId,
      jobTitle: job.title,
      totalShortlisted: shortlistedCandidates.length,
      shortlistedCandidates: shortlistedCandidates.map((c, index) => ({
        rank: index + 1,
        id: c._id,
        name: `${c.firstName} ${c.lastName}`,
        email: c.email,
        initialScore: c.initialScore,
        status: c.status,
        interviewStage: getInterviewStage(c)
      }))
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Calculate and update stage scores for a candidate
router.post('/stage/:id', [
  body('stage').isIn(['phoneScreen', 'codingInterview', 'onsiteInterview']).withMessage('Invalid stage'),
  body('stageWeight').isFloat({ min: 0, max: 1 }).withMessage('Stage weight must be between 0 and 1')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { id } = req.params;
    const { stage, stageWeight } = req.body;
    
    const candidate = await Candidate.findById(id);
    if (!candidate) {
      return res.status(404).json({ message: 'Candidate not found' });
    }

    // Check if stage is completed
    if (!candidate.stages[stage] || !candidate.stages[stage].completed) {
      return res.status(400).json({ message: `${stage} is not completed yet` });
    }

    // Calculate stage score based on the stage type
    let attributes = {};
    let weights = {};
    let confidenceScores = {};

    switch (stage) {
      case 'phoneScreen':
        // Get communication skill score
        const commSkillScore = candidate.stages.phoneScreen.communicationSkillScore || 0;
        attributes = { communicationSkill: commSkillScore };
        weights = { communicationSkill: 1.0 }; // Full weight since it's the only attribute
        confidenceScores = { communicationSkill: 0.9 }; // Example confidence
        break;

      case 'codingInterview':
        // Get problem-solving score
        const problemSolvingScore = candidate.stages.codingInterview.problemSolvingScore || 0;
        attributes = { problemSolving: problemSolvingScore };
        weights = { problemSolving: 1.0 }; // Full weight since it's the only attribute
        confidenceScores = { problemSolving: 0.85 }; // Example confidence
        break;

      case 'onsiteInterview':
        // Get system design score
        const systemDesignScore = candidate.stages.onsiteInterview.systemDesignScore || 0;
        attributes = { systemDesign: systemDesignScore };
        weights = { systemDesign: 1.0 }; // Full weight since it's the only attribute
        confidenceScores = { systemDesign: 0.9 }; // Example confidence
        break;
    }

    // Apply weighted sum model to calculate stage score with confidence
    const scoreResult = applyWSM(attributes, weights, confidenceScores);

    // Update the stage score and confidence
    const updates = {};
    updates[`stages.${stage}.score`] = scoreResult.score;
    updates[`stages.${stage}.confidence`] = scoreResult.confidence;
    
    const updatedCandidate = await Candidate.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true }
    );
    
    res.json({
      candidateId: id,
      stage,
      stageScore: scoreResult.score,
      confidence: scoreResult.confidence,
      attributes,
      weights,
      confidenceScores,
      updatedCandidate
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Calculate and update final scores for all candidates of a job
router.post('/final/:jobId', [
  body('stageWeights').isObject().withMessage('Stage weights must be an object'),
  body('stageWeights.phoneScreen').optional().isFloat({ min: 0, max: 1 }).withMessage('Phone screen weight must be between 0 and 1'),
  body('stageWeights.codingInterview').optional().isFloat({ min: 0, max: 1 }).withMessage('Coding interview weight must be between 0 and 1'),
  body('stageWeights.onsiteInterview').optional().isFloat({ min: 0, max: 1 }).withMessage('Onsite interview weight must be between 0 and 1'),
  body('aggregationMethod').optional().isIn(['wsm', 'owa']).withMessage('Aggregation method must be either wsm or owa'),
  body('strategyProfile').optional().isIn(['optimistic', 'balanced', 'pessimistic', 'custom']).withMessage('Strategy must be optimistic, balanced, pessimistic, or custom'),
  body('owaWeights').optional().isArray().withMessage('OWA weights must be an array if using custom strategy'),
  body('alphaCutThreshold').optional().isFloat({ min: 0, max: 1 }).withMessage('Alpha-cut threshold must be between 0 and 1')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { jobId } = req.params;
    const { 
      stageWeights, 
      aggregationMethod = 'wsm', 
      strategyProfile = 'balanced',
      owaWeights: customOwaWeights = null, 
      alphaCutThreshold = 0.5 
    } = req.body;
    
    // Normalize and default stage weights if not provided
    const finalStageWeights = {
      phoneScreen: stageWeights.phoneScreen || 0.3,
      codingInterview: stageWeights.codingInterview || 0.4,
      onsiteInterview: stageWeights.onsiteInterview || 0.3
    };
    
    // Normalize weights to sum to 1
    const totalWeight = Object.values(finalStageWeights).reduce((sum, w) => sum + w, 0);
    if (totalWeight !== 1) {
      Object.keys(finalStageWeights).forEach(key => {
        finalStageWeights[key] = finalStageWeights[key] / totalWeight;
      });
    }
    
    // Get job and candidates
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }
    
    // Get candidates with required data
    const candidates = await Candidate.find({ 
      jobId, 
      passedThreshold: true 
    });
    
    if (candidates.length === 0) {
      return res.status(404).json({ message: 'No candidates found for this job' });
    }
    
    // Prepare OWA weights if using OWA aggregation
    let owaWeights = null;
    if (aggregationMethod === 'owa') {
      if (strategyProfile === 'custom' && Array.isArray(customOwaWeights)) {
        // Use custom weights
        owaWeights = customOwaWeights;
      } else {
        // Calculate based on strategy
        const stageCount = Object.keys(finalStageWeights).length;
        
        switch(strategyProfile) {
          case 'optimistic':
            // More weight on highest scores (descending weights)
            owaWeights = Array(stageCount).fill(0).map((_, i) => 
              (stageCount - i) / ((stageCount * (stageCount + 1)) / 2)
            );
            break;
          case 'pessimistic':
            // More weight on lowest scores (ascending weights)
            owaWeights = Array(stageCount).fill(0).map((_, i) => 
              (i + 1) / ((stageCount * (stageCount + 1)) / 2)
            );
            break;
          case 'balanced':
          default:
            // Equal weights
            owaWeights = Array(stageCount).fill(1 / stageCount);
            break;
        }
      }
      
      // Normalize OWA weights to sum to 1
      const totalOwaWeight = owaWeights.reduce((sum, w) => sum + w, 0);
      if (totalOwaWeight !== 1) {
        owaWeights = owaWeights.map(w => w / totalOwaWeight);
      }
    }
    
    // Calculate final score for each candidate
    const updatedCandidates = await Promise.all(
      candidates.map(async candidate => {
        // Collect stage scores
        const stageScores = {
          phoneScreen: candidate.stages.phoneScreen.score || 0,
          codingInterview: candidate.stages.codingInterview.score || 0,
          onsiteInterview: candidate.stages.onsiteInterview.score || 0
        };
        
        // Collect confidence scores for each stage
        const stageConfidences = {
          phoneScreen: candidate.stages.phoneScreen.confidence || 1.0,
          codingInterview: candidate.stages.codingInterview.confidence || 1.0,
          onsiteInterview: candidate.stages.onsiteInterview.confidence || 1.0
        };
        
        // Apply alpha-cut if needed (filter out low-confidence scores)
        if (alphaCutThreshold > 0) {
          for (const stage in stageScores) {
            if (stageConfidences[stage] < alphaCutThreshold) {
              // Zero out the weight for this stage due to low confidence
              delete stageScores[stage];
            }
          }
        }
        
        let finalScore, confidenceScore;
        
        // Use the selected aggregation method
        if (aggregationMethod === 'owa' && owaWeights) {
          // Apply OWA with the configured weights
          finalScore = applyOWA(stageScores, finalStageWeights, owaWeights);
          
          // For OWA, calculate avg confidence separately
          const usedStages = Object.keys(stageScores);
          confidenceScore = usedStages.length > 0 
            ? usedStages.reduce((sum, stage) => sum + stageConfidences[stage], 0) / usedStages.length 
            : 0.5;
        } else {
          // Use traditional WSM with confidence weighting
          const result = aggregateStageScores(stageScores, finalStageWeights, stageConfidences);
          finalScore = result.score;
          confidenceScore = result.confidence;
        }
        
        // Update candidate with final score and confidence
        return await Candidate.findByIdAndUpdate(
          candidate._id,
          { 
            finalScore: finalScore, 
            confidenceScore: confidenceScore,
            aggregationMethod: aggregationMethod
          },
          { new: true }
        );
      })
    );
    
    // Rank candidates by final score with confidence as tiebreaker
    const rankedCandidates = rankCandidates(updatedCandidates);
    
    res.json({
      jobId,
      jobTitle: job.title,
      fuzzyLogicSettings: {
        aggregationMethod,
        strategyProfile,
        stageWeights: finalStageWeights,
        owaWeights: aggregationMethod === 'owa' ? owaWeights : null,
        alphaCutThreshold
      },
      totalCandidates: candidates.length,
      rankedCandidates: rankedCandidates.map(c => ({
        id: c._id,
        name: `${c.firstName} ${c.lastName}`,
        finalScore: c.finalScore,
        confidenceScore: c.confidenceScore || 1.0,
        rank: c.rank,
        percentile: c.percentile,
        status: c.status
      }))
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get ranked candidates for a job
router.get('/ranking/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    // Check if job exists
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }
    
    // Get and rank candidates
    const candidates = await Candidate.find({ 
      jobId, 
      passedThreshold: true,
      finalScore: { $exists: true }
    }).sort({ finalScore: -1 });
    
    if (candidates.length === 0) {
      return res.status(404).json({ message: 'No candidates found for this job' });
    }
    
    // Apply ranking with confidence as tiebreaker
    const rankedCandidates = rankCandidates(candidates.map(c => ({
      ...c.toObject(),
      confidence: c.confidenceScore || 1.0
    })));
    
    res.json({
      jobId,
      jobTitle: job.title,
      totalCandidates: candidates.length,
      rankedCandidates: rankedCandidates.map(c => ({
        rank: c.rank,
        id: c._id,
        name: `${c.firstName} ${c.lastName}`,
        email: c.email,
        finalScore: c.finalScore,
        confidenceScore: c.confidenceScore || c.confidence || 1.0,
        percentile: c.percentile,
        status: c.status,
        stages: {
          phoneScreen: c.stages.phoneScreen.completed ? c.stages.phoneScreen.score : 'Not completed',
          codingInterview: c.stages.codingInterview.completed ? c.stages.codingInterview.score : 'Not completed',
          onsiteInterview: c.stages.onsiteInterview.completed ? c.stages.onsiteInterview.score : 'Not completed'
        }
      }))
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Helper function to determine interview stage
function getInterviewStage(candidate) {
  if (candidate.stages.onsiteInterview.completed) {
    return 'Completed all interviews';
  } else if (candidate.stages.codingInterview.completed) {
    return 'Onsite pending';
  } else if (candidate.stages.phoneScreen.completed) {
    return 'Coding interview pending';
  } else {
    return 'Phone screen pending';
  }
}

module.exports = router; 