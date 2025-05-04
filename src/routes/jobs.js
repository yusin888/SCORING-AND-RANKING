const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Job = require('../models/Job');
const { applyDelphiTechnique } = require('../utils/scoring');

// Get all jobs
router.get('/', async (req, res) => {
  try {
    const jobs = await Job.find().sort({ createdAt: -1 });
    res.json(jobs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get a specific job
router.get('/:id', async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }
    res.json(job);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a new job
router.post(
  '/',
  [
    body('title').notEmpty().withMessage('Title is required'),
    body('description').notEmpty().withMessage('Description is required'),
    body('department').notEmpty().withMessage('Department is required'),
    body('location').notEmpty().withMessage('Location is required'),
    body('criteria').isArray().withMessage('Criteria must be an array'),
    body('criteria.*.name').notEmpty().withMessage('Criterion name is required'),
    body('criteria.*.weight').isFloat({ min: 0, max: 1 }).withMessage('Weight must be between 0 and 1')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const {
        title,
        description,
        department,
        location,
        criteria,
        usesMultipleHR
      } = req.body;

      // Create initial weights map
      const finalWeights = {};
      criteria.forEach(criterion => {
        finalWeights[criterion.name] = criterion.weight;
      });

      const newJob = new Job({
        title,
        description,
        department,
        location,
        criteria,
        usesMultipleHR,
        finalWeights
      });

      const job = await newJob.save();
      res.status(201).json(job);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Update job weights using Delphi technique
router.put('/:id/refine-weights', async (req, res) => {
  try {
    const { hrWeights } = req.body;
    
    if (!Array.isArray(hrWeights) || hrWeights.length === 0) {
      return res.status(400).json({ message: 'HR weights must be a non-empty array' });
    }
    
    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }
    
    // Apply Delphi technique to refine weights
    const finalWeights = applyDelphiTechnique(hrWeights);
    
    // Update job with new weights
    job.finalWeights = finalWeights;
    job.usesMultipleHR = true;
    
    await job.save();
    
    res.json(job);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Finalize weights (without Delphi technique)
router.put('/:id/finalize-weights', [
  body('weights').isObject().withMessage('Weights must be an object'),
  body('weights.*').isFloat({ min: 0, max: 1 }).withMessage('Weight values must be between 0 and 1')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { id } = req.params;
    const { weights } = req.body;
    
    const job = await Job.findById(id);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }
    
    // Normalize weights to ensure they sum to 1
    const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
    const normalizedWeights = {};
    
    if (totalWeight > 0) {
      Object.keys(weights).forEach(key => {
        normalizedWeights[key] = weights[key] / totalWeight;
      });
    } else {
      return res.status(400).json({ message: 'Sum of weights must be greater than 0' });
    }
    
    // Update job with finalized weights
    job.finalWeights = normalizedWeights;
    
    await job.save();
    
    res.json({
      message: 'Weights finalized successfully',
      job
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete a job
router.delete('/:id', async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }
    
    await job.deleteOne();
    res.json({ message: 'Job removed' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 