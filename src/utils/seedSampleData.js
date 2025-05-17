/**
 * Sample data seeding script for CandidAI
 * 
 * This script populates the database with sample candidate data that matches
 * what is shown in the UI screenshots.
 */

const mongoose = require('mongoose');
const connectDB = require('./db');
const Candidate = require('../models/Candidate');
const Job = require('../models/Job');
require('dotenv').config();

const sampleJob = {
  title: "Senior Software Engineer",
  description: "We are looking for an experienced software engineer to join our team.",
  department: "Engineering",
  location: "Remote",
  criteria: [
    { name: "yearsOfExperience", weight: 0.2, description: "Years of professional experience", targetValue: 5 },
    { name: "programmingSkills", weight: 0.25, description: "Programming skills", targetValue: 0.8 },
    { name: "systemDesign", weight: 0.25, description: "System design knowledge", targetValue: 0.8 },
    { name: "education", weight: 0.15, description: "Education level", targetValue: 0.8 },
    { name: "communication", weight: 0.15, description: "Communication skills", targetValue: 0.8 }
  ]
};

const sampleCandidates = [
  {
    firstName: "Alex",
    lastName: "Johnson",
    email: "alex.johnson@example.com",
    phone: "+1 (555) 123-4567",
    applied: "2023-05-15",
    attributes: new Map([
      ["yearsOfExperience", 8],
      ["education", 0.92],
      ["javascript", true],
      ["react", true],
      ["nodejs", true],
      ["typescript", true],
      ["mongodb", true]
    ]),
    stages: {
      phoneScreen: { completed: true, score: 0.85, notes: "Great communication skills" },
      codingInterview: { completed: true, score: 0.95, notes: "Excellent problem solving" },
      onsiteInterview: { completed: true, score: 0.85, notes: "Good cultural fit" }
    },
    initialScore: 0.88,
    finalScore: 0.917,
    status: "interviewing"
  },
  {
    firstName: "David",
    lastName: "Kim",
    email: "david.kim@example.com",
    phone: "+1 (555) 234-5678",
    applied: "2023-05-10",
    attributes: new Map([
      ["yearsOfExperience", 7],
      ["education", 0.85],
      ["javascript", true],
      ["react", true],
      ["docker", true],
      ["kubernetes", true],
      ["aws", true]
    ]),
    stages: {
      phoneScreen: { completed: true, score: 0.82, notes: "Good technical background" },
      codingInterview: { completed: true, score: 0.88, notes: "Strong DevOps knowledge" },
      onsiteInterview: { completed: true, score: 0.90, notes: "Excellent systems knowledge" }
    },
    initialScore: 0.86,
    finalScore: 0.907,
    status: "hired"
  },
  {
    firstName: "James",
    lastName: "Wilson",
    email: "james.wilson@example.com",
    phone: "+1 (555) 345-6789",
    applied: "2023-05-11",
    attributes: new Map([
      ["yearsOfExperience", 9],
      ["education", 0.90],
      ["javascript", true],
      ["python", true],
      ["aws", true],
      ["system design", true],
      ["architecture", true]
    ]),
    stages: {
      phoneScreen: { completed: true, score: 0.88, notes: "Extensive experience" },
      codingInterview: { completed: true, score: 0.92, notes: "Excellent architectural knowledge" },
      onsiteInterview: { completed: true, score: 0.93, notes: "Great leadership skills" }
    },
    initialScore: 0.89,
    finalScore: 0.907,
    status: "interviewing"
  },
  {
    firstName: "Emily",
    lastName: "Rodriguez",
    email: "emily.rodriguez@example.com",
    phone: "+1 (555) 456-7890",
    applied: "2023-05-18",
    attributes: new Map([
      ["yearsOfExperience", 3],
      ["education", 0.95],
      ["javascript", true],
      ["python", true],
      ["data science", true],
      ["machine learning", true]
    ]),
    stages: {
      phoneScreen: { completed: true, score: 0.78, notes: "Strong analytical skills" },
      codingInterview: { completed: false }
    },
    initialScore: 0.82,
    status: "screening"
  },
  {
    firstName: "Samantha",
    lastName: "Lee",
    email: "samantha.lee@example.com",
    phone: "+1 (555) 567-8901",
    applied: "2023-05-16",
    attributes: new Map([
      ["yearsOfExperience", 5],
      ["education", 0.88],
      ["javascript", true],
      ["react", true],
      ["ui design", true],
      ["ux design", true]
    ]),
    stages: {
      phoneScreen: { completed: true, score: 0.85, notes: "Great design background" },
      codingInterview: { completed: true, score: 0.83, notes: "Good frontend skills" }
    },
    initialScore: 0.84,
    status: "interviewing"
  },
  {
    firstName: "Olivia",
    lastName: "Garcia",
    email: "olivia.garcia@example.com",
    phone: "+1 (555) 678-9012",
    applied: "2023-05-17",
    attributes: new Map([
      ["yearsOfExperience", 2],
      ["education", 0.94],
      ["python", true],
      ["tensorflow", true],
      ["machine learning", true]
    ]),
    stages: {
      phoneScreen: { completed: true, score: 0.75, notes: "Good technical knowledge" }
    },
    initialScore: 0.78,
    status: "screening"
  },
  {
    firstName: "Lisa",
    lastName: "Wang",
    email: "lisa.wang@example.com",
    phone: "+1 (555) 789-0123",
    applied: "2023-05-16",
    attributes: new Map([
      ["yearsOfExperience", 5],
      ["education", 0.87],
      ["javascript", true],
      ["testing", true],
      ["quality assurance", true]
    ]),
    stages: {
      phoneScreen: { completed: true, score: 0.82, notes: "Strong QA background" },
      codingInterview: { completed: true, score: 0.85, notes: "Good test automation skills" }
    },
    initialScore: 0.83,
    finalScore: 0.867,
    status: "interviewing"
  },
  {
    firstName: "Robert",
    lastName: "Martinez",
    email: "robert.martinez@example.com",
    phone: "+1 (555) 890-1234",
    applied: "2023-05-14",
    attributes: new Map([
      ["yearsOfExperience", 4],
      ["education", 0.86],
      ["javascript", true],
      ["nodejs", true],
      ["database", true],
      ["backend", true]
    ]),
    stages: {
      phoneScreen: { completed: true, score: 0.80, notes: "Good backend knowledge" },
      codingInterview: { completed: true, score: 0.82, notes: "Solid database skills" }
    },
    initialScore: 0.81,
    finalScore: 0.85,
    status: "interviewing"
  },
  {
    firstName: "Michael",
    lastName: "Chen",
    email: "michael.chen@example.com",
    phone: "+1 (555) 901-2345",
    applied: "2023-05-17",
    attributes: new Map([
      ["yearsOfExperience", 6],
      ["education", 0.84],
      ["product management", true],
      ["agile", true],
      ["javascript", true]
    ]),
    stages: {
      phoneScreen: { completed: true, score: 0.75, notes: "Strong product background" },
      codingInterview: { completed: true, score: 0.77, notes: "Adequate technical skills" }
    },
    initialScore: 0.79,
    finalScore: 0.827,
    status: "interviewing"
  },
  {
    firstName: "Jessica",
    lastName: "Taylor",
    email: "jessica.taylor@example.com",
    phone: "+1 (555) 012-3456",
    applied: "2023-05-12",
    attributes: new Map([
      ["yearsOfExperience", 2],
      ["education", 0.80],
      ["javascript", true],
      ["html", true],
      ["css", true],
      ["frontend", true]
    ]),
    stages: {
      phoneScreen: { completed: true, score: 0.74, notes: "Limited experience" },
      codingInterview: { completed: true, score: 0.72, notes: "Basic frontend skills" }
    },
    initialScore: 0.76,
    finalScore: 0.783,
    status: "rejected"
  }
];

/**
 * Seed the database with sample data
 */
async function seedData() {
  try {
    // Connect to MongoDB
    await connectDB();
    
    console.log('Connected to database');
    
    // Clear existing data
    await Candidate.deleteMany({});
    await Job.deleteMany({});
    
    console.log('Cleared existing data');
    
    // Create job
    const job = await Job.create(sampleJob);
    console.log('Created sample job');
    
    // Create candidates
    const candidatesWithJobId = sampleCandidates.map(candidate => ({
      ...candidate,
      jobId: job._id
    }));
    
    await Candidate.insertMany(candidatesWithJobId);
    console.log('Created sample candidates');
    
    console.log('Sample data seeded successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
}

// Run the seed function
seedData(); 