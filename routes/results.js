const express = require('express');
const router = express.Router();
const Result = require('../models/Result');
const Question = require('../models/Question');
const MockTest = require('../models/MockTest');
const { protect } = require('../middleware/auth');

// @route   POST /api/results/submit
// @desc    Submit answers, grade test, record result, and return performance reports
// @access  Private
router.post('/submit', protect, async (req, res) => {
  try {
    const { testType, testIdentifier, timeTakenSeconds, answers } = req.body;

    if (!testType || !testIdentifier || timeTakenSeconds === undefined || !answers) {
      return res.status(400).json({ success: false, message: 'Please provide all required fields' });
    }

    let questions = [];
    let negativeMarking = false;
    let negativeMarkValue = 0;
    let testTitle = '';

    if (testType === 'mock') {
      const mockTest = await MockTest.findById(testIdentifier).populate('questions');
      if (!mockTest) {
        return res.status(404).json({ success: false, message: 'Mock test not found' });
      }
      questions = mockTest.questions;
      negativeMarking = mockTest.negativeMarking;
      negativeMarkValue = mockTest.negativeMarkValue || -0.33;
      testTitle = mockTest.title;
    } else {
      // Chapter practice
      questions = await Question.find({ chapterName: testIdentifier, questionType: 'chapter' });
      testTitle = testIdentifier;
    }

    if (questions.length === 0) {
      return res.status(400).json({ success: false, message: 'No questions found for this test' });
    }

    let correctCount = 0;
    let incorrectCount = 0;
    let unattemptedCount = 0;
    let score = 0;

    // Track chapter-wise performance for analytics
    const chapterPerformance = {};

    questions.forEach(q => {
      const selected = answers[q._id.toString()];
      const chName = q.chapterName || 'General';

      if (!chapterPerformance[chName]) {
        chapterPerformance[chName] = { correct: 0, total: 0 };
      }
      chapterPerformance[chName].total++;

      if (!selected || selected === '') {
        unattemptedCount++;
      } else if (selected === q.correctOption) {
        correctCount++;
        score += 1;
        chapterPerformance[chName].correct++;
      } else {
        incorrectCount++;
        if (negativeMarking) {
          score += negativeMarkValue; // negativeMarkValue is negative, e.g. -0.33
        }
      }
    });

    // Format score to 2 decimal places
    score = Math.round(score * 100) / 100;

    // Identify weak and strong areas
    const strongAreas = [];
    const weakAreas = [];

    Object.keys(chapterPerformance).forEach(ch => {
      const perf = chapterPerformance[ch];
      const percent = (perf.correct / perf.total) * 100;
      if (percent >= 70) {
        strongAreas.push(ch);
      } else if (percent < 50) {
        weakAreas.push(ch);
      }
    });

    // Save Result
    const newResult = await Result.create({
      userId: req.user._id,
      testType,
      testIdentifier,
      score,
      totalQuestions: questions.length,
      correctCount,
      incorrectCount,
      unattemptedCount,
      timeTakenSeconds,
      answers,
      strongAreas,
      weakAreas
    });

    // Calculate Percentile Rank
    // Find all results for this same test
    const allResults = await Result.find({ testIdentifier }).sort({ score: -1 });
    const betterScoresCount = allResults.filter(r => r.score > score).length;
    const rank = betterScoresCount + 1;
    const totalParticipants = allResults.length;

    res.json({
      success: true,
      result: {
        id: newResult._id,
        testTitle,
        testType,
        score,
        totalQuestions: questions.length,
        correctCount,
        incorrectCount,
        unattemptedCount,
        timeTakenSeconds,
        strongAreas,
        weakAreas,
        rank,
        totalParticipants,
        attemptedDate: newResult.attemptedDate
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error processing test submission' });
  }
});

// @route   GET /api/results/history
// @desc    Get current user's past attempts
// @access  Private
router.get('/history', protect, async (req, res) => {
  try {
    const results = await Result.find({ userId: req.user._id }).sort({ attemptedDate: -1 });
    res.json({ success: true, results });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error retrieving history' });
  }
});

// @route   GET /api/results/:id
// @desc    Get a single detailed result review (with full questions populated)
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const result = await Result.findById(req.params.id);
    if (!result) {
      return res.status(404).json({ success: false, message: 'Result record not found' });
    }

    // Security: Only user or admin can view result
    if (result.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized access' });
    }

    // Retrieve questions to show correct answers
    let questions = [];
    let testTitle = '';
    if (result.testType === 'mock') {
      const mockTest = await MockTest.findById(result.testIdentifier).populate('questions');
      if (mockTest) {
        questions = mockTest.questions;
        testTitle = mockTest.title;
      }
    } else {
      questions = await Question.find({ chapterName: result.testIdentifier, questionType: 'chapter' });
      testTitle = result.testIdentifier;
    }

    // Calculate Rank
    const allResults = await Result.find({ testIdentifier: result.testIdentifier }).sort({ score: -1 });
    const betterScoresCount = allResults.filter(r => r.score > result.score).length;
    const rank = betterScoresCount + 1;

    res.json({
      success: true,
      resultDetails: {
        id: result._id,
        testTitle,
        testType: result.testType,
        testIdentifier: result.testIdentifier,
        score: result.score,
        totalQuestions: result.totalQuestions,
        correctCount: result.correctCount,
        incorrectCount: result.incorrectCount,
        unattemptedCount: result.unattemptedCount,
        timeTakenSeconds: result.timeTakenSeconds,
        answers: result.answers,
        attemptedDate: result.attemptedDate,
        strongAreas: result.strongAreas,
        weakAreas: result.weakAreas,
        rank,
        totalParticipants: allResults.length
      },
      questions
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error retrieving result review' });
  }
});

module.exports = router;
