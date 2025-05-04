/**
 * Example implementation of enhanced fuzzy logic for technical candidate evaluation
 */
const {
  calculateFuzzyScore,
  calculateStringSimilarity,
  applyWSM,
  aggregateStageScores,
  rankCandidates,
  triangularMF,
  trapezoidalMF,
  fuzzifyValue,
  defineTriangularMFs,
  defineTrapezoidalMFs,
  applyFuzzyRules,
  defuzzifyCOG
} = require('../utils/enhancedScoring');

/**
 * Example: Evaluating a technical candidate using the fuzzy system
 */
function evaluateTechnicalCandidate() {
  console.log('===== Technical Candidate Evaluation Example =====');
  
  // 1. Define linguistic variables for technical evaluation
  const experienceLevels = {
    novice: { type: 'triangular', a: 0, b: 0, c: 3 },
    intermediate: { type: 'triangular', a: 2, b: 4, c: 6 },
    expert: { type: 'triangular', a: 5, b: 8, c: 10 }
  };
  
  const problemSolvingLevels = {
    basic: { type: 'triangular', a: 0, b: 0, c: 4 },
    proficient: { type: 'triangular', a: 3, b: 5, c: 7 },
    advanced: { type: 'triangular', a: 6, b: 10, c: 10 }
  };
  
  const communicationLevels = {
    poor: { type: 'trapezoidal', a: 0, b: 0, c: 2, d: 3 },
    adequate: { type: 'trapezoidal', a: 2, b: 3, c: 6, d: 7 },
    excellent: { type: 'trapezoidal', a: 6, b: 7, c: 10, d: 10 }
  };
  
  // 2. Define fuzzy rules for suitability assessment
  const technicalRules = [
    {
      if: [
        { variable: 'experience', is: 'expert' },
        { variable: 'problemSolving', is: 'advanced' }
      ],
      then: { variable: 'suitability', is: 'highlyRecommended' }
    },
    {
      if: [
        { variable: 'experience', is: 'intermediate' },
        { variable: 'problemSolving', is: 'proficient' },
        { variable: 'communication', is: 'excellent' }
      ],
      then: { variable: 'suitability', is: 'recommended' }
    },
    {
      if: [
        { variable: 'experience', is: 'novice' },
        { variable: 'problemSolving', is: 'basic' }
      ],
      then: { variable: 'suitability', is: 'notRecommended' }
    },
    {
      if: [
        { variable: 'experience', is: 'intermediate' },
        { variable: 'problemSolving', is: 'basic' },
        { variable: 'communication', is: 'poor' }
      ],
      then: { variable: 'suitability', is: 'notRecommended' }
    },
    {
      if: [
        { variable: 'experience', is: 'novice' },
        { variable: 'problemSolving', is: 'proficient' },
        { variable: 'communication', is: 'excellent' }
      ],
      then: { variable: 'suitability', is: 'maybeRecommended' }
    }
  ];
  
  // Output membership functions for suitability
  const suitabilityLevels = {
    notRecommended: { type: 'triangular', a: 0, b: 0, c: 0.4 },
    maybeRecommended: { type: 'triangular', a: 0.3, b: 0.5, c: 0.7 },
    recommended: { type: 'triangular', a: 0.6, b: 0.8, c: 0.9 },
    highlyRecommended: { type: 'triangular', a: 0.8, b: 1.0, c: 1.0 }
  };
  
  // 3. Candidate data from interviews
  const candidate = {
    name: "Jane Smith",
    yearsExperience: 6,
    codingScore: 8.5,
    communicationScore: 7.2,
    technicalSkills: ["JavaScript", "React", "Node.js", "MongoDB", "AWS"],
    idealSkills: ["JavaScript", "React", "Node.js", "PostgreSQL", "Docker"],
    previousRoles: ["Frontend Developer", "Full Stack Engineer"],
    desiredRole: "Senior Full Stack Engineer"
  };
  
  // 4. Process the candidate
  console.log(`Evaluating candidate: ${candidate.name}`);
  
  // Calculate string similarity for role match
  const roleMatch = calculateStringSimilarity(
    candidate.previousRoles.join(" "),
    candidate.desiredRole
  );
  console.log(`Role match score: ${roleMatch.toFixed(2)}`);
  
  // Calculate skills match with fuzzy array comparison
  const skillsMatch = calculateArraySimilarity(
    candidate.technicalSkills,
    candidate.idealSkills,
    {
      caseSensitive: false,
      partial: true,
      threshold: 0.6
    }
  );
  console.log(`Skills match score: ${skillsMatch.toFixed(2)}`);
  
  // Fuzzify interview scores
  const fuzzyExperience = fuzzifyValue(candidate.yearsExperience, experienceLevels);
  console.log('Experience membership degrees:', JSON.stringify(fuzzyExperience));
  
  const fuzzyProblemSolving = fuzzifyValue(candidate.codingScore, problemSolvingLevels);
  console.log('Problem solving membership degrees:', JSON.stringify(fuzzyProblemSolving));
  
  const fuzzyCommunication = fuzzifyValue(candidate.communicationScore, communicationLevels);
  console.log('Communication membership degrees:', JSON.stringify(fuzzyCommunication));
  
  // Apply fuzzy rules
  const fuzzyInputs = {
    experience: fuzzyExperience,
    problemSolving: fuzzyProblemSolving,
    communication: fuzzyCommunication
  };
  
  const ruleOutputs = applyFuzzyRules(fuzzyInputs, technicalRules);
  console.log('Rule outputs:', JSON.stringify(ruleOutputs));
  
  // Defuzzify to get final recommendation score
  const suitabilityScore = defuzzifyCOG(ruleOutputs, suitabilityLevels, 0, 1, 100);
  console.log(`Final suitability score: ${suitabilityScore.toFixed(2)}`);
  
  // Determine final recommendation
  let recommendation;
  if (suitabilityScore >= 0.8) {
    recommendation = "Highly Recommended";
  } else if (suitabilityScore >= 0.6) {
    recommendation = "Recommended";
  } else if (suitabilityScore >= 0.4) {
    recommendation = "Maybe Recommended";
  } else {
    recommendation = "Not Recommended";
  }
  
  console.log(`Final recommendation: ${recommendation}`);
  
  // 5. Calculate combined stage scores with confidence levels
  // Example stage scores
  const stageScores = {
    phoneScreen: 0.75,
    technicalInterview: 0.85,
    codeChallenge: 0.80,
    finalInterview: 0.78
  };
  
  // Stage weights
  const stageWeights = {
    phoneScreen: 0.1,
    technicalInterview: 0.3,
    codeChallenge: 0.4,
    finalInterview: 0.2
  };
  
  // Confidence in each stage
  const stageConfidences = {
    phoneScreen: 0.9,
    technicalInterview: 0.95,
    codeChallenge: 1.0,
    finalInterview: 0.85
  };
  
  // Calculate aggregate score with confidence weighting
  const aggregateResult = aggregateStageScores(stageScores, stageWeights, stageConfidences);
  console.log(`Aggregate score: ${aggregateResult.score.toFixed(2)} (confidence: ${aggregateResult.confidence.toFixed(2)})`);
  
  return {
    candidate: candidate.name,
    skillsMatch,
    roleMatch,
    suitabilityScore,
    recommendation,
    aggregateScore: aggregateResult.score,
    confidence: aggregateResult.confidence
  };
}

