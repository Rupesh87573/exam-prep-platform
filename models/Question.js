const mongoose = require('mongoose');

const QuestionSchema = new mongoose.Schema({
  englishVersion: {
    question: { type: String, required: true },
    options: [{ type: String, required: true }] // Array of 5 options [A, B, C, D, E]
  },
  hindiVersion: {
    question: { type: String, required: true },
    options: [{ type: String, required: true }] // Array of 5 options [A, B, C, D, E]
  },
  correctOption: {
    type: String,
    enum: ['A', 'B', 'C', 'D', 'E'],
    required: true
  },
  chapterName: {
    type: String,
    required: true,
    index: true
  },
  questionType: {
    type: String,
    enum: ['chapter', 'mock'],
    default: 'chapter',
    index: true
  },
  mockTestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MockTest',
    default: null,
    index: true
  }
});

module.exports = mongoose.model('Question', QuestionSchema);
