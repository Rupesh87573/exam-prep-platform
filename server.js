const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('./utils/db');
const Question = require('./models/Question');
const seedDB = require('./utils/seedData');

// Load environment variables
dotenv.config();

// Connect to Database
connectDB();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Disable caching of static files in development to reload fresh UI components immediately
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  next();
});

// Serve static assets from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Auto-seed database if empty
const checkAndSeed = async () => {
  try {
    const count = await Question.countDocuments();
    if (count === 0) {
      console.log('Database is empty. Starting automatic data seeding...');
      // Run the seeder logic directly
      const seedFunc = require('./utils/seedData');
      // Set MongoDB connection to active and run
      await seedFunc();
    } else {
      console.log(`Database already populated with ${count} questions. Skipping auto-seeding.`);
    }
  } catch (error) {
    console.error('Error during auto-seeding check:', error.message);
  }
};
// Run checking async
setTimeout(checkAndSeed, 1000);

// Diagnostic API for connection check
app.get('/api/db-check', (req, res) => {
  const mongoose = require('mongoose');
  res.json({
    readyState: mongoose.connection.readyState,
    readyStateText: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState],
    hasMongoUri: !!process.env.MONGODB_URI,
    hasMongoUriAlt: !!process.env.MONGO_URI
  });
});

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/questions', require('./routes/questions'));
app.use('/api/mocktests', require('./routes/mocktests'));
app.use('/api/results', require('./routes/results'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/admin', require('./routes/admin'));

// Fallback for SPA Routing: serve index.html for undefined requests
app.get('*', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n=================================================`);
  console.log(`🚀 Server running in production/development mode`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`=================================================\n`);
});

module.exports = app;
