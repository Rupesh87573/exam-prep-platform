const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const multer = require('multer');
const csv = require('csv-parser');
const xlsx = require('xlsx');
const stream = require('stream');
const https = require('https');

const User = require('../models/User');
const Question = require('../models/Question');
const MockTest = require('../models/MockTest');
const Result = require('../models/Result');
const Payment = require('../models/Payment');
const Setting = require('../models/Setting');
const { protect, adminOnly } = require('../middleware/auth');

// Multer storage in memory
const upload = multer({ storage: multer.memoryStorage() });

// In-memory notifications store
let notifications = [
  { id: 1, message: "Welcome to RSSB / DSSSB Online Exam Preparation Portal!", date: new Date() }
];

// Helper: Translate English text to Hindi using public Google Translate API
const translateText = (text) => {
  return new Promise((resolve) => {
    if (!text || !text.trim()) return resolve('');
    
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=hi&dt=t&q=${encodeURIComponent(text)}`;
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed && parsed[0]) {
            const translated = parsed[0].map(item => item[0]).join('');
            resolve(translated);
          } else {
            resolve(text);
          }
        } catch (e) {
          resolve(text);
        }
      });
    }).on('error', () => {
      resolve(text);
    });
  });
};

// @route   POST /api/admin/login
// @desc    Admin authentication using passcode
// @access  Public
router.post('/login', async (req, res) => {
  const { passcode } = req.body;

  const validPasscode = process.env.ADMIN_PASSCODE || '27072003';
  if (passcode !== validPasscode) {
    return res.status(401).json({ success: false, message: 'Invalid Admin passcode' });
  }

  try {
    // Find or create a system admin user
    let adminUser = await User.findOne({ mobile: 'admin' });
    if (!adminUser) {
      adminUser = await User.create({
        name: 'System Admin',
        mobile: 'admin',
        role: 'admin',
        subscriptionStatus: 'paid'
      });
    }

    const token = jwt.sign(
      { id: adminUser._id, role: adminUser.role },
      process.env.JWT_SECRET || 'supersecurejwtsecrettoken123!',
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: adminUser._id,
        name: adminUser.name,
        role: adminUser.role
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error during admin login' });
  }
});

// @route   POST /api/admin/translate
// @desc    Translate text from English to Hindi
// @access  Private/Admin
router.post('/translate', protect, adminOnly, async (req, res) => {
  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ success: false, message: 'Text is required' });
  }
  try {
    const translated = await translateText(text);
    res.json({ success: true, translated });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Translation error' });
  }
});

// @route   GET /api/admin/stats
// @desc    Get dashboard summary statistics
// @access  Private/Admin
router.get('/stats', protect, adminOnly, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ role: 'user' });
    
    // Active users in last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const activeUsers = await User.countDocuments({ role: 'user', lastLogin: { $gte: sevenDaysAgo } });
    
    const paidUsers = await User.countDocuments({ subscriptionStatus: 'paid', role: 'user' });

    // Total Revenue
    const payments = await Payment.find({ status: 'success' });
    const revenue = payments.reduce((acc, curr) => acc + curr.amount, 0);

    // Daily Registrations (Last 7 Days)
    const registrations = await User.aggregate([
      {
        $match: {
          role: 'user',
          registeredDate: { $gte: sevenDaysAgo }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$registeredDate" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Popular Chapter attempts
    const chapterAttempts = await Result.aggregate([
      { $match: { testType: 'chapter' } },
      {
        $group: {
          _id: "$testIdentifier",
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    res.json({
      success: true,
      stats: {
        totalUsers,
        activeUsers,
        paidUsers,
        revenue,
        dailyRegistrations: registrations,
        popularChapters: chapterAttempts
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error fetching admin stats' });
  }
});

// @route   GET /api/admin/users
// @desc    Get user list with filters & attempt summaries
// @access  Private/Admin
router.get('/users', protect, adminOnly, async (req, res) => {
  try {
    const { search } = req.query;
    
    let query = { role: 'user' };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { mobile: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query).sort({ registeredDate: -1 });
    
    // Add stats count to each user
    const usersWithStats = await Promise.all(users.map(async (u) => {
      const attemptsCount = await Result.countDocuments({ userId: u._id });
      const payments = await Payment.find({ userId: u._id, status: 'success' });
      const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

      return {
        _id: u._id,
        name: u.name,
        mobile: u.mobile,
        registeredDate: u.registeredDate,
        lastLogin: u.lastLogin,
        subscriptionStatus: u.subscriptionStatus,
        subscriptionExpiry: u.subscriptionExpiry,
        attemptsCount,
        paymentStatus: totalPaid > 0 ? 'Paid (₹' + totalPaid + ')' : 'Unpaid'
      };
    }));

    res.json({ success: true, users: usersWithStats });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error retrieving users list' });
  }
});

// @route   GET /api/admin/users/export
// @desc    Export user list to JSON format
// @access  Private/Admin
router.get('/users/export', protect, adminOnly, async (req, res) => {
  try {
    const users = await User.find({ role: 'user' }).sort({ registeredDate: -1 });
    const exportData = await Promise.all(users.map(async (u) => {
      const attempts = await Result.countDocuments({ userId: u._id });
      return {
        Name: u.name,
        Mobile: u.mobile,
        RegisteredDate: u.registeredDate.toISOString(),
        LastLogin: u.lastLogin ? u.lastLogin.toISOString() : 'N/A',
        Subscription: u.subscriptionStatus,
        ExpiryDate: u.subscriptionExpiry ? u.subscriptionExpiry.toISOString() : 'N/A',
        TestAttempts: attempts
      };
    }));
    res.json({ success: true, data: exportData });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error exporting user list' });
  }
});

// @route   DELETE /api/admin/users/:id
// @desc    Delete a user profile and their associated history (results, payments)
// @access  Private/Admin
router.delete('/users/:id', protect, adminOnly, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User profile not found' });
    }
    
    if (user.role === 'admin') {
      return res.status(400).json({ success: false, message: 'Cannot delete admin profiles' });
    }

    // Delete associated documents
    await Result.deleteMany({ userId: user._id });
    await Payment.deleteMany({ userId: user._id });
    
    // Delete the user
    await user.deleteOne();
    
    res.json({ success: true, message: 'User profile and all attempt history deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error deleting user profile' });
  }
});

// @route   PUT /api/admin/users/:id/subscription
// @desc    Manually grant/revoke premium subscription status
// @access  Private/Admin
router.put('/users/:id/subscription', protect, adminOnly, async (req, res) => {
  try {
    const { subscriptionStatus } = req.body;
    if (!['free', 'paid'].includes(subscriptionStatus)) {
      return res.status(400).json({ success: false, message: 'Invalid subscription status value' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User profile not found' });
    }

    user.subscriptionStatus = subscriptionStatus;
    if (subscriptionStatus === 'paid') {
      const oneYear = new Date();
      oneYear.setFullYear(oneYear.getFullYear() + 1);
      user.subscriptionExpiry = oneYear;

      // Simulate a payment log for reference/revenue count
      await Payment.create({
        userId: user._id,
        amount: 100,
        transactionId: `ADMIN-GRANT-${Date.now()}`,
        status: 'success'
      });
    } else {
      user.subscriptionExpiry = null;
      // Mark admin-granted success payments as refunded/canceled if toggled off
      await Payment.updateMany(
        { userId: user._id, transactionId: { $regex: /^ADMIN-GRANT-/ } },
        { status: 'revoked' }
      );
    }

    await user.save();
    res.json({ success: true, message: `User status updated to ${subscriptionStatus} successfully`, user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error modifying user subscription' });
  }
});

// Helper: normalize cell content
const cleanString = (val) => {
  if (val === undefined || val === null) return '';
  return val.toString().trim();
};

// @route   POST /api/admin/questions/upload
// @desc    Upload bulk questions using CSV, Excel, or JSON files
// @access  Private/Admin
router.post('/questions/upload', protect, adminOnly, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }

  const filename = req.file.originalname;
  const extension = filename.split('.').pop().toLowerCase();
  
  let rows = [];

  try {
    if (extension === 'json') {
      rows = JSON.parse(req.file.buffer.toString('utf-8'));
    } else if (extension === 'xlsx' || extension === 'xls') {
      const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      rows = xlsx.utils.sheet_to_json(worksheet);
    } else if (extension === 'csv') {
      // Parse CSV asynchronously using csv-parser
      const parseCSV = () => {
        return new Promise((resolve, reject) => {
          const results = [];
          const bufferStream = new stream.PassThrough();
          bufferStream.end(req.file.buffer);
          bufferStream
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', (err) => reject(err));
        });
      };
      rows = await parseCSV();
    } else {
      return res.status(400).json({ success: false, message: 'Unsupported file format. Please upload CSV, JSON, or Excel.' });
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, message: 'File is empty or formatted incorrectly' });
    }

    let importedCount = 0;
    let mockTestsCreated = {};

    for (const row of rows) {
      // Extract columns with case-insensitive and alternative name variations
      const questionEng = cleanString(row['Question'] || row['Question English'] || row['English Version'] || row['question'] || row['english_question']);
      
      let questionHin = cleanString(row['Hindi Version'] || row['Question Hindi'] || row['Question (Hindi)'] || row['hindi_question']);
      if (questionEng && !questionHin) {
        questionHin = await translateText(questionEng);
      } else if (!questionHin) {
        questionHin = questionEng;
      }
      
      const optAE = cleanString(row['Option A'] || row['OptionA'] || row['optA'] || row['option_a']);
      let optAH = cleanString(row['Option A Hindi'] || row['Option A (Hindi)'] || row['OptionAHindi']);
      if (optAE && !optAH) {
        optAH = await translateText(optAE);
      } else if (!optAH) {
        optAH = optAE;
      }
      
      const optBE = cleanString(row['Option B'] || row['OptionB'] || row['optB'] || row['option_b']);
      let optBH = cleanString(row['Option B Hindi'] || row['Option B (Hindi)'] || row['OptionBHindi']);
      if (optBE && !optBH) {
        optBH = await translateText(optBE);
      } else if (!optBH) {
        optBH = optBE;
      }

      const optCE = cleanString(row['Option C'] || row['OptionC'] || row['optC'] || row['option_c']);
      let optCH = cleanString(row['Option C Hindi'] || row['Option C (Hindi)'] || row['OptionCHindi']);
      if (optCE && !optCH) {
        optCH = await translateText(optCE);
      } else if (!optCH) {
        optCH = optCE;
      }

      const optDE = cleanString(row['Option D'] || row['OptionD'] || row['optD'] || row['option_d']);
      let optDH = cleanString(row['Option D Hindi'] || row['Option D (Hindi)'] || row['OptionDHindi']);
      if (optDE && !optDH) {
        optDH = await translateText(optDE);
      } else if (!optDH) {
        optDH = optDE;
      }

      const optEE = cleanString(row['Option E'] || row['OptionE'] || row['optE'] || row['option_e'] || 'None of the above');
      let optEH = cleanString(row['Option E Hindi'] || row['Option E (Hindi)'] || row['OptionEHindi']);
      if (optEE && !optEH) {
        if (optEE === 'None of the above') {
          optEH = 'उपरोक्त में से कोई नहीं';
        } else {
          optEH = await translateText(optEE);
        }
      } else if (!optEH) {
        optEH = optEE;
      }

      const correctAns = cleanString(row['Correct Answer'] || row['correct_answer'] || row['CorrectOption'] || row['correctOption']).toUpperCase();
      const chapter = cleanString(row['Chapter Name'] || row['chapter_name'] || row['ChapterName'] || row['chapter'] || 'Computer Fundamentals');
      const type = cleanString(row['Question Type'] || row['question_type'] || 'chapter').toLowerCase();
      const mockTestTitle = cleanString(row['Mock Test Title'] || row['mock_test_title'] || row['Mock Test'] || '');

      // Verify necessary parameters exist
      if (!questionEng || !optAE || !optBE || !optCE || !optDE || !correctAns) {
        continue; // Skip invalid records
      }

      // Format correct option
      const cleanCorrect = ['A', 'B', 'C', 'D', 'E'].includes(correctAns) ? correctAns : 'A';

      let mockTestId = null;
      
      // If it's a mock question, map it to a Mock Test
      if (type === 'mock' && mockTestTitle) {
        if (!mockTestsCreated[mockTestTitle]) {
          // Find or create the Mock Test
          let mock = await MockTest.findOne({ title: mockTestTitle });
          if (!mock) {
            // Default: Paper 1, timer 120 mins, negative marking true
            mock = await MockTest.create({
              title: mockTestTitle,
              paperType: mockTestTitle.toLowerCase().includes('paper 2') ? 'Paper 2' : 'Paper 1',
              timerMinutes: 120,
              negativeMarking: true,
              negativeMarkValue: -0.33
            });
          }
          mockTestsCreated[mockTestTitle] = mock._id;
        }
        mockTestId = mockTestsCreated[mockTestTitle];
      }

      // Create Question
      const newQuestion = await Question.create({
        englishVersion: {
          question: questionEng,
          options: [optAE, optBE, optCE, optDE, optEE]
        },
        hindiVersion: {
          question: questionHin,
          options: [optAH, optBH, optCH, optDH, optEH]
        },
        correctOption: cleanCorrect,
        chapterName: chapter,
        questionType: type === 'mock' ? 'mock' : 'chapter',
        mockTestId
      });

      // If mock test, push this question to mock test question array
      if (mockTestId) {
        await MockTest.findByIdAndUpdate(mockTestId, { $push: { questions: newQuestion._id } });
      }

      importedCount++;
    }

    res.json({
      success: true,
      message: `Successfully processed file. Imported ${importedCount} questions.`,
      importedCount
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error parsing bulk question file' });
  }
});

// @route   POST /api/admin/questions/add
// @desc    Add single question manually
// @access  Private/Admin
router.post('/questions/add', protect, adminOnly, async (req, res) => {
  try {
    const { englishVersion, hindiVersion, correctOption, chapterName, questionType, mockTestTitle } = req.body;

    if (!englishVersion || !correctOption || !chapterName) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Prepare hindiVersion with automatic translation fallback if empty
    let finalHindi = { question: '', options: ['', '', '', '', ''] };
    
    if (hindiVersion && hindiVersion.question && hindiVersion.question.trim()) {
      finalHindi.question = hindiVersion.question;
      for (let i = 0; i < 5; i++) {
        finalHindi.options[i] = (hindiVersion.options && hindiVersion.options[i] && hindiVersion.options[i].trim()) ? hindiVersion.options[i] : '';
      }
    }

    if (!finalHindi.question && englishVersion.question) {
      finalHindi.question = await translateText(englishVersion.question);
    }

    for (let i = 0; i < 5; i++) {
      if (!finalHindi.options[i] && englishVersion.options && englishVersion.options[i]) {
        if (englishVersion.options[i] === 'None of the above') {
          finalHindi.options[i] = 'उपरोक्त में से कोई नहीं';
        } else {
          finalHindi.options[i] = await translateText(englishVersion.options[i]);
        }
      }
    }

    let mockTestId = null;
    if (questionType === 'mock' && mockTestTitle) {
      let mock = await MockTest.findOne({ title: mockTestTitle });
      if (!mock) {
        mock = await MockTest.create({
          title: mockTestTitle,
          paperType: mockTestTitle.toLowerCase().includes('paper 2') ? 'Paper 2' : 'Paper 1',
          timerMinutes: 120,
          negativeMarking: true
        });
      }
      mockTestId = mock._id;
    }

    const question = await Question.create({
      englishVersion,
      hindiVersion: finalHindi,
      correctOption,
      chapterName,
      questionType: questionType || 'chapter',
      mockTestId
    });

    if (mockTestId) {
      await MockTest.findByIdAndUpdate(mockTestId, { $push: { questions: question._id } });
    }

    res.status(201).json({ success: true, message: 'Question added successfully', question });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error creating question' });
  }
});

// @route   PUT /api/admin/questions/:id
// @desc    Update an existing question
// @access  Private/Admin
router.put('/questions/:id', protect, adminOnly, async (req, res) => {
  try {
    const { englishVersion, hindiVersion, correctOption, chapterName, questionType } = req.body;
    
    const question = await Question.findById(req.params.id);
    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found' });
    }

    // Process translations if hindiVersion has empty fields
    let finalHindi = { question: '', options: ['', '', '', '', ''] };
    
    if (hindiVersion && hindiVersion.question && hindiVersion.question.trim()) {
      finalHindi.question = hindiVersion.question;
      for (let i = 0; i < 5; i++) {
        finalHindi.options[i] = (hindiVersion.options && hindiVersion.options[i] && hindiVersion.options[i].trim()) ? hindiVersion.options[i] : '';
      }
    }

    const sourceEng = englishVersion || question.englishVersion;

    if (!finalHindi.question && sourceEng && sourceEng.question) {
      finalHindi.question = await translateText(sourceEng.question);
    }

    for (let i = 0; i < 5; i++) {
      if (!finalHindi.options[i] && sourceEng && sourceEng.options && sourceEng.options[i]) {
        if (sourceEng.options[i] === 'None of the above') {
          finalHindi.options[i] = 'उपरोक्त में से कोई नहीं';
        } else {
          finalHindi.options[i] = await translateText(sourceEng.options[i]);
        }
      }
    }

    question.englishVersion = englishVersion || question.englishVersion;
    question.hindiVersion = finalHindi;
    question.correctOption = correctOption || question.correctOption;
    question.chapterName = chapterName || question.chapterName;
    question.questionType = questionType || question.questionType;

    await question.save();
    res.json({ success: true, message: 'Question updated successfully', question });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error updating question' });
  }
});

// @route   DELETE /api/admin/questions/:id
// @desc    Delete a question
// @access  Private/Admin
router.delete('/questions/:id', protect, adminOnly, async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);
    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found' });
    }

    // Remove from mock test list if applicable
    if (question.mockTestId) {
      await MockTest.findByIdAndUpdate(question.mockTestId, { $pull: { questions: question._id } });
    }

    await question.deleteOne();
    res.json({ success: true, message: 'Question deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error deleting question' });
  }
});

// @route   POST /api/admin/notifications
// @desc    Send system notification to users
// @access  Private/Admin
router.post('/notifications', protect, adminOnly, (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ success: false, message: 'Notification message cannot be empty' });
  }

  const notification = {
    id: Date.now(),
    message,
    date: new Date()
  };

  notifications.unshift(notification);
  res.json({ success: true, message: 'Notification broadcasted successfully', notification });
});

// @route   GET /api/notifications
// @desc    Get current system notifications (accessible to users)
// @access  Public
router.get('/notifications/list', async (req, res) => {
  res.json({ success: true, notifications });
});

module.exports = router;