/**
 * Example: Compare multiple candidates using the fuzzy system
 */
function compareCandidates() {
  // Simplified candidate data for comparison
  const candidates = [
    {
      id: 1,
      name: "Jane Smith",
      finalScore: 0.85,
      confidence: 0.92
    },
    {
      id: 2,
      name: "John Doe",
      finalScore: 0.83,
      confidence: 0.78
    },
    {
      id: 3,
      name: "Alice Johnson",
      finalScore: 0.84,
      confidence: 0.95
    },
    {
      id: 4,
      name: "Bob Williams",
      finalScore: 0.80,
      confidence: 0.88
    }
  ];
  
  // Rank candidates with confidence as tiebreaker
  const rankedCandidates = rankCandidates(candidates);
  
  console.log('\n===== Ranked Candidates =====');
  rankedCandidates.forEach((candidate, index) => {
    console.log(`${candidate.rank}. ${candidate.name} - Score: ${candidate.finalScore.toFixed(2)} (${candidate.percentile.toFixed(0)}th percentile)`);
  });
  
  return rankedCandidates;
}

// Run the example if this file is executed directly
if (require.main === module) {
  const result = evaluateTechnicalCandidate();
  console.log('\nEvaluation result:', result);
  
  const rankedResults = compareCandidates();
  console.log('\nRanking result:', rankedResults.map(c => c.name).join(' > '));
}

module.exports = {
  evaluateTechnicalCandidate,
  compareCandidates
}; 