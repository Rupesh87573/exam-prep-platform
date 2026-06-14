const express = require('express');
const router = express.Router();
const Payment = require('../models/Payment');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

// @route   POST /api/payments/checkout
// @desc    Simulate ₹100 premium subscription payment and update user status
// @access  Private
router.post('/checkout', protect, async (req, res) => {
  try {
    const user = req.user;
    
    const { transactionId } = req.body;
    
    // Use manual transaction ID if provided, otherwise generate a mock one
    const txId = (transactionId && transactionId.trim()) 
      ? transactionId.trim() 
      : 'TXN-' + Math.floor(100000000 + Math.random() * 900000000);
      
    const amount = 100; // Flat ₹100 subscription
    
    // Log payment record
    const payment = await Payment.create({
      userId: user._id,
      amount,
      transactionId: txId,
      status: 'success'
    });

    // Update user subscription to paid for 1 year
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

    user.subscriptionStatus = 'paid';
    user.subscriptionExpiry = oneYearFromNow;
    await user.save();

    res.json({
      success: true,
      message: 'Subscription successful! Premium features are now unlocked.',
      payment: {
        transactionId: payment.transactionId,
        amount: payment.amount,
        status: payment.status,
        date: payment.date
      },
      user: {
        id: user._id,
        name: user.name,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionExpiry: user.subscriptionExpiry
      }
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'This Transaction ID / Reference Number has already been submitted.' });
    }
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error processing payment simulation' });
  }
});

module.exports = router;
