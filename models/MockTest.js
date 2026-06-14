const mongoose = require('mongoose');

const MockTestSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  paperType: {
    type: String,
    enum: ['Paper 1', 'Paper 2'],
    required: true
  },
  timerMinutes: {
    type: Number,
    default: 120
  },
  negativeMarking: {
    type: Boolean,
    default: true
  },
  negativeMarkValue: {
    type: Number,
    default: -0.33
  },
  questions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question'
  }]
});

module.exports = mongoose.model('MockTest', MockTestSchema);
