const mongoose = require('mongoose');

const candidateSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    unique: true
  },
  phone: {
    type: String,
    trim: true
  },
  resumeUrl: {
    type: String,
    trim: true
  },
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: true
  },
  attributes: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  parsedResume: {
    type: mongoose.Schema.Types.Mixed
  },
  passedThreshold: {
    type: Boolean,
    default: true
  },
  // Initial score before interviews (based on fuzzy scoring)
  initialScore: {
    type: Number,
    min: 0,
    max: 1
  },
  // Initial score confidence
  confidenceScore: {
    type: Number,
    min: 0,
    max: 1
  },
  // Flag to indicate if the candidate is shortlisted for interviews
  isShortlisted: {
    type: Boolean,
    default: false
  },
  stages: {
    phoneScreen: {
      completed: { type: Boolean, default: false },
      score: { type: Number, min: 0, max: 1 },
      notes: String,
      communicationSkillScore: { type: Number, min: 0, max: 1 }
    },
    codingInterview: {
      completed: { type: Boolean, default: false },
      score: { type: Number, min: 0, max: 1 },
      notes: String,
      problemSolvingScore: { type: Number, min: 0, max: 1 }
    },
    onsiteInterview: {
      completed: { type: Boolean, default: false },
      score: { type: Number, min: 0, max: 1 },
      notes: String,
      systemDesignScore: { type: Number, min: 0, max: 1 }
    }
  },
  finalScore: {
    type: Number,
    min: 0,
    max: 1
  },
  status: {
    type: String,
    enum: ['applied', 'screening', 'interviewing', 'offer', 'hired', 'rejected'],
    default: 'applied'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt timestamp before saving
candidateSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Candidate = mongoose.model('Candidate', candidateSchema);

module.exports = Candidate; 