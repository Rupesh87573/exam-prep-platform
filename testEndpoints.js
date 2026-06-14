const http = require('http');

const PORT = 5000;
const BASE_URL = `http://localhost:${PORT}`;

// Helper function to perform HTTP requests
const request = (method, path, body = null, headers = {}) => {
  return new Promise((resolve, reject) => {
    const url = `${BASE_URL}${path}`;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(url, options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => {
        responseBody += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseBody);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: responseBody });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
};

const runTests = async () => {
  console.log('🧪 Starting Automated API Integration Tests...\n');

  // Dynamic mobile number to guarantee clean test state
  const testMobile = '9' + Math.floor(100000000 + Math.random() * 900000000).toString();

  try {
    let testUserToken = '';
    let adminToken = '';
    let mockTestId = '';
    let chapterQuestionId = '';

    // 1. Test Send OTP
    console.log('1. Testing Send OTP...');
    const otpRes = await request('POST', '/api/auth/send-otp', { mobile: testMobile });
    if (otpRes.status === 200 && otpRes.data.success && otpRes.data.otp) {
      console.log(`✅ Send OTP Success. Simulated OTP Code: ${otpRes.data.otp}`);
    } else {
      throw new Error(`❌ Send OTP Failed: Status ${otpRes.status}, Message: ${JSON.stringify(otpRes.data)}`);
    }

    const testOtp = otpRes.data.otp;

    // 2. Test Verify OTP & Registration
    console.log('\n2. Testing Verify OTP & Registration...');
    const verifyRes = await request('POST', '/api/auth/verify-otp', {
      mobile: testMobile,
      otp: testOtp,
      name: 'John Doe'
    });
    if (verifyRes.status === 200 && verifyRes.data.success && verifyRes.data.token) {
      testUserToken = verifyRes.data.token;
      console.log(`✅ Verify OTP Success. JWT Token generated: ${testUserToken.substring(0, 15)}...`);
      console.log(`   User Status: ${verifyRes.data.user.subscriptionStatus}`);
    } else {
      throw new Error(`❌ Verify OTP Failed: Status ${verifyRes.status}, Message: ${JSON.stringify(verifyRes.data)}`);
    }

    // 3. Test GET Me Profile
    console.log('\n3. Testing GET Me Profile...');
    const meRes = await request('GET', '/api/auth/me', null, { 'Authorization': `Bearer ${testUserToken}` });
    if (meRes.status === 200 && meRes.data.success) {
      console.log(`✅ GET Me Success. User Name: ${meRes.data.user.name}, Mobile: ${meRes.data.user.mobile}`);
    } else {
      throw new Error(`❌ GET Me Failed: Status ${meRes.status}`);
    }

    // 4. Test GET Chapters (Paywall verification)
    console.log('\n4. Testing Chapter list lock status...');
    const chaptersRes = await request('GET', '/api/questions/chapters', null, { 'Authorization': `Bearer ${testUserToken}` });
    if (chaptersRes.status === 200 && chaptersRes.data.success) {
      const ch1 = chaptersRes.data.chapters[0];
      const ch2 = chaptersRes.data.chapters[1];
      console.log(`✅ Chapter List retrieved: ${chaptersRes.data.chapters.length} chapters found.`);
      console.log(`   Chapter 1 (${ch1.name}) Locked: ${ch1.isLocked}`);
      console.log(`   Chapter 2 (${ch2.name}) Locked: ${ch2.isLocked}`);
      if (ch1.isLocked === false && ch2.isLocked === true) {
        console.log(`✅ Paywall logic is correct (Chapter 1 unlocked, Chapter 2 locked).`);
      } else {
        throw new Error(`❌ Paywall check failed.`);
      }
    } else {
      throw new Error(`❌ Fetch chapters list failed: Status ${chaptersRes.status}`);
    }

    // 5. Test Access Unlocked Chapter questions
    console.log('\n5. Accessing Unlocked Chapter 1...');
    const ch1Questions = await request('GET', '/api/questions/chapters/Computer Fundamentals', null, { 'Authorization': `Bearer ${testUserToken}` });
    if (ch1Questions.status === 200 && ch1Questions.data.success) {
      console.log(`✅ Access Chapter 1 Success. Found ${ch1Questions.data.questionsCount} questions.`);
      if (ch1Questions.data.questions.length > 0) {
        chapterQuestionId = ch1Questions.data.questions[0]._id;
      }
    } else {
      throw new Error(`❌ Chapter 1 fetch failed.`);
    }

    // 6. Test Access Locked Chapter (Should return 402 Payment Required)
    console.log('\n6. Accessing Locked Chapter 2 (Aptitude/Data Processing)...');
    const ch2Questions = await request('GET', '/api/questions/chapters/Data Processing', null, { 'Authorization': `Bearer ${testUserToken}` });
    if (ch2Questions.status === 402) {
      console.log(`✅ Blocked Chapter 2 Access as expected. Status: 402 Payment Required. Message: "${ch2Questions.data.message}"`);
    } else {
      throw new Error(`❌ Blocked Chapter check failed. Got status ${ch2Questions.status}`);
    }

    // 7. Test Simulated ₹100 Checkout
    console.log('\n7. Performing Simulated Premium Checkout (₹100)...');
    const payRes = await request('POST', '/api/payments/checkout', {}, { 'Authorization': `Bearer ${testUserToken}` });
    if (payRes.status === 200 && payRes.data.success) {
      console.log(`✅ Payment checkout simulator success! Transaction: ${payRes.data.payment.transactionId}`);
      console.log(`   User subscription status updated to: ${payRes.data.user.subscriptionStatus}`);
    } else {
      throw new Error(`❌ Payment checkout failed: ${JSON.stringify(payRes.data)}`);
    }

    // 8. Re-test Access Locked Chapter 2 after upgrade (Should succeed)
    console.log('\n8. Accessing Chapter 2 after premium upgrade...');
    const ch2QuestionsUpgrade = await request('GET', '/api/questions/chapters/Data Processing', null, { 'Authorization': `Bearer ${testUserToken}` });
    if (ch2QuestionsUpgrade.status === 200 && ch2QuestionsUpgrade.data.success) {
      console.log(`✅ Access Chapter 2 Success. Found ${ch2QuestionsUpgrade.data.questionsCount} questions.`);
    } else {
      throw new Error(`❌ Upgrade access check failed. Got status ${ch2QuestionsUpgrade.status}`);
    }

    // 9. Test Mock Test list & questions
    console.log('\n9. Testing Mock Test loading...');
    const mockListRes = await request('GET', '/api/mocktests', null, { 'Authorization': `Bearer ${testUserToken}` });
    if (mockListRes.status === 200 && mockListRes.data.success) {
      const mt1 = mockListRes.data.paper1[0];
      mockTestId = mt1._id;
      console.log(`✅ Mock Tests list retrieved. Paper 1 Count: ${mockListRes.data.paper1.length}, Paper 2 Count: ${mockListRes.data.paper2.length}`);
      console.log(`   Mock Test ID to evaluate: ${mockTestId} ("${mt1.title}")`);
    } else {
      throw new Error(`❌ Fetch mock list failed.`);
    }

    // 10. Test Exam Submission & Result grading
    console.log('\n10. Submitting Exam answers and grading...');
    
    // Fetch mock test questions to get correct IDs
    const mockDetail = await request('GET', `/api/mocktests/${mockTestId}`, null, { 'Authorization': `Bearer ${testUserToken}` });
    const mockQuestions = mockDetail.data.mockTest.questions;
    
    // Create answers object: half correct, half incorrect
    const answers = {};
    mockQuestions.forEach((q, idx) => {
      if (idx % 2 === 0) {
        answers[q._id] = q.correctOption; // Correct
      } else {
        // Find an incorrect option
        const options = ['A', 'B', 'C', 'D', 'E'];
        const incorrect = options.find(o => o !== q.correctOption);
        answers[q._id] = incorrect; // Incorrect
      }
    });

    const submitRes = await request('POST', '/api/results/submit', {
      testType: 'mock',
      testIdentifier: mockTestId,
      timeTakenSeconds: 3600,
      answers
    }, { 'Authorization': `Bearer ${testUserToken}` });

    if (submitRes.status === 200 && submitRes.data.success) {
      const report = submitRes.data.result;
      console.log(`✅ Submit Success. Performance Report:`);
      console.log(`   Obtained Score: ${report.score} / ${report.totalQuestions}`);
      console.log(`   Correct: ${report.correctCount}, Incorrect: ${report.incorrectCount}, Skipped: ${report.unattemptedCount}`);
      console.log(`   Simulated Percentile Rank: ${report.rank} of ${report.totalParticipants} participants`);
      console.log(`   Strong Chapters: ${report.strongAreas.join(', ') || 'None'}`);
      console.log(`   Weak Chapters: ${report.weakAreas.join(', ') || 'None'}`);
    } else {
      throw new Error(`❌ Submit test failed: ${JSON.stringify(submitRes.data)}`);
    }

    // 11. Test Admin Login passcode protection
    console.log('\n11. Testing Admin Login passcode authentication...');
    const adminFail = await request('POST', '/api/admin/login', { passcode: 'wrongcode' });
    if (adminFail.status === 401) {
      console.log(`✅ Rejected incorrect passcode as expected.`);
    } else {
      throw new Error(`❌ Passcode vulnerability: accepted wrong code.`);
    }

    const adminPassRes = await request('POST', '/api/admin/login', { passcode: '27072003' });
    if (adminPassRes.status === 200 && adminPassRes.data.success && adminPassRes.data.token) {
      adminToken = adminPassRes.data.token;
      console.log(`✅ Admin Login Success. Token generated: ${adminToken.substring(0, 15)}...`);
    } else {
      throw new Error(`❌ Admin login passcode verification failed.`);
    }

    // 12. Test Admin Route statistics
    console.log('\n12. Testing Admin Stats retrieve...');
    const statsRes = await request('GET', '/api/admin/stats', null, { 'Authorization': `Bearer ${adminToken}` });
    if (statsRes.status === 200 && statsRes.data.success) {
      const stats = statsRes.data.stats;
      console.log(`✅ Admin Analytics retrieved:`);
      console.log(`   Total Users: ${stats.totalUsers}, Active Users: ${stats.activeUsers}`);
      console.log(`   Premium Subscriptions: ${stats.paidUsers}, Accumulated Revenue: ₹${stats.revenue}`);
    } else {
      throw new Error(`❌ Fetch admin stats failed.`);
    }

    // 13. Test Admin users dashboard list
    console.log('\n13. Testing Admin Users listing...');
    const usersRes = await request('GET', '/api/admin/users', null, { 'Authorization': `Bearer ${adminToken}` });
    if (usersRes.status === 200 && usersRes.data.success) {
      console.log(`✅ Admin Users retrieved. Found ${usersRes.data.users.length} user records.`);
      const first = usersRes.data.users[0];
      console.log(`   First Record Name: ${first.name}, Mobile: ${first.mobile}, Attempt counts: ${first.attemptsCount}`);
    } else {
      throw new Error(`❌ Fetch admin users failed.`);
    }

    console.log('\n🌟 ALL AUTOMATED API TESTS PASSED SUCCESSFULLY! 🌟');
  } catch (error) {
    console.error(`\n💥 TEST FLOW ENCOUNTERED FAILURE: ${error.message}`);
    process.exit(1);
  }
};

runTests();
