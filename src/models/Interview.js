const mongoose = require('mongoose');

const interviewSchema = new mongoose.Schema({
  candidateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Candidate',
    required: true
  },
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: true
  },
  scheduledDate: {
    type: Date,
    required: true
  },
  stages: {
    phoneScreen: {
      scheduled: { type: Boolean, default: false },
      completed: { type: Boolean, default: false },
      date: Date,
      interviewer: String,
      communicationScore: { type: Number, min: 0, max: 1 },
      notes: String
    },
    codingInterview: {
      scheduled: { type: Boolean, default: false },
      completed: { type: Boolean, default: false },
      date: Date,
      interviewer: String,
      problemSolvingScore: { type: Number, min: 0, max: 1 },
      notes: String
    },
    onsiteInterview: {
      scheduled: { type: Boolean, default: false },
      completed: { type: Boolean, default: false },
      date: Date,
      interviewer: String,
      systemDesignScore: { type: Number, min: 0, max: 1 },
      notes: String
    }
  },
  status: {
    type: String,
    enum: ['scheduled', 'in-progress', 'completed', 'cancelled'],
    default: 'scheduled'
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
interviewSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Check if all stages are completed and update status
interviewSchema.pre('save', function(next) {
  const allStagesCompleted = 
    this.stages.phoneScreen.completed && 
    this.stages.codingInterview.completed && 
    this.stages.onsiteInterview.completed;

  if (allStagesCompleted) {
    this.status = 'completed';
  } else if (
    this.stages.phoneScreen.completed || 
    this.stages.codingInterview.completed || 
    this.stages.onsiteInterview.completed
  ) {
    this.status = 'in-progress';
  }

  next();
});

const Interview = mongoose.model('Interview', interviewSchema);

module.exports = Interview; 