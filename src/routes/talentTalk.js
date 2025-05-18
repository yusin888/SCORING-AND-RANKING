const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const axios = require('axios');
const mongoose = require('mongoose');

// Chat with TalentTalk chatbot using the latest FastAPI URL
router.post('/chat', [
  body('user_input').notEmpty().withMessage('User input is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { user_input } = req.body;
    console.log(user_input);
    
    // Connect to the MongoDB database directly to fetch the latest FastAPI URL
    const db = mongoose.connection.db;
    
    // Get the latest document from the fastapi_public_url collection
    const urlDoc = await db.collection('fastapi_public_url')
      .find({})
      .sort({ created_at: -1 })
      .limit(1)
      .toArray();
    
    if (!urlDoc || urlDoc.length === 0) {
      return res.status(404).json({ 
        error: 'No FastAPI URL found',
        message: 'TalentTalk is currently unavailable.' 
      });
    }
    
    const fastApiUrl = urlDoc[0].url;
    
    try {
      // Make a request to the FastAPI endpoint
      const chatResponse = await axios.post(`${fastApiUrl}/simple_chat`, {
        user_input
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000 // 10 seconds timeout
      });
      
      // Return the response from the FastAPI endpoint
      res.json(chatResponse.data);
    } catch (apiError) {
      console.error('Error connecting to FastAPI:', apiError);
      res.status(503).json({
        reply: "TalentTalk is currently unavailable. Please try again later.",
        function_call_feedback: null,
        ollama_error: "Service unavailable"
      });
    }
  } catch (error) {
    console.error('Error in TalentTalk chat endpoint:', error);
    res.status(500).json({ 
      message: 'Server error',
      error: error.message
    });
  }
});

// Add a route to get the status of TalentTalk
router.get('/status', async (req, res) => {
  try {
    // Connect to the MongoDB database directly to fetch the latest FastAPI URL
    const db = mongoose.connection.db;
    
    // Get the latest document from the fastapi_public_url collection
    const urlDoc = await db.collection('fastapi_public_url')
      .find({})
      .sort({ created_at: -1 })
      .limit(1)
      .toArray();
    
    if (!urlDoc || urlDoc.length === 0) {
      return res.status(200).json({ 
        status: 'offline',
        message: 'TalentTalk is currently unavailable.',
        lastUpdated: null
      });
    }
    
    const fastApiUrl = urlDoc[0].url;
    const lastUpdated = urlDoc[0].created_at;
    const expiresAt = urlDoc[0].expires_at;
    
    try {
      // Check if the FastAPI endpoint is responsive
      await axios.get(`${fastApiUrl}/health`, {
        timeout: 5000 // 5 seconds timeout
      });
      
      // Calculate if URL has expired
      const now = new Date();
      const isExpired = expiresAt && new Date(expiresAt) < now;
      
      res.json({
        status: isExpired ? 'expired' : 'online',
        message: isExpired ? 'TalentTalk URL has expired.' : 'TalentTalk is online.',
        url: fastApiUrl,
        lastUpdated: lastUpdated,
        expiresAt: expiresAt
      });
    } catch (apiError) {
      res.status(200).json({
        status: 'offline',
        message: 'TalentTalk is currently unreachable.',
        url: fastApiUrl,
        lastUpdated: lastUpdated,
        expiresAt: expiresAt,
        error: apiError.message
      });
    }
  } catch (error) {
    console.error('Error checking TalentTalk status:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Error checking TalentTalk status',
      error: error.message
    });
  }
});

module.exports = router; 