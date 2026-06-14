const mongoose = require('mongoose');

const ResultSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  testType: {
    type: String,
    enum: ['chapter', 'mock'],
    required: true
  },
  testIdentifier: {
    type: String,
    required: true // Chapter name (string) or Mock Test ID
  },
  score: {
    type: Number,
    required: true
  },
  totalQuestions: {
    type: Number,
    required: true
  },
  correctCount: {
    type: Number,
    required: true
  },
  incorrectCount: {
    type: Number,
    required: true
  },
  unattemptedCount: {
    type: Number,
    required: true
  },
  timeTakenSeconds: {
    type: Number,
    required: true
  },
  answers: {
    type: Map,
    of: String // Key: QuestionId, Value: SelectedOption ('A', 'B', 'C', 'D', 'E', or '' if skipped)
  },
  attemptedDate: {
    type: Date,
    default: Date.now
  },
  weakAreas: [{
    type: String
  }],
  strongAreas: [{
    type: String
  }]
});

module.exports = mongoose.model('Result', ResultSchema);
