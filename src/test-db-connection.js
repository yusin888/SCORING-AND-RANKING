require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./utils/db');

// Test MongoDB connection
async function testConnection() {
  try {
    console.log('Attempting to connect to MongoDB Atlas...');
    await connectDB();
    console.log('Connection successful!');
    
    // Get database stats as a simple test
    const stats = await mongoose.connection.db.stats();
    console.log('Database stats:', JSON.stringify(stats, null, 2));
    
    console.log('Testing complete, closing connection...');
    await mongoose.connection.close();
    console.log('Connection closed successfully.');
  } catch (error) {
    console.error('Error testing MongoDB connection:', error);
  } finally {
    process.exit(0);
  }
}

testConnection(); 