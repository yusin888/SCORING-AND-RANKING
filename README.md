# Candidate Scoring and Ranking System API

A comprehensive RESTful API for scoring and ranking job candidates based on criteria weights and multi-stage interview performance.

## System Overview

This system implements a complete backend API for candidate evaluation:

1. **Job Posting Process**:
   - Post job openings with detailed criteria
   - Define criteria weights (single HR or multi-HR with Delphi technique)
   - Finalize weights for evaluation

2. **Candidate Ranking Process**:
   - Input candidate data (resumes, profiles)
   - Apply threshold filtering for hard criteria
   - Extract candidate attributes

3. **Integrated Multi-Stage Scoring**:
   - Schedule and manage interviews across three stages
   - Calculate stage-specific fuzzy scores
   - Compute final aggregate scores using weighted sum model
   - Generate ranked candidate lists

## Technology Stack

- **Backend**: Node.js, Express.js
- **Database**: MongoDB with Mongoose
- **Validation**: express-validator
- **File Uploads**: multer

## Getting Started

### Prerequisites

- Node.js (v14+)
- MongoDB (local or Atlas)

### Installation

1. Clone the repository
   ```bash
   git clone <repository-url>
   cd scoring-and-ranking
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Configure environment variables
   - Create a `.env` file in the root directory
   - Configure the variables (use the sample below)
   ```
   # Server Configuration
   PORT=3000
   NODE_ENV=development

   # MongoDB Connection
   MONGO_URI=mongodb://localhost:27017/candidate-scoring

   # JWT Secret (for future authentication)
   JWT_SECRET=your-secret-key-change-in-production

   # File Upload Limits
   MAX_FILE_SIZE=5242880
   ```

4. Start the server
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

5. Access the API
   - API documentation: `http://localhost:3000/api`

## API Documentation

### Job Endpoints

- `GET /api/jobs` - Get all jobs
- `GET /api/jobs/:id` - Get a specific job
- `POST /api/jobs` - Create a new job posting
- `PUT /api/jobs/:id/refine-weights` - Refine weights using Delphi technique
- `PUT /api/jobs/:id/finalize-weights` - Finalize criteria weights
- `DELETE /api/jobs/:id` - Delete a job

### Candidate Endpoints

- `GET /api/candidates` - Get all candidates
- `GET /api/candidates/:id` - Get a specific candidate
- `POST /api/candidates` - Add a new candidate
- `POST /api/candidates/from-parsed-resume` - Add a candidate from parsed resume data with auto-scoring
- `POST /api/candidates/upload-parse-score` - Upload, parse, score and add a candidate in one step
- `POST /api/candidates/job/:jobId/threshold-filter` - Apply threshold filtering
- `POST /api/candidates/:id/extract-attributes` - Extract candidate attributes
- `PUT /api/candidates/:id/stage/:stage` - Update candidate stage info
- `POST /api/candidates/job/:jobId/rank` - Compute and rank candidates
- `GET /api/candidates/job/:jobId/ranked` - Get ranked candidate list
- `DELETE /api/candidates/:id` - Delete a candidate

### Interview Endpoints

- `GET /api/interviews` - Get all interviews
- `GET /api/interviews/:id` - Get a specific interview
- `POST /api/interviews` - Schedule a new interview
- `PUT /api/interviews/:id/stage1` - Update phone screen results
- `PUT /api/interviews/:id/stage2` - Update coding interview results
- `PUT /api/interviews/:id/stage3` - Update onsite interview results
- `PUT /api/interviews/:id/cancel` - Cancel an interview

### Score Endpoints

- `POST /api/scores/stage/:id` - Calculate stage score
- `POST /api/scores/final/:jobId` - Calculate final scores
- `GET /api/scores/ranking/:jobId` - Get candidate ranking

## System Architecture

The API follows a RESTful architecture with three main resources:

- **Jobs**: Managing job postings and criteria weights
- **Candidates**: Handling candidate information and scoring
- **Interviews**: Managing the three interview stages and collecting scores

This backend-only implementation is designed to be consumed by any frontend or client application that needs to implement candidate scoring and ranking functionality.

## License

This project is licensed under the MIT License - see the LICENSE file for details. 