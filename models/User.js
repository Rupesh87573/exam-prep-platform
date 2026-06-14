const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  mobile: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  registeredDate: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
  subscriptionStatus: {
    type: String,
    enum: ['free', 'paid'],
    default: 'free'
  },
  subscriptionExpiry: {
    type: Date,
    default: null
  }
});

module.exports = mongoose.model('User', UserSchema);
