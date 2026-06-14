const express = require('express');
const router = express.Router();
const MockTest = require('../models/MockTest');
const { protect } = require('../middleware/auth');

// @route   GET /api/mocktests
// @desc    Get all Mock Tests (Paper 1 & Paper 2) with lock statuses
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const isPaid = req.user.subscriptionStatus === 'paid' || req.user.role === 'admin';
    const mockTests = await MockTest.find().select('-questions'); // Fetch details without heavy questions array

    // Separate into Paper 1 and Paper 2
    const paper1 = [];
    const paper2 = [];

    // Sort mock tests by title (Mock Test 1, Mock Test 2, etc.)
    const sortedTests = mockTests.sort((a, b) => {
      return a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' });
    });

    // We designate Mock Test 1 (of Paper 1) as free. Or the first test in each paper.
    // Let's make "Mock Test 1" in both Paper 1 & Paper 2 free, or just "Mock Test 1" of Paper 1.
    // Making the first one in each list free is excellent. Let's make "Mock Test 1" free.
    
    // Sort and mark locks
    let paper1Count = 0;
    let paper2Count = 0;

    sortedTests.forEach(test => {
      let isLocked = false;
      if (test.paperType === 'Paper 1') {
        isLocked = paper1Count > 0 && !isPaid;
        paper1Count++;
        paper1.push({ ...test._doc, isLocked });
      } else {
        isLocked = paper2Count > 0 && !isPaid;
        paper2Count++;
        paper2.push({ ...test._doc, isLocked });
      }
    });

    res.json({
      success: true,
      paper1,
      paper2
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error retrieving mock tests list' });
  }
});

// @route   GET /api/mocktests/:id
// @desc    Get detailed mock test with questions (handles free/paid lock checks)
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const test = await MockTest.findById(req.params.id).populate('questions');
    if (!test) {
      return res.status(404).json({ success: false, message: 'Mock test not found' });
    }

    const isPaid = req.user.subscriptionStatus === 'paid' || req.user.role === 'admin';

    // Verify lock status by querying alphabetical position of this test in its paper type
    const allSamePaper = await MockTest.find({ paperType: test.paperType }).sort({ title: 1 });
    const testIndex = allSamePaper.findIndex(t => t._id.toString() === test._id.toString());

    // Lock tests starting from index 1 (Mock Test 2 onwards) if user is free
    if (testIndex > 0 && !isPaid) {
      return res.status(402).json({
        success: false,
        locked: true,
        message: 'This Mock Test requires a premium subscription. Upgrade for just ₹100!'
      });
    }

    res.json({
      success: true,
      mockTest: test
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error fetching mock test details' });
  }
});

module.exports = router;
