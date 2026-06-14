const mongoose = require('mongoose');

let cachedConnection = null;

const connectDB = async () => {
  if (cachedConnection && mongoose.connection.readyState === 1) {
    return cachedConnection;
  }

  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/exam_prep_platform';
  
  try {
    cachedConnection = await mongoose.connect(uri, {
      dbName: 'exam_prep_platform',
      serverSelectionTimeoutMS: 5000 // Time out quickly (5s) to fail fast rather than hang
    });
    console.log(`MongoDB Connected: ${cachedConnection.connection.host}`);
    return cachedConnection;
  } catch (error) {
    console.error(`Database Connection Error: ${error.message}`);
    throw error;
  }
};

module.exports = connectDB;
