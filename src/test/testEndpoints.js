/**
 * Simple test script for candidate endpoints
 */
const axios = require('axios');
require('dotenv').config();

const API_URL = process.env.API_URL || 'http://localhost:3000';

async function testEndpoints() {
  try {
    console.log('Testing candidate endpoints...');
    
    // Test get all candidates endpoint
    console.log('\n1. Testing GET /api/candidates');
    const allCandidates = await axios.get(`${API_URL}/api/candidates`);
    console.log(`Retrieved ${allCandidates.data.length} candidates`);
    
    if (allCandidates.data.length > 0) {
      // Display candidate names and scores
      console.log('\nCandidate list:');
      allCandidates.data.forEach((candidate, index) => {
        console.log(`${index + 1}. ${candidate.name} - Score: ${candidate.score.toFixed(2)} - Status: ${candidate.displayStatus}`);
      });
      
      // Test get single candidate endpoint with the first candidate
      const candidateId = allCandidates.data[0].id;
      console.log(`\n2. Testing GET /api/candidates/${candidateId}`);
      
      const singleCandidate = await axios.get(`${API_URL}/api/candidates/${candidateId}`);
      console.log('Retrieved candidate details:');
      console.log(`Name: ${singleCandidate.data.name}`);
      console.log(`Email: ${singleCandidate.data.email}`);
      console.log(`Role: ${singleCandidate.data.role}`);
      console.log(`Experience: ${singleCandidate.data.experience} years`);
      
      if (singleCandidate.data.scores) {
        console.log('\nScores:');
        Object.entries(singleCandidate.data.scores).forEach(([key, value]) => {
          console.log(`- ${key}: ${value.toFixed(2)}`);
        });
      }
      
      if (singleCandidate.data.keySkills && singleCandidate.data.keySkills.length > 0) {
        console.log('\nKey Skills:');
        singleCandidate.data.keySkills.forEach(skill => {
          console.log(`- ${skill}`);
        });
      }
    } else {
      console.log('No candidates found. Make sure you have run the seed script.');
    }
    
    console.log('\nEndpoint tests completed successfully!');
  } catch (error) {
    console.error('Error testing endpoints:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
  }
}

testEndpoints(); 