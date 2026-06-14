const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(
      process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/exam_prep_platform',
      {
        dbName: 'exam_prep_platform'
      }
    );
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Database Connection Error: ${error.message}`);
    // Do not crash the server in development, allow mock fallbacks or local testing if offline
    console.log('Running with MongoDB offline warning. Ensure MongoDB is running for full functionality.');
  }
};

module.exports = connectDB;
