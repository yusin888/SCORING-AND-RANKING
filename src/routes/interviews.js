const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Interview = require('../models/Interview');
const Candidate = require('../models/Candidate');
const Job = require('../models/Job');

// Get all interviews
router.get('/', async (req, res) => {
  try {
    const { candidateId, jobId, status } = req.query;
    const query = {};
    
    if (candidateId) query.candidateId = candidateId;
    if (jobId) query.jobId = jobId;
    if (status) query.status = status;
    
    const interviews = await Interview.find(query).sort({ scheduledDate: 1 });
    res.json(interviews);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get specific interview
router.get('/:id', async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.id);
    if (!interview) {
      return res.status(404).json({ message: 'Interview not found' });
    }
    res.json(interview);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Schedule a new interview
router.post('/', [
  body('candidateId').isMongoId().withMessage('Valid candidate ID is required'),
  body('jobId').isMongoId().withMessage('Valid job ID is required'),
  body('scheduledDate').isISO8601().withMessage('Valid scheduled date is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { candidateId, jobId, scheduledDate, stages } = req.body;
    
    // Verify candidate and job exist
    const candidate = await Candidate.findById(candidateId);
    if (!candidate) {
      return res.status(404).json({ message: 'Candidate not found' });
    }
    
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }
    
    // Create new interview
    const newInterview = new Interview({
      candidateId,
      jobId,
      scheduledDate: new Date(scheduledDate),
      stages: stages || {}
    });
    
    const interview = await newInterview.save();
    
    // Update candidate status to 'interviewing'
    await Candidate.findByIdAndUpdate(
      candidateId,
      { status: 'interviewing' }
    );
    
    res.status(201).json(interview);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update phone screen results (Stage 1)
router.put('/:id/stage1', [
  body('completed').isBoolean().withMessage('Completed status is required'),
  body('communicationScore').optional().isFloat({ min: 0, max: 1 }).withMessage('Communication score must be between 0 and 1')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { id } = req.params;
    const { completed, communicationScore, date, interviewer, notes } = req.body;
    
    // Find the interview
    const interview = await Interview.findById(id);
    if (!interview) {
      return res.status(404).json({ message: 'Interview not found' });
    }
    
    // Update the phone screen stage
    const updates = {
      'stages.phoneScreen.completed': completed,
      'stages.phoneScreen.scheduled': true
    };
    
    if (communicationScore !== undefined) {
      updates['stages.phoneScreen.communicationScore'] = communicationScore;
    }
    
    if (date) {
      updates['stages.phoneScreen.date'] = new Date(date);
    }
    
    if (interviewer) {
      updates['stages.phoneScreen.interviewer'] = interviewer;
    }
    
    if (notes) {
      updates['stages.phoneScreen.notes'] = notes;
    }
    
    const updatedInterview = await Interview.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true }
    );
    
    // If completed, update the candidate's stage information
    if (completed && communicationScore !== undefined) {
      await Candidate.findByIdAndUpdate(
        interview.candidateId,
        { 
          $set: {
            'stages.phoneScreen.completed': true,
            'stages.phoneScreen.communicationSkillScore': communicationScore
          }
        }
      );
    }
    
    res.json(updatedInterview);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update coding interview results (Stage 2)
router.put('/:id/stage2', [
  body('completed').isBoolean().withMessage('Completed status is required'),
  body('problemSolvingScore').optional().isFloat({ min: 0, max: 1 }).withMessage('Problem solving score must be between 0 and 1')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { id } = req.params;
    const { completed, problemSolvingScore, date, interviewer, notes } = req.body;
    
    // Find the interview
    const interview = await Interview.findById(id);
    if (!interview) {
      return res.status(404).json({ message: 'Interview not found' });
    }
    
    // Update the coding interview stage
    const updates = {
      'stages.codingInterview.completed': completed,
      'stages.codingInterview.scheduled': true
    };
    
    if (problemSolvingScore !== undefined) {
      updates['stages.codingInterview.problemSolvingScore'] = problemSolvingScore;
    }
    
    if (date) {
      updates['stages.codingInterview.date'] = new Date(date);
    }
    
    if (interviewer) {
      updates['stages.codingInterview.interviewer'] = interviewer;
    }
    
    if (notes) {
      updates['stages.codingInterview.notes'] = notes;
    }
    
    const updatedInterview = await Interview.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true }
    );
    
    // If completed, update the candidate's stage information
    if (completed && problemSolvingScore !== undefined) {
      await Candidate.findByIdAndUpdate(
        interview.candidateId,
        { 
          $set: {
            'stages.codingInterview.completed': true,
            'stages.codingInterview.problemSolvingScore': problemSolvingScore
          }
        }
      );
    }
    
    res.json(updatedInterview);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update onsite interview results (Stage 3)
router.put('/:id/stage3', [
  body('completed').isBoolean().withMessage('Completed status is required'),
  body('systemDesignScore').optional().isFloat({ min: 0, max: 1 }).withMessage('System design score must be between 0 and 1')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { id } = req.params;
    const { completed, systemDesignScore, date, interviewer, notes } = req.body;
    
    // Find the interview
    const interview = await Interview.findById(id);
    if (!interview) {
      return res.status(404).json({ message: 'Interview not found' });
    }
    
    // Update the onsite interview stage
    const updates = {
      'stages.onsiteInterview.completed': completed,
      'stages.onsiteInterview.scheduled': true
    };
    
    if (systemDesignScore !== undefined) {
      updates['stages.onsiteInterview.systemDesignScore'] = systemDesignScore;
    }
    
    if (date) {
      updates['stages.onsiteInterview.date'] = new Date(date);
    }
    
    if (interviewer) {
      updates['stages.onsiteInterview.interviewer'] = interviewer;
    }
    
    if (notes) {
      updates['stages.onsiteInterview.notes'] = notes;
    }
    
    const updatedInterview = await Interview.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true }
    );
    
    // If completed, update the candidate's stage information
    if (completed && systemDesignScore !== undefined) {
      await Candidate.findByIdAndUpdate(
        interview.candidateId,
        { 
          $set: {
            'stages.onsiteInterview.completed': true,
            'stages.onsiteInterview.systemDesignScore': systemDesignScore
          }
        }
      );
    }
    
    res.json(updatedInterview);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Cancel an interview
router.put('/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const interview = await Interview.findById(id);
    if (!interview) {
      return res.status(404).json({ message: 'Interview not found' });
    }
    
    interview.status = 'cancelled';
    if (reason) {
      interview.cancelReason = reason;
    }
    
    await interview.save();
    
    res.json(interview);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 