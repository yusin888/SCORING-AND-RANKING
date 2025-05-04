const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Candidate = require('../models/Candidate');
const Job = require('../models/Job');
const { applyHardCriteriaFilter, calculateFuzzyScore, aggregateStageScores, rankCandidates, applyOWA } = require('../utils/scoring');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../public/uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    if (extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only PDF, DOC, and DOCX files are allowed'));
    }
  }
});

// Get all candidates
router.get('/', async (req, res) => {
  try {
    const { jobId } = req.query;
    const query = jobId ? { jobId } : {};
    
    const candidates = await Candidate.find(query).sort({ finalScore: -1 });
    res.json(candidates);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get a specific candidate
router.get('/:id', async (req, res) => {
  try {
    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) {
      return res.status(404).json({ message: 'Candidate not found' });
    }
    res.json(candidate);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Submit a new candidate application
router.post(
  '/',
  upload.single('resume'),
  [
    body('firstName').notEmpty().withMessage('First name is required'),
    body('lastName').notEmpty().withMessage('Last name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('jobId').notEmpty().withMessage('Job ID is required')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const {
        firstName,
        lastName,
        email,
        phone,
        jobId,
        attributes
      } = req.body;

      // Check if job exists
      const job = await Job.findById(jobId);
      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      const resumeUrl = req.file ? `/uploads/${req.file.filename}` : '';

      // Parse attributes if it's a string
      let parsedAttributes = attributes;
      if (typeof attributes === 'string') {
        try {
          parsedAttributes = JSON.parse(attributes);
        } catch (e) {
          return res.status(400).json({ message: 'Invalid attributes format' });
        }
      }

      const newCandidate = new Candidate({
        firstName,
        lastName,
        email,
        phone,
        resumeUrl,
        jobId,
        attributes: new Map(Object.entries(parsedAttributes || {}))
      });

      const candidate = await newCandidate.save();
      res.status(201).json(candidate);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Apply threshold filtering to candidates
router.post('/job/:jobId/threshold-filter', async (req, res) => {
  try {
    const { jobId } = req.params;
    const { thresholds } = req.body;
    
    if (!thresholds || Object.keys(thresholds).length === 0) {
      return res.status(400).json({ message: 'Thresholds are required' });
    }
    
    // Check if job exists
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }
    
    // Get all candidates for the job
    let candidates = await Candidate.find({ jobId });
    
    // Apply hard criteria filter
    const filtered = applyHardCriteriaFilter(candidates, thresholds);
    
    // Update each candidate's passedThreshold status
    const filteredIds = filtered.map(c => c._id.toString());
    
    await Candidate.updateMany(
      { jobId, _id: { $nin: filteredIds } },
      { passedThreshold: false }
    );
    
    res.json({ 
      totalCandidates: candidates.length,
      passedCandidates: filtered.length,
      eliminatedCandidates: candidates.length - filtered.length
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Extract and save candidate attributes
router.post('/:id/extract-attributes', [
  body('attributes').isObject().withMessage('Attributes must be an object'),
  body('membershipType').optional().isIn(['simple', 'triangular', 'trapezoidal', 'gaussian']).withMessage('Invalid membership function type'),
  body('fuzzyFactor').optional().isFloat({ min: 0, max: 1 }).withMessage('Fuzzy factor must be between 0 and 1')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { id } = req.params;
    const { attributes, membershipType = 'simple', fuzzyFactor = 0.2 } = req.body;
    
    const candidate = await Candidate.findById(id);
    if (!candidate) {
      return res.status(404).json({ message: 'Candidate not found' });
    }
    
    // Get the job to check if attributes align with criteria
    const job = await Job.findById(candidate.jobId);
    if (!job) {
      return res.status(404).json({ message: 'Associated job not found' });
    }
    
    // Create a new map with the attributes
    const attributesMap = new Map();
    
    for (const [key, value] of Object.entries(attributes)) {
      attributesMap.set(key, value);
    }
    
    // Calculate fuzzy scores for criteria where applicable
    job.criteria.forEach(criterion => {
      const attributeValue = attributesMap.get(criterion.name);
      const criterionIdealValue = criterion.idealValue;
      
      if (attributeValue !== undefined && criterionIdealValue !== undefined) {
        // Use the enhanced fuzzy logic with the specified membership function
        const fuzzyScore = calculateFuzzyScore(
          attributeValue, 
          criterionIdealValue, 
          fuzzyFactor,
          membershipType
        );
        attributesMap.set(`${criterion.name}_fuzzyScore`, fuzzyScore);
        attributesMap.set(`${criterion.name}_membershipFunction`, membershipType);
      }
    });
    
    // Update candidate with new attributes
    candidate.attributes = attributesMap;
    await candidate.save();
    
    res.json({
      message: 'Candidate attributes extracted and saved',
      candidateId: id,
      fuzzyMethod: {
        fuzzyFactor,
        membershipType
      },
      attributes: Object.fromEntries(attributesMap)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update candidate stage information
router.put('/:id/stage/:stage', async (req, res) => {
  const { id, stage } = req.params;
  const { completed, score, notes, specificScore } = req.body;
  
  // Validate the stage
  const validStages = ['phoneScreen', 'codingInterview', 'onsiteInterview'];
  if (!validStages.includes(stage)) {
    return res.status(400).json({ message: 'Invalid stage' });
  }
  
  try {
    const candidate = await Candidate.findById(id);
    if (!candidate) {
      return res.status(404).json({ message: 'Candidate not found' });
    }
    
    // Update the stage data
    const updates = {};
    
    if (completed !== undefined) {
      updates[`stages.${stage}.completed`] = completed;
    }
    
    if (score !== undefined) {
      updates[`stages.${stage}.score`] = score;
    }
    
    if (notes !== undefined) {
      updates[`stages.${stage}.notes`] = notes;
    }
    
    // Update specific score based on stage
    if (specificScore !== undefined) {
      switch(stage) {
        case 'phoneScreen':
          updates['stages.phoneScreen.communicationSkillScore'] = specificScore;
          break;
        case 'codingInterview':
          updates['stages.codingInterview.problemSolvingScore'] = specificScore;
          break;
        case 'onsiteInterview':
          updates['stages.onsiteInterview.systemDesignScore'] = specificScore;
          break;
      }
    }
    
    const updatedCandidate = await Candidate.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true }
    );
    
    res.json(updatedCandidate);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Compute final scores and rank candidates
router.post('/job/:jobId/rank', [
  body('stageWeights').isObject().withMessage('Stage weights must be an object'),
  body('stageWeights.phoneScreen').optional().isFloat({ min: 0, max: 1 }).withMessage('Phone screen weight must be between 0 and 1'),
  body('stageWeights.codingInterview').optional().isFloat({ min: 0, max: 1 }).withMessage('Coding interview weight must be between 0 and 1'),
  body('stageWeights.onsiteInterview').optional().isFloat({ min: 0, max: 1 }).withMessage('Onsite interview weight must be between 0 and 1'),
  body('rankingMethod').optional().isIn(['wsm', 'owa']).withMessage('Ranking method must be either wsm or owa'),
  body('owaWeights').optional().isArray().withMessage('OWA weights must be an array'),
  body('strategy').optional().isIn(['optimistic', 'balanced', 'pessimistic']).withMessage('Strategy must be optimistic, balanced, or pessimistic')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { jobId } = req.params;
    const { 
      stageWeights, 
      rankingMethod = 'wsm', 
      owaWeights = null, 
      strategy = 'balanced' 
    } = req.body;
    
    // Default weights if not provided
    const finalStageWeights = {
      phoneScreen: stageWeights.phoneScreen || 0.3,
      codingInterview: stageWeights.codingInterview || 0.4,
      onsiteInterview: stageWeights.onsiteInterview || 0.3
    };
    
    // Get job and candidates
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }
    
    // Get candidates that passed threshold filtering
    const candidates = await Candidate.find({ 
      jobId, 
      passedThreshold: true,
      'stages.phoneScreen.completed': true,
      'stages.codingInterview.completed': true,
      'stages.onsiteInterview.completed': true
    });
    
    if (candidates.length === 0) {
      return res.status(404).json({ message: 'No candidates with completed interviews found for this job' });
    }
    
    // Calculate OWA weights based on strategy if not provided
    let finalOwaWeights = owaWeights;
    if (rankingMethod === 'owa' && !owaWeights) {
      const weightCount = Object.keys(finalStageWeights).length;
      
      switch(strategy) {
        case 'optimistic':
          // More weight on higher scores
          finalOwaWeights = Array(weightCount).fill(0).map((_, i) => 
            (weightCount - i) / ((weightCount * (weightCount + 1)) / 2)
          );
          break;
        case 'pessimistic':
          // More weight on lower scores
          finalOwaWeights = Array(weightCount).fill(0).map((_, i) => 
            (i + 1) / ((weightCount * (weightCount + 1)) / 2)
          );
          break;
        case 'balanced':
        default:
          // Equal weights
          finalOwaWeights = Array(weightCount).fill(1 / weightCount);
          break;
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
        
        let finalScore;
        
        // Use selected ranking method
        if (rankingMethod === 'owa' && finalOwaWeights) {
          // Apply OWA with specified weights
          finalScore = applyOWA(stageScores, finalStageWeights, finalOwaWeights);
        } else {
          // Use traditional WSM
          finalScore = aggregateStageScores(stageScores, finalStageWeights);
        }
        
        // Add confidence scores based on interview feedback consistency
        const confidenceScore = calculateConfidenceScore(candidate);
        
        // Update candidate with final score
        return await Candidate.findByIdAndUpdate(
          candidate._id,
          { 
            finalScore,
            confidenceScore
          },
          { new: true }
        );
      })
    );
    
    // Rank candidates by final score
    const rankedCandidates = rankCandidates(updatedCandidates);
    
    res.json({
      message: 'Candidates ranked successfully',
      jobId,
      jobTitle: job.title,
      rankingMethod,
      strategy: rankingMethod === 'owa' ? strategy : null,
      stageWeights: finalStageWeights,
      owaWeights: rankingMethod === 'owa' ? finalOwaWeights : null,
      totalCandidates: candidates.length,
      rankedCandidates: rankedCandidates.map((c, index) => ({
        rank: index + 1,
        id: c._id,
        name: `${c.firstName} ${c.lastName}`,
        finalScore: c.finalScore,
        confidenceScore: c.confidenceScore || 1.0
      }))
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * Calculate confidence score based on consistency of interview feedback
 * @param {Object} candidate - Candidate object with interview stages
 * @returns {Number} - Confidence score between 0 and 1
 */
const calculateConfidenceScore = (candidate) => {
  const scores = [];
  
  // Collect all available scores
  if (candidate.stages.phoneScreen.completed && candidate.stages.phoneScreen.score) {
    scores.push(candidate.stages.phoneScreen.score);
  }
  
  if (candidate.stages.codingInterview.completed && candidate.stages.codingInterview.score) {
    scores.push(candidate.stages.codingInterview.score);
  }
  
  if (candidate.stages.onsiteInterview.completed && candidate.stages.onsiteInterview.score) {
    scores.push(candidate.stages.onsiteInterview.score);
  }
  
  if (scores.length <= 1) return 1.0; // Not enough data
  
  // Calculate standard deviation
  const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const squaredDiffs = scores.map(score => Math.pow(score - mean, 2));
  const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / scores.length;
  const stdDev = Math.sqrt(variance);
  
  // Normalize standard deviation to confidence score
  // Lower standard deviation = higher confidence
  const normalizedStdDev = Math.min(stdDev / 0.3, 1); // 0.3 is considered high variance
  const confidenceScore = 1 - normalizedStdDev;
  
  return confidenceScore;
};

// Get final ranked candidate list
router.get('/job/:jobId/ranked', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    // Check if job exists
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }
    
    // Get ranked candidates
    const candidates = await Candidate.find({ 
      jobId, 
      passedThreshold: true,
      finalScore: { $exists: true, $ne: null }
    }).sort({ finalScore: -1 });
    
    if (candidates.length === 0) {
      return res.status(404).json({ message: 'No ranked candidates found for this job' });
    }
    
    res.json({
      jobId,
      jobTitle: job.title,
      totalCandidates: candidates.length,
      rankedCandidates: candidates.map((c, index) => ({
        rank: index + 1,
        id: c._id,
        name: `${c.firstName} ${c.lastName}`,
        email: c.email,
        finalScore: c.finalScore,
        status: c.status,
        stages: {
          phoneScreen: c.stages.phoneScreen.score,
          codingInterview: c.stages.codingInterview.score,
          onsiteInterview: c.stages.onsiteInterview.score
        }
      }))
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete a candidate
router.delete('/:id', async (req, res) => {
  try {
    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) {
      return res.status(404).json({ message: 'Candidate not found' });
    }
    
    // Delete resume file if it exists
    if (candidate.resumeUrl) {
      const filePath = path.join(__dirname, '../../public', candidate.resumeUrl);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    
    await candidate.deleteOne();
    res.json({ message: 'Candidate removed' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 