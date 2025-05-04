/**
 * Demonstration of different fuzzy membership functions
 * This example shows how different membership functions affect candidate scoring
 */

const {
  triangularMF,
  trapezoidalMF,
  gaussianMF,
  calculateFuzzyScore
} = require('../utils/scoring');

// Test candidate attributes
const candidates = [
  { name: "Candidate A", experience: 3, skills: 0.7, communication: 0.9 },
  { name: "Candidate B", experience: 5, skills: 0.8, communication: 0.6 },
  { name: "Candidate C", experience: 8, skills: 0.9, communication: 0.7 },
  { name: "Candidate D", experience: 2, skills: 0.9, communication: 0.8 },
  { name: "Candidate E", experience: 6, skills: 0.6, communication: 0.9 }
];

// Ideal values for each attribute
const idealValues = {
  experience: 5,     // years
  skills: 0.9,       // normalized 0-1
  communication: 0.8 // normalized 0-1
};

// Fuzzy factor for membership functions
const fuzzyFactor = 0.3;

// Compare different membership functions
console.log("Comparison of Fuzzy Membership Functions");
console.log("----------------------------------------");
console.log("Ideal Values: ", idealValues);
console.log("Fuzzy Factor: ", fuzzyFactor);
console.log();

// Calculate and display scores for each membership function
console.log("Simple Membership Function (Original):");
console.log("--------------------------------------");
candidates.forEach(candidate => {
  const experienceScore = calculateFuzzyScore(candidate.experience, idealValues.experience, fuzzyFactor, 'simple');
  const skillsScore = calculateFuzzyScore(candidate.skills, idealValues.skills, fuzzyFactor, 'simple');
  const communicationScore = calculateFuzzyScore(candidate.communication, idealValues.communication, fuzzyFactor, 'simple');
  
  console.log(`${candidate.name}:`);
  console.log(`  Experience: ${candidate.experience} years -> Score: ${experienceScore.toFixed(4)}`);
  console.log(`  Skills: ${candidate.skills} -> Score: ${skillsScore.toFixed(4)}`);
  console.log(`  Communication: ${candidate.communication} -> Score: ${communicationScore.toFixed(4)}`);
  
  const avgScore = (experienceScore + skillsScore + communicationScore) / 3;
  console.log(`  Average Score: ${avgScore.toFixed(4)}`);
  console.log();
});

console.log("Triangular Membership Function:");
console.log("-------------------------------");
candidates.forEach(candidate => {
  const experienceScore = calculateFuzzyScore(candidate.experience, idealValues.experience, fuzzyFactor, 'triangular');
  const skillsScore = calculateFuzzyScore(candidate.skills, idealValues.skills, fuzzyFactor, 'triangular');
  const communicationScore = calculateFuzzyScore(candidate.communication, idealValues.communication, fuzzyFactor, 'triangular');
  
  console.log(`${candidate.name}:`);
  console.log(`  Experience: ${candidate.experience} years -> Score: ${experienceScore.toFixed(4)}`);
  console.log(`  Skills: ${candidate.skills} -> Score: ${skillsScore.toFixed(4)}`);
  console.log(`  Communication: ${candidate.communication} -> Score: ${communicationScore.toFixed(4)}`);
  
  const avgScore = (experienceScore + skillsScore + communicationScore) / 3;
  console.log(`  Average Score: ${avgScore.toFixed(4)}`);
  console.log();
});

console.log("Trapezoidal Membership Function:");
console.log("---------------------------------");
candidates.forEach(candidate => {
  const experienceScore = calculateFuzzyScore(candidate.experience, idealValues.experience, fuzzyFactor, 'trapezoidal');
  const skillsScore = calculateFuzzyScore(candidate.skills, idealValues.skills, fuzzyFactor, 'trapezoidal');
  const communicationScore = calculateFuzzyScore(candidate.communication, idealValues.communication, fuzzyFactor, 'trapezoidal');
  
  console.log(`${candidate.name}:`);
  console.log(`  Experience: ${candidate.experience} years -> Score: ${experienceScore.toFixed(4)}`);
  console.log(`  Skills: ${candidate.skills} -> Score: ${skillsScore.toFixed(4)}`);
  console.log(`  Communication: ${candidate.communication} -> Score: ${communicationScore.toFixed(4)}`);
  
  const avgScore = (experienceScore + skillsScore + communicationScore) / 3;
  console.log(`  Average Score: ${avgScore.toFixed(4)}`);
  console.log();
});

console.log("Gaussian Membership Function:");
console.log("-----------------------------");
candidates.forEach(candidate => {
  const experienceScore = calculateFuzzyScore(candidate.experience, idealValues.experience, fuzzyFactor, 'gaussian');
  const skillsScore = calculateFuzzyScore(candidate.skills, idealValues.skills, fuzzyFactor, 'gaussian');
  const communicationScore = calculateFuzzyScore(candidate.communication, idealValues.communication, fuzzyFactor, 'gaussian');
  
  console.log(`${candidate.name}:`);
  console.log(`  Experience: ${candidate.experience} years -> Score: ${experienceScore.toFixed(4)}`);
  console.log(`  Skills: ${candidate.skills} -> Score: ${skillsScore.toFixed(4)}`);
  console.log(`  Communication: ${candidate.communication} -> Score: ${communicationScore.toFixed(4)}`);
  
  const avgScore = (experienceScore + skillsScore + communicationScore) / 3;
  console.log(`  Average Score: ${avgScore.toFixed(4)}`);
  console.log();
});

// Visualization of membership functions for experience
console.log("Experience Membership Function Visualization (5 years ideal):");
console.log("-----------------------------------------------------------");

// Generate points for x-axis (0-10 years experience)
const expPoints = Array.from({ length: 21 }, (_, i) => i / 2); // 0, 0.5, 1, ... 10

console.log("Years | Simple | Triangular | Trapezoidal | Gaussian");
console.log("-----|--------|------------|-------------|--------");

expPoints.forEach(x => {
  const simple = calculateFuzzyScore(x, idealValues.experience, fuzzyFactor, 'simple');
  const triangular = calculateFuzzyScore(x, idealValues.experience, fuzzyFactor, 'triangular');
  const trapezoidal = calculateFuzzyScore(x, idealValues.experience, fuzzyFactor, 'trapezoidal');
  const gaussian = calculateFuzzyScore(x, idealValues.experience, fuzzyFactor, 'gaussian');
  
  console.log(
    `${x.toFixed(1).padStart(5)} | ${simple.toFixed(4).padStart(6)} | ${triangular.toFixed(4).padStart(10)} | ${trapezoidal.toFixed(4).padStart(11)} | ${gaussian.toFixed(4).padStart(7)}`
  );
});

// Function to help understand which membership function is suitable for which situations
console.log("\nMembership Function Selection Guide:");
console.log("----------------------------------");
console.log("Simple: Good for linear penalties, easy to understand");
console.log("Triangular: Better for crisp boundaries with linear transitions");
console.log("Trapezoidal: Good when a range of values are equally optimal");
console.log("Gaussian: Best for smooth, natural transitions, most realistic but complex"); 