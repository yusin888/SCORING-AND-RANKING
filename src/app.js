const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

// Import database connection
const connectDB = require('./utils/db');

// Import routes
const jobRoutes = require('./routes/jobs');
const candidateRoutes = require('./routes/candidates');
const scoreRoutes = require('./routes/scores');
const interviewRoutes = require('./routes/interviews');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Basic health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', message: 'Server is running' });
});

// API Routes
app.use('/api/jobs', jobRoutes);
app.use('/api/candidates', candidateRoutes);
app.use('/api/scores', scoreRoutes);
app.use('/api/interviews', interviewRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Candidate Scoring and Ranking API',
    documentation: '/api'
  });
});

// API documentation route
app.get('/api', (req, res) => {
  res.json({
    message: 'Welcome to the Candidate Scoring and Ranking API',
    endpoints: {
      jobs: {
        getAllJobs: 'GET /api/jobs',
        getJob: 'GET /api/jobs/:id',
        createJob: 'POST /api/jobs',
        refineWeights: 'PUT /api/jobs/:id/refine-weights',
        finalizeWeights: 'PUT /api/jobs/:id/finalize-weights',
        deleteJob: 'DELETE /api/jobs/:id'
      },
      candidates: {
        getAllCandidates: 'GET /api/candidates',
        getCandidate: 'GET /api/candidates/:id',
        createCandidate: 'POST /api/candidates',
        thresholdFilter: 'POST /api/candidates/job/:jobId/threshold-filter',
        extractAttributes: 'POST /api/candidates/:id/extract-attributes',
        updateStage: 'PUT /api/candidates/:id/stage/:stage',
        rankCandidates: 'POST /api/candidates/job/:jobId/rank',
        getRankedCandidates: 'GET /api/candidates/job/:jobId/ranked',
        deleteCandidate: 'DELETE /api/candidates/:id'
      },
      interviews: {
        getAllInterviews: 'GET /api/interviews',
        getInterview: 'GET /api/interviews/:id',
        scheduleInterview: 'POST /api/interviews',
        updatePhoneScreen: 'PUT /api/interviews/:id/stage1',
        updateCodingInterview: 'PUT /api/interviews/:id/stage2',
        updateOnsiteInterview: 'PUT /api/interviews/:id/stage3',
        cancelInterview: 'PUT /api/interviews/:id/cancel'
      },
      scores: {
        calculateStageScore: 'POST /api/scores/stage/:id',
        calculateFinalScores: 'POST /api/scores/final/:jobId',
        getRanking: 'GET /api/scores/ranking/:jobId'
      }
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'An unexpected error occurred',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server and connect to database
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();
    
    // Start the server
    app.listen(PORT, () => {
      console.log(`API server running on port ${PORT}`);
      console.log(`API documentation available at http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION! Shutting down...');
  console.error(err.name, err.message);
  process.exit(1);
});

startServer();

module.exports = app; 