const mongoose = require('mongoose');

/**
 * Connect to MongoDB database
 */
const connectDB = async () => {
  try {
    // Check if MongoDB URI is properly configured
    if (!process.env.MONGO_URI) {
      console.error('MongoDB connection string (MONGO_URI) is not defined in environment variables');
      process.exit(1);
    }

    // Connect to MongoDB with connection options
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
      maxPoolSize: 10 // Maintain up to 10 socket connections
    });
    
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    // If it's an authentication error, provide more helpful information
    if (error.message.includes('Authentication failed')) {
      console.error('Authentication failed. Please check your username and password in the connection string.');
      console.error('Also make sure your IP address is on the allowed list in MongoDB Atlas Network Access.');
    }
    process.exit(1);
  }
};

module.exports = connectDB; 