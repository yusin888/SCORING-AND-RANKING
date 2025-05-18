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
const talentTalkRoutes = require('./routes/talentTalk');

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
app.use('/api/talent-talk', talentTalkRoutes);

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
        fromParsedResume: 'POST /api/candidates/from-parsed-resume',
        uploadParseScore: 'POST /api/candidates/upload-parse-score',
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
        calculateInitialScores: 'POST /api/scores/initial/:jobId',
        shortlistCandidates: 'POST /api/scores/shortlist/:jobId',
        getShortlistedCandidates: 'GET /api/scores/shortlisted/:jobId',
        calculateStageScore: 'POST /api/scores/stage/:id',
        calculateFinalScores: 'POST /api/scores/final/:jobId',
        getRanking: 'GET /api/scores/ranking/:jobId'
      },
      talentTalk: {
        chatWithTalentTalk: 'POST /api/talent-talk/chat',
        getTalentTalkStatus: 'GET /api/talent-talk/status'
      }
    },
    requestBodies: {
      jobs: {
        createJob: {
          title: "String (required)",
          description: "String (required)",
          department: "String (required)",
          location: "String (required)",
          criteria: "Array of objects with name and weight properties (required)",
          usesMultipleHR: "Boolean (optional)"
        },
        refineWeights: {
          hrWeights: "Array of weight objects from multiple HR professionals"
        },
        finalizeWeights: {
          weights: "Object with criteria names as keys and weight values (0-1)"
        }
      },
      candidates: {
        createCandidate: {
          firstName: "String (required)",
          lastName: "String (required)",
          email: "String (required)",
          phone: "String (optional)",
          jobId: "String (required)",
          attributes: "Object (optional)",
          resume: "File upload (optional)"
        },
        fromParsedResume: {
          jobId: "String (required)",
          resumeData: "Object containing parsed resume information (required)",
          fuzzyFactor: "Number between 0-1 (optional, default: 0.2)",
          membershipType: "String: 'simple', 'triangular', 'trapezoidal', 'gaussian' (optional, default: 'simple')"
        },
        uploadParseScore: {
          jobId: "String (required)",
          resume: "File upload (required) - PDF, DOC, or DOCX resume file",
          fuzzyFactor: "Number between 0-1 (optional, default: 0.2)",
          membershipType: "String: 'triangular' (default), 'simple', 'trapezoidal', 'gaussian' (optional)"
        },
        thresholdFilter: {
          thresholds: "Object with criteria thresholds"
        },
        extractAttributes: {
          attributes: "Object with attribute key-value pairs",
          membershipType: "String: 'simple', 'triangular', 'trapezoidal', 'gaussian' (optional)",
          fuzzyFactor: "Number between 0-1 (optional)"
        },
        rankCandidates: {
          stageWeights: "Object with weights for each interview stage",
          rankingMethod: "String: 'wsm' or 'owa' (optional)",
          owaWeights: "Array of weight values (optional)",
          strategy: "String: 'optimistic', 'balanced', 'pessimistic' (optional)"
        }
      },
      interviews: {
        scheduleInterview: {
          candidateId: "String (required)",
          jobId: "String (required)",
          scheduledDate: "ISO8601 Date (required)",
          stages: "Object (optional)"
        },
        updateStages: {
          completed: "Boolean (required)",
          notes: "String (optional)",
          date: "Date (optional)",
          interviewer: "String (optional)"
        }
      },
      scores: {
        calculateInitialScores: {
          targetValues: "Object with ideal values for attributes",
          fuzzyFactor: "Number between 0-1 (optional)",
          membershipType: "String (optional)",
          confidenceWeights: "Object (optional)"
        },
        shortlistCandidates: {
          threshold: "Number between 0-1 (required)",
          maxCandidates: "Number (optional)",
          criteriaThresholds: "Object (optional)",
          alphaCutThreshold: "Number between 0-1 (optional)",
          thresholdFuzzyFactor: "Number between 0-0.5 (optional)"
        },
        calculateStageScore: {
          stage: "String: phoneScreen, codingInterview, or onsiteInterview"
        },
        calculateFinalScores: {
          stageWeights: "Object with weights for each interview stage",
          aggregationMethod: "String: 'wsm' or 'owa' (optional)",
          strategyProfile: "String: 'optimistic', 'balanced', 'pessimistic', 'custom' (optional)",
          owaWeights: "Array of weight values (optional)",
          alphaCutThreshold: "Number between 0-1 (optional)"
        }
      },
      talentTalk: {
        chat: {
          user_input: "String (required) - The query or message to send to TalentTalk"
        }
      }
    },
    exampleRequests: {
      fromParsedResume: {
        jobId: "60d5ec9af682fbd8c0b4b1a3",
        resumeData: {
          "Name": "John Doe",
          "Email": "john.doe@example.com",
          "Phone": "123-456-7890",
          "Skills": [
            "JavaScript", "Python", "React", "Node.js", "AWS"
          ],
          "Education Details": [
            {
              "date completed": "May 2023",
              "education level": "Bachelor of Science",
              "field of study": "Computer Science",
              "institution": "University of Technology"
            }
          ],
          "Experience Details": [
            {
              "Industry Name": "Tech Solutions Inc",
              "Roles": "Software Engineer"
            },
            {
              "Industry Name": "DevCorp",
              "Roles": "Full-stack Developer"
            }
          ],
          "Total Estimated Years of Experience": "2.5"
        },
        fuzzyFactor: 0.2,
        membershipType: "triangular"
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