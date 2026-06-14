const express = require('express');
const router = express.Router();
const Question = require('../models/Question');
const { protect } = require('../middleware/auth');

// List of all 16 Chapters in order
const CHAPTERS_LIST = [
  "Computer Fundamentals",
  "Data Processing",
  "Programming Fundamentals",
  "Data Structure and Algorithms",
  "Computer Organization and Operating System",
  "Computer Network and Communication",
  "Network Security",
  "DBMS",
  "System Analysis",
  "Internet of Things (IoT)",
  "Mental Ability",
  "Data Interpretation and Numeracy",
  "Rajasthan GK and Current Affairs",
  "Logical Reasoning",
  "General Science",
  "History, Geography and Polity"
];

// @route   GET /api/questions/chapters
// @desc    Get all chapters list with lock status based on user role/subscription
// @access  Private (but accessible)
router.get('/chapters', protect, async (req, res) => {
  try {
    const isPaid = req.user.subscriptionStatus === 'paid' || req.user.role === 'admin';
    
    // Build list with locked indicators
    const chapters = CHAPTERS_LIST.map((name, index) => {
      // First chapter is free, others are locked for unpaid users
      const isLocked = index > 0 && !isPaid;
      return {
        id: index + 1,
        name,
        isLocked,
        freeSample: index === 0
      };
    });

    res.json({ success: true, chapters });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error fetching chapters' });
  }
});

// @route   GET /api/questions/chapters/:chapterName
// @desc    Get questions for a specific chapter (locks chapters 2-16 for free users)
// @access  Private
router.get('/chapters/:chapterName', protect, async (req, res) => {
  try {
    const { chapterName } = req.params;
    
    // Find chapter index to check locks
    const chapterIndex = CHAPTERS_LIST.findIndex(c => c.toLowerCase() === chapterName.toLowerCase());
    
    if (chapterIndex === -1) {
      return res.status(404).json({ success: false, message: 'Chapter not found' });
    }

    const matchedChapterRealName = CHAPTERS_LIST[chapterIndex];
    const isPaid = req.user.subscriptionStatus === 'paid' || req.user.role === 'admin';

    // Lockdown: chapters 2-16 require paid subscription
    if (chapterIndex > 0 && !isPaid) {
      return res.status(402).json({ 
        success: false, 
        locked: true,
        message: 'This chapter requires a premium subscription. Upgrade for just ₹100!' 
      });
    }

    // Retrieve questions matching chapter
    const questions = await Question.find({ 
      chapterName: matchedChapterRealName,
      questionType: 'chapter' 
    });

    res.json({ 
      success: true, 
      chapterName: matchedChapterRealName, 
      questionsCount: questions.length,
      questions 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error retrieving questions' });
  }
});

module.exports = router;
module.exports.CHAPTERS_LIST = CHAPTERS_LIST;
