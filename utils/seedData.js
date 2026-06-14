const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Question = require('../models/Question');
const MockTest = require('../models/MockTest');
const Setting = require('../models/Setting');
const User = require('../models/User');

dotenv.config();

const SEED_QUESTIONS = [
  // 1. Computer Fundamentals
  {
    englishVersion: {
      question: "Which of the following is considered the brain of the computer system?",
      options: ["RAM", "Control Unit", "Central Processing Unit (CPU)", "Arithmetic Logic Unit", "Hard Disk Drive"]
    },
    hindiVersion: {
      question: "निम्नलिखित में से किसे कंप्यूटर सिस्टम का मस्तिष्क माना जाता है?",
      options: ["रैम (RAM)", "कंट्रोल यूनिट (CU)", "सेंट्रल प्रोसेसिंग यूनिट (CPU)", "अरिथमेटिक लॉजिक यूनिट (ALU)", "हार्ड डिस्क ड्राइव"]
    },
    correctOption: "C",
    chapterName: "Computer Fundamentals"
  },
  {
    englishVersion: {
      question: "What is the full form of RAM?",
      options: ["Random Access Memory", "Read Access Memory", "Rapid Active Memory", "Run Alternate Module", "Real Access Module"]
    },
    hindiVersion: {
      question: "RAM का पूर्ण रूप क्या है?",
      options: ["रैंडम एक्सेस मेमोरी", "रीड एक्सेस मेमोरी", "रैपिड एक्टिव मेमोरी", "रन अल्टरनेट मॉड्यूल", "रियल एक्सेस मॉड्यूल"]
    },
    correctOption: "A",
    chapterName: "Computer Fundamentals"
  },

  // 2. Data Processing
  {
    englishVersion: {
      question: "In data processing, the process of rearranging data in a logical sequence is called:",
      options: ["Summarizing", "Sorting", "Classifying", "Retrieving", "Filtering"]
    },
    hindiVersion: {
      question: "डेटा प्रोसेसिंग में, डेटा को एक तार्किक अनुक्रम में पुनर्व्यवस्थित करने की प्रक्रिया को कहा जाता है:",
      options: ["संक्षेपण (Summarizing)", "छंटनी (Sorting)", "वर्गीकरण (Classifying)", "पुनर्प्राप्ति (Retrieving)", "फ़िल्टरिंग"]
    },
    correctOption: "B",
    chapterName: "Data Processing"
  },

  // 3. Programming Fundamentals
  {
    englishVersion: {
      question: "Which programming paradigm focuses on 'objects' containing data and methods?",
      options: ["Functional Programming", "Procedural Programming", "Object-Oriented Programming (OOP)", "Logic Programming", "Imperative Programming"]
    },
    hindiVersion: {
      question: "कौन सा प्रोग्रामिंग प्रतिमान (Paradigm) डेटा और विधियों वाले 'ऑब्जेक्ट' पर केंद्रित है?",
      options: ["कार्यात्मक प्रोग्रामिंग", "प्रक्रियात्मक प्रोग्रामिंग", "ऑब्जेक्ट-ओरिएंटेड प्रोग्रामिंग (OOP)", "तर्क प्रोग्रामिंग", "अनिवार्य प्रोग्रामिंग"]
    },
    correctOption: "C",
    chapterName: "Programming Fundamentals"
  },

  // 4. Data Structure and Algorithms
  {
    englishVersion: {
      question: "Which of the following data structures operates on a Last-In-First-Out (LIFO) basis?",
      options: ["Queue", "Queue with priority", "Stack", "Binary Tree", "Linked List"]
    },
    hindiVersion: {
      question: "निम्नलिखित में से कौन सा डेटा स्ट्रक्चर लास्ट-इन-फर्स्ट-आउट (LIFO) के आधार पर कार्य करता है?",
      options: ["कतार (Queue)", "प्राथमिकता कतार (Priority Queue)", "स्टैक (Stack)", "बाइनरी ट्री (Binary Tree)", "लिंक्ड लिस्ट"]
    },
    correctOption: "C",
    chapterName: "Data Structure and Algorithms"
  },

  // 5. Computer Organization and Operating System
  {
    englishVersion: {
      question: "What is the primary role of the virtual memory in an operating system?",
      options: ["To speed up CPU processing times", "To allow executing programs larger than physical RAM", "To secure hard disk drives from malware", "To manage network connection protocols", "To optimize bios configurations"]
    },
    hindiVersion: {
      question: "ऑपरेटिंग सिस्टम में वर्चुअल मेमोरी की प्राथमिक भूमिका क्या है?",
      options: ["सीपीयू प्रोसेसिंग समय को तेज करने के लिए", "भौतिक रैम (RAM) से बड़े प्रोग्राम निष्पादित करने की अनुमति देने के लिए", "हार्ड डिस्क को मैलवेयर से बचाने के लिए", "नेटवर्क कनेक्शन प्रोटोकॉल प्रबंधित करने के लिए", "बायोस कॉन्फ़िगरेशन को अनुकूलित करने के लिए"]
    },
    correctOption: "B",
    chapterName: "Computer Organization and Operating System"
  },

  // 6. Computer Network and Communication
  {
    englishVersion: {
      question: "Which TCP/IP layer corresponds to the Physical and Data Link layers of the OSI model?",
      options: ["Internet Layer", "Transport Layer", "Network Access Layer", "Application Layer", "Session Layer"]
    },
    hindiVersion: {
      question: "कौन सी टीसीपी/आईपी (TCP/IP) परत ओएसआई (OSI) मॉडल की फिजिकल और डेटा लिंक परतों से मेल खाती है?",
      options: ["इंटरनेट परत", "ट्रांसपोर्ट परत", "नेटवर्क एक्सेस परत", "एप्लिकेशन परत", "सत्र परत"]
    },
    correctOption: "C",
    chapterName: "Computer Network and Communication"
  },

  // 7. Network Security
  {
    englishVersion: {
      question: "An asymmetric encryption scheme utilizes which of the following key combinations?",
      options: ["One private key for both encryption and decryption", "One public key for both encryption and decryption", "A public key to encrypt and a matching private key to decrypt", "Two private keys exchanged via Diffie-Hellman", "Three distinct public keys distributed globally"]
    },
    hindiVersion: {
      question: "एक असममित एन्क्रिप्शन (Asymmetric Encryption) योजना निम्नलिखित में से किस कुंजी संयोजन का उपयोग करती है?",
      options: ["एन्क्रिप्शन और डिक्रिप्शन दोनों के लिए एक निजी कुंजी", "एन्क्रिप्शन और डिक्रिप्शन दोनों के लिए एक सार्वजनिक कुंजी", "एन्क्रिप्ट करने के लिए एक सार्वजनिक कुंजी और डिक्रिप्ट करने के लिए एक निजी कुंजी", "डिफी-हेलमैन के माध्यम से आदान-प्रदान की गई दो निजी कुंजियाँ", "विश्व स्तर पर वितरित तीन अलग-अलग सार्वजनिक कुंजियाँ"]
    },
    correctOption: "C",
    chapterName: "Network Security"
  },

  // 8. DBMS
  {
    englishVersion: {
      question: "In a relational database design, which normal form eliminates transitive dependencies?",
      options: ["First Normal Form (1NF)", "Second Normal Form (2NF)", "Third Normal Form (3NF)", "Boyce-Codd Normal Form (BCNF)", "Fourth Normal Form (4NF)"]
    },
    hindiVersion: {
      question: "रिलेशनल डेटाबेस डिज़ाइन में, कौन सा सामान्य रूप (Normal Form) सकर्मक निर्भरता (Transitive Dependencies) को समाप्त करता है?",
      options: ["प्रथम सामान्य रूप (1NF)", "द्वितीय सामान्य रूप (2NF)", "तृतीय सामान्य रूप (3NF)", "बॉइस-कॉड सामान्य रूप (BCNF)", "चतुर्थ सामान्य रूप (4NF)"]
    },
    correctOption: "C",
    chapterName: "DBMS"
  },

  // 9. System Analysis
  {
    englishVersion: {
      question: "Which software development life cycle (SDLC) model is best suited for projects with volatile requirements?",
      options: ["Waterfall Model", "V-Model", "Agile / Iterative Model", "Big Bang Model", "Cleanroom Software Engineering"]
    },
    hindiVersion: {
      question: "अस्थिर (Volatile) आवश्यकताओं वाले प्रोजेक्ट्स के लिए कौन सा सॉफ्टवेयर डेवलपमेंट लाइफ साइकिल (SDLC) मॉडल सबसे उपयुक्त है?",
      options: ["वाटरफ़ॉल मॉडल (Waterfall Model)", "वी-मॉडल (V-Model)", "एजाइल / इटरेटिव मॉडल (Agile)", "बिग बैंग मॉडल", "क्लीनरूम सॉफ्टवेयर इंजीनियरिंग"]
    },
    correctOption: "C",
    chapterName: "System Analysis"
  },

  // 10. Internet of Things (IoT)
  {
    englishVersion: {
      question: "What is the primary communication protocol used in IoT devices for low-power, short-range message telemetry?",
      options: ["HTTP", "FTP", "MQTT", "SMTP", "SSH"]
    },
    hindiVersion: {
      question: "कम बिजली, कम दूरी के संदेश टेलीमेट्री के लिए IoT उपकरणों में उपयोग किया जाने वाला प्राथमिक संचार प्रोटोकॉल क्या है?",
      options: ["HTTP", "FTP", "MQTT", "SMTP", "SSH"]
    },
    correctOption: "C",
    chapterName: "Internet of Things (IoT)"
  },

  // 11. Mental Ability
  {
    englishVersion: {
      question: "Find the missing number in the sequence: 2, 6, 12, 20, 30, ?",
      options: ["36", "40", "42", "45", "48"]
    },
    hindiVersion: {
      question: "अनुक्रम में लुप्त संख्या ज्ञात कीजिए: 2, 6, 12, 20, 30, ?",
      options: ["36", "40", "42", "45", "48"]
    },
    correctOption: "C",
    chapterName: "Mental Ability"
  },

  // 12. Data Interpretation and Numeracy
  {
    englishVersion: {
      question: "If the ratio of two numbers is 3:5 and their sum is 80, find the larger number.",
      options: ["20", "30", "40", "50", "60"]
    },
    hindiVersion: {
      question: "यदि दो संख्याओं का अनुपात 3:5 है और उनका योग 80 है, तो बड़ी संख्या ज्ञात कीजिए।",
      options: ["20", "30", "40", "50", "60"]
    },
    correctOption: "D",
    chapterName: "Data Interpretation and Numeracy"
  },

  // 13. Rajasthan GK and Current Affairs
  {
    englishVersion: {
      question: "Which city in Rajasthan is known as the 'Pink City'?",
      options: ["Jodhpur", "Udaipur", "Jaipur", "Ajmer", "Bikaner"]
    },
    hindiVersion: {
      question: "राजस्थान के किस शहर को 'गुलाबी नगरी' (Pink City) के नाम से जाना जाता है?",
      options: ["जोधपुर", "उदयपुर", "जयपुर", "अजमेर", "बीकानेर"]
    },
    correctOption: "C",
    chapterName: "Rajasthan GK and Current Affairs"
  },

  // 14. Logical Reasoning
  {
    englishVersion: {
      question: "If 'BOOK' is coded as '26611' in a certain code language, how is 'PEN' coded?",
      options: ["16514", "15513", "16615", "17615", "18616"]
    },
    hindiVersion: {
      question: "यदि किसी कूट भाषा में 'BOOK' को '26611' के रूप में कोडित किया जाता है, तो 'PEN' को कैसे कोडित किया जाएगा?",
      options: ["16514", "15513", "16615", "17615", "18616"]
    },
    correctOption: "A",
    chapterName: "Logical Reasoning"
  },

  // 15. General Science
  {
    englishVersion: {
      question: "What is the chemical symbol for Gold?",
      options: ["Ag", "Au", "Fe", "Cu", "Pb"]
    },
    hindiVersion: {
      question: "सोने (Gold) का रासायनिक प्रतीक क्या है?",
      options: ["Ag", "Au", "Fe", "Cu", "Pb"]
    },
    correctOption: "B",
    chapterName: "General Science"
  },

  // 16. History, Geography and Polity
  {
    englishVersion: {
      question: "Who was the first President of Independent India?",
      options: ["Mahatma Gandhi", "Jawaharlal Nehru", "Dr. Rajendra Prasad", "Sardar Patel", "Dr. B.R. Ambedkar"]
    },
    hindiVersion: {
      question: "स्वतंत्र भारत के प्रथम राष्ट्रपति कौन थे?",
      options: ["महात्मा गांधी", "जवाहरलाल नेहरू", "डॉ. राजेंद्र प्रसाद", "सरदार पटेल", "डॉ. बी.आर. अंबेडकर"]
    },
    correctOption: "C",
    chapterName: "History, Geography and Polity"
  }
];

