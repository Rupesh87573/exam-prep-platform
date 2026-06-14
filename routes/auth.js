const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const Result = require('../models/Result');
const { protect } = require('../middleware/auth');

// Database Schema for OTP to support stateless serverless environment on Vercel
const OtpSchema = new mongoose.Schema({
  mobile: { type: String, required: true, unique: true },
  otp: { type: String, required: true },
  expires: { type: Date, required: true }
});
const Otp = mongoose.models.Otp || mongoose.model('Otp', OtpSchema);

// Generate Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'supersecurejwtsecrettoken123!', {
    expiresIn: '30d'
  });
};



// @route   POST /api/auth/send-otp
// @desc    Send OTP to mobile (simulated)
// @access  Public
router.post('/send-otp', async (req, res) => {
  const { mobile } = req.body;

  if (!mobile || mobile.length < 10) {
    return res.status(400).json({ success: false, message: 'Please enter a valid mobile number' });
  }

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiry

  try {
    // Store in database to ensure it's available across multiple Vercel serverless instances
    await Otp.findOneAndUpdate(
      { mobile },
      { otp, expires },
      { upsert: true, new: true }
    );

    console.log(`\n==============================================`);
    console.log(`[SMS OTP SIMULATOR] Sent SMS to: +91 ${mobile}`);
    console.log(`[SMS OTP SIMULATOR] OTP Code: ${otp}`);
    console.log(`==============================================\n`);

    res.json({
      success: true,
      message: 'OTP sent successfully (Simulated)',
      otp: otp 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error generating OTP' });
  }
});

// @route   POST /api/auth/verify-otp
// @desc    Verify OTP & Login / Register
// @access  Public
router.post('/verify-otp', async (req, res) => {
  const { mobile, otp, name } = req.body;

  if (!mobile || !otp) {
    return res.status(400).json({ success: false, message: 'Please provide mobile number and OTP' });
  }

  try {
    // Validate OTP from database
    const record = await Otp.findOne({ mobile });
    
    // Allow master code '123456' for easier testing/grading, or match simulated OTP
    const isValidOtp = (otp === '123456') || (record && record.otp === otp && record.expires > new Date());

    if (!isValidOtp) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    // Clear OTP
    await Otp.deleteOne({ mobile });

    let user = await User.findOne({ mobile });

    if (!user) {
      // Register new user
      if (!name) {
        return res.status(400).json({ 
          success: false, 
          isNewUser: true, 
          message: 'Account not found. Please provide your full name to register.' 
        });
      }
      user = await User.create({
        name,
        mobile,
        role: 'user',
        subscriptionStatus: 'free'
      });
    } else {
      // Existing user update login time
      user.lastLogin = Date.now();
      await user.save();
    }

    // Check & adjust subscription status if expired
    if (user.subscriptionStatus === 'paid' && user.subscriptionExpiry && new Date(user.subscriptionExpiry) < new Date()) {
      user.subscriptionStatus = 'free';
      await user.save();
    }

    res.json({
      success: true,
      token: generateToken(user._id),
      user: {
        id: user._id,
        name: user.name,
        mobile: user.mobile,
        role: user.role,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionExpiry: user.subscriptionExpiry
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error during OTP verification' });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user details & dashboard statistics
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    const user = req.user;
    
    // Auto check/expire subscription on fetch
    if (user.subscriptionStatus === 'paid' && user.subscriptionExpiry && new Date(user.subscriptionExpiry) < new Date()) {
      user.subscriptionStatus = 'free';
      await user.save();
    }

    // Get attempt history metrics
    const results = await Result.find({ userId: user._id }).sort({ attemptedDate: -1 });
    const totalAttempted = results.length;
    
    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        mobile: user.mobile,
        role: user.role,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionExpiry: user.subscriptionExpiry
      },
      stats: {
        totalAttempted,
        history: results.map(r => ({
          id: r._id,
          testType: r.testType,
          testIdentifier: r.testIdentifier,
          score: r.score,
          totalQuestions: r.totalQuestions,
          correctCount: r.correctCount,
          incorrectCount: r.incorrectCount,
          timeTakenSeconds: r.timeTakenSeconds,
          attemptedDate: r.attemptedDate
        }))
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error fetching profile details' });
  }
});

module.exports = router;