// Helper to generate additional dummy questions per chapter to reach at least 5 questions
const chapters = [
  "Computer Fundamentals", "Data Processing", "Programming Fundamentals", "Data Structure and Algorithms",
  "Computer Organization and Operating System", "Computer Network and Communication", "Network Security", "DBMS",
  "System Analysis", "Internet of Things (IoT)", "Mental Ability", "Data Interpretation and Numeracy",
  "Rajasthan GK and Current Affairs", "Logical Reasoning", "General Science", "History, Geography and Polity"
];

const seedDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/exam_prep_platform';
    console.log(`Connecting to database to seed at ${mongoUri}...`);
    await mongoose.connect(mongoUri);

    console.log("Clearing existing questions, mock tests, and settings...");
    await Question.deleteMany({});
    await MockTest.deleteMany({});
    await Setting.deleteMany({});

    // Seed Price setting
    await Setting.create({ key: 'subscription_price', value: 100 });
    console.log("Added Settings: subscription_price = ₹100");

    const CHAPTER_KEYWORDS = {
      "Computer Fundamentals": ["RAM", "ROM", "CPU", "ALU", "Cache Memory", "Registers", "Input Devices", "Output Devices", "Bios", "Motherboard", "Secondary Storage", "Solid State Drive"],
      "Data Processing": ["Data Mining", "Data Warehousing", "ETL", "Batch Processing", "Real-time Processing", "Data Cleaning", "Data Analytics", "Information Retrieval", "Sorting Algorithms"],
      "Programming Fundamentals": ["Variables", "Loops", "Functions", "Recursion", "Compilation", "Interpretation", "Scope", "Pointers", "Arrays", "Classes", "Inheritance", "Polymorphism"],
      "Data Structure and Algorithms": ["Stacks", "Queues", "Linked Lists", "Binary Trees", "Graphs", "Hash Tables", "Bubble Sort", "Quick Sort", "Binary Search", "Big O Notation", "Recursion"],
      "Computer Organization and Operating System": ["Paging", "Segmentation", "Deadlocks", "Process Scheduling", "Semaphores", "Kernels", "Interrupts", "Memory Management", "Pipelining"],
      "Computer Network and Communication": ["TCP/IP Protocol", "OSI Reference Model", "IP Addressing", "Routers", "Switches", "DNS Resolution", "HTTP/HTTPS", "FTP", "Subnet Masks", "Network Topologies"],
      "Network Security": ["Firewalls", "Asymmetric Cryptography", "Symmetric Encryption", "SSL/TLS Handshake", "Trojan Horses", "DDoS Attacks", "Phishing Filters", "VPN Tunneling", "Digital Signatures"],
      "DBMS": ["SQL Queries", "Primary Keys", "Foreign Keys", "Database Normalization", "ACID Properties", "Database Transactions", "Indexing Methods", "Relational Algebra", "NoSQL Databases"],
      "System Analysis": ["SDLC Models", "Waterfall Approach", "Agile Methodology", "Data Flow Diagrams", "Use Case Scenarios", "System Prototyping", "Feasibility Analyses", "System Testing"],
      "Internet of Things (IoT)": ["MQTT Protocol", "CoAP Protocol", "IoT Sensors", "IoT Actuators", "Smart Gateways", "RFID Technology", "ESP32 Controllers", "Smart Home Networks"],
      "Mental Ability": ["Number Series", "Letter Analogies", "Coding-Decoding Problems", "Blood Relation Trees", "Direction Sense Tests", "Venn Diagram Logic", "Seating Arrangements"],
      "Data Interpretation and Numeracy": ["Pie Chart Analytics", "Bar Graph Comparisons", "Line Chart Trends", "Data Tabulation", "Averages", "Percentage Calculations", "Ratio & Proportion"],
      "Rajasthan GK and Current Affairs": ["Jaipur Pink City History", "Udaipur Lakes", "Jodhpur Blue City forts", "Thar Desert ecology", "Maharana Pratap battles", "Aravali Mountain range"],
      "Logical Reasoning": ["Syllogisms", "Statement & Assumption logic", "Statement & Conclusion", "Logical Puzzles", "Premise evaluation"],
      "General Science": ["Newton's Laws of Motion", "Periodic Table classification", "Photosynthesis processes", "Gravitational force", "Acids and Bases reactions", "Ecosystem balance"],
      "History, Geography and Polity": ["Indian Constitution articles", "Parliamentary procedures", "Mughal Empire period", "Indus Valley Civilization", "Rivers of India systems", "Freedom Struggle events"]
    };

    // Expand to have 100 questions per chapter
    const finalQuestions = [];
    
    // First, push our realistic ones
    finalQuestions.push(...SEED_QUESTIONS);

    // For each chapter, ensure we have at least 100 questions by generating variations
    chapters.forEach(ch => {
      const existing = SEED_QUESTIONS.filter(q => q.chapterName === ch);
      const needed = 100 - existing.length;
      const keywords = CHAPTER_KEYWORDS[ch] || ["Core Concepts", "Syllabus Analysis", "Exam Questions"];

      for (let i = 1; i <= needed; i++) {
        const k = keywords[i % keywords.length];
        const templateIdx = i % 5;
        
        let qEng = "";
        let qHin = "";

        if (templateIdx === 0) {
          qEng = `Which of the following best explains the core purpose of "${k}" in a "${ch}" context?`;
          qHin = `निम्नलिखित में से कौन सा "${ch}" के संदर्भ में "${k}" के मुख्य उद्देश्य को सबसे अच्छी तरह समझाता है?`;
        } else if (templateIdx === 1) {
          qEng = `What is a major advantage of utilizing "${k}" during "${ch}" processes?`;
          qHin = `"${ch}" प्रक्रियाओं के दौरान "${k}" का उपयोग करने का एक प्रमुख लाभ क्या है?`;
        } else if (templateIdx === 2) {
          qEng = `In the study of "${ch}", which statement is correct regarding "${k}" implementation?`;
          qHin = `"${ch}" के अध्ययन में, "${k}" कार्यान्वयन के संबंध में कौन सा कथन सही है?`;
        } else if (templateIdx === 3) {
          qEng = `How does "${k}" interact with other system modules within "${ch}" systems?`;
          qHin = `"${ch}" प्रणालियों के भीतर "${k}" अन्य सिस्टम मॉड्यूल के साथ कैसे इंटरैक्ट करता है?`;
        } else {
          qEng = `Which of the following is a key characteristic of "${k}" in the context of "${ch}"?`;
          qHin = `"${ch}" के संदर्भ में "${k}" की मुख्य विशेषता निम्नलिखित में से कौन सी है?`;
        }

        finalQuestions.push({
          englishVersion: {
            question: qEng,
            options: [
              `It acts as the core controller and execution module for ${k}.`,
              `It optimizes processing speed and data throughput for the system.`,
              `It provides secure access controls and data integrity validations.`,
              `It standardizes system configurations and baseline setups.`,
              `None of the above options are correct.`
            ]
          },
          hindiVersion: {
            question: qHin,
            options: [
              `यह ${k} के लिए मुख्य नियंत्रक और निष्पादन मॉड्यूल के रूप में कार्य करता है।`,
              `यह सिस्टम के लिए प्रोसेसिंग गति और डेटा थ्रूपुट को अनुकूलित करता है।`,
              `यह सुरक्षित पहुंच नियंत्रण और डेटा अखंडता सत्यापन प्रदान करता है।`,
              `यह सिस्टम कॉन्फ़िगरेशन और बेसलाइन सेटअप को मानकीकृत करता है।`,
              `उपरोक्त विकल्पों में से कोई भी सही नहीं है।`
            ]
          },
          correctOption: ['A', 'B', 'C', 'D', 'E'][i % 5],
          chapterName: ch,
          questionType: 'chapter'
        });
      }
    });

    const createdQuestions = await Question.insertMany(finalQuestions);
    console.log(`Seeded ${createdQuestions.length} Chapter questions.`);

    // Now seed Mock Tests (15 for Paper 1, 15 for Paper 2) with 100 questions each
    console.log("Generating 100 questions for each of the 30 Mock Tests...");
    const allMockQuestionsData = [];
    const mockTestsToCreate = [];

    const paper1Chapters = [
      "Mental Ability", 
      "Data Interpretation and Numeracy",
      "Rajasthan GK and Current Affairs", 
      "Logical Reasoning", 
      "General Science", 
      "History, Geography and Polity"
    ];

    const paper2Chapters = [
      "Computer Fundamentals", 
      "Data Processing", 
      "Programming Fundamentals", 
      "Data Structure and Algorithms",
      "Computer Organization and Operating System", 
      "Computer Network and Communication", 
      "Network Security", 
      "DBMS",
      "System Analysis", 
      "Internet of Things (IoT)"
    ];

    for (let paper = 1; paper <= 2; paper++) {
      const paperName = `Paper ${paper}`;
      const relevantChapters = paper === 1 ? paper1Chapters : paper2Chapters;

      for (let testNum = 1; testNum <= 15; testNum++) {
        const title = `Mock Test ${testNum} (${paperName})`;
        const mockTestId = new mongoose.Types.ObjectId();

        mockTestsToCreate.push({
          _id: mockTestId,
          title,
          paperType: paperName,
          timerMinutes: 120,
          negativeMarking: true,
          negativeMarkValue: -0.33,
          questions: [] // will map ids later
        });

        // Create 100 questions
        for (let qNum = 1; qNum <= 100; qNum++) {
          const chName = relevantChapters[qNum % relevantChapters.length];
          const keywords = CHAPTER_KEYWORDS[chName] || ["Concepts"];
          const k = keywords[qNum % keywords.length];

          allMockQuestionsData.push({
            mockTestId: mockTestId,
            questionType: 'mock',
            chapterName: chName,
            correctOption: ['A', 'B', 'C', 'D', 'E'][qNum % 5],
            englishVersion: {
              question: `Mock Test ${testNum} (${paperName}) Q${qNum} on "${chName}": How does "${k}" enhance system stability?`,
              options: [
                `By isolating execution environments and threads.`,
                `By improving processing pipelines and throughput.`,
                `By verifying database transactions and indexing fields.`,
                `By enforcing standard protocols and connection handshakes.`,
                `None of the above choices are correct.`
              ]
            },
            hindiVersion: {
              question: `मॉक टेस्ट ${testNum} (${paperName}) प्र.${qNum} "${chName}" पर: "${k}" किस प्रकार सिस्टम स्थिरता में सुधार करता है?`,
              options: [
                `निष्पादन वातावरण और थ्रेड्स को अलग करके।`,
                `प्रोसेसिंग पाइपलाइन और थ्रूपुट में सुधार करके।`,
                `डेटाबेस लेनदेन को सत्यापित करके और फ़ील्ड को अनुक्रमित करके।`,
                `मानक प्रोटोकॉल और कनेक्शन हैंडशेक को लागू करके।`,
                `उपरोक्त विकल्पों में से कोई भी सही नहीं है।`
              ]
            }
          });
        }
      }
    }

    const createdMockQuestions = await Question.insertMany(allMockQuestionsData);
    console.log(`Seeded ${createdMockQuestions.length} Mock Test questions.`);

    // Map question IDs back to mock tests
    const mockTestMap = {};
    createdMockQuestions.forEach(q => {
      const mtId = q.mockTestId.toString();
      if (!mockTestMap[mtId]) mockTestMap[mtId] = [];
      mockTestMap[mtId].push(q._id);
    });

    // Save Mock Tests with references
    const mockTestDocs = mockTestsToCreate.map(testData => {
      testData.questions = mockTestMap[testData._id.toString()] || [];
      return testData;
    });

    await MockTest.insertMany(mockTestDocs);
    console.log("Seeded 30 Mock Tests (15 for Paper 1, 15 for Paper 2) with 100 questions each (3000 total).");
    
    // Seed an admin user directly
    const adminPasscode = process.env.ADMIN_PASSCODE || '27072003';
    const adminExist = await User.findOne({ mobile: 'admin' });
    if (!adminExist) {
      await User.create({
        name: 'System Admin',
        mobile: 'admin',
        role: 'admin',
        subscriptionStatus: 'paid'
      });
      console.log(`Seeded default admin user with login passcode: ${adminPasscode}`);
    }

    console.log("Database Seeding Completed Successfully.");
    if (require.main === module) {
      mongoose.connection.close();
    }
  } catch (error) {
    console.error("Seeding Error:", error);
    process.exit(1);
  }
};

// If run directly from console
if (require.main === module) {
  seedDB();
}

module.exports = seedDB;
