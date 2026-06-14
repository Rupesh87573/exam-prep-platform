const exam = {
  questions: [],
  currentIndex: 0,
  answers: {}, // questionId -> option ('A','B','C','D','E' or '')
  states: {},  // questionId -> 'answered' / 'not-answered' / 'marked' / 'marked-answered' / 'not-visited'
  
  testType: 'chapter', // 'chapter' or 'mock'
  testIdentifier: '',  // chapter name or mock ID
  testTitle: '',
  
  timerInterval: null,
  timeLeftSeconds: 0,
  timeTakenSeconds: 0,
  
  lang: 'bilingual', // 'bilingual', 'en', 'hi'
  
  cheatCount: 0,
  fullScreenEnforced: false,

  async startTest(type, identifier, title) {
    this.testType = type;
    this.testIdentifier = identifier;
    this.testTitle = title;
    this.currentIndex = 0;
    this.answers = {};
    this.states = {};
    this.cheatCount = 0;
    
    app.showLoading('Downloading exam contents...');
    
    try {
      let url = '';
      if (type === 'mock') {
        url = `/api/mocktests/${identifier}`;
      } else {
        url = `/api/questions/chapters/${encodeURIComponent(identifier)}`;
      }

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${auth.getToken()}` }
      });
      const data = await response.json();
      app.hideLoading();

      if (!data.success) {
        alert(data.message || 'Error starting test.');
        app.navigateTo('dashboard');
        return;
      }

      this.questions = type === 'mock' ? data.mockTest.questions : data.questions;
      
      if (this.questions.length === 0) {
        alert('This exam currently has no questions. Please add questions first!');
        app.navigateTo('dashboard');
        return;
      }

      // Initialize status states for every question
      this.questions.forEach((q, index) => {
        this.answers[q._id] = '';
        this.states[q._id] = index === 0 ? 'not-answered' : 'not-visited';
      });

      // Load timer duration
      const durationMins = type === 'mock' ? (data.mockTest.timerMinutes || 120) : 30; // 30 mins for practice chapters
      this.timeLeftSeconds = durationMins * 60;
      this.timeTakenSeconds = 0;

      // Start Exam Screen
      app.navigateTo('exam-interface');
      document.getElementById('exam-portal-title').innerText = title;
      document.getElementById('candidate-name-exam').innerText = app.user.name;

      // Trigger Full Screen mode warning
      this.enterFullScreen();
      this.initAntiCheat();
      this.renderPalette();
      this.showQuestion(0);
      this.startTimer();
    } catch (error) {
      app.hideLoading();
      console.error(error);
      alert('Error fetching exam structure.');
    }
  },

  showQuestion(index) {
    this.currentIndex = index;
    const q = this.questions[index];
    
    // Mark as visited (if not answered or marked)
    if (this.states[q._id] === 'not-visited') {
      this.states[q._id] = 'not-answered';
    }

    // Highlight active palette number
    document.querySelectorAll('.palette-item').forEach(el => el.classList.remove('active'));
    const activeBtn = document.getElementById(`palette-btn-${index}`);
    if (activeBtn) activeBtn.classList.add('active');

    // Display Index Number
    document.getElementById('display-q-index').innerText = index + 1;

    // Display Text based on language toggle
    const textContainer = document.getElementById('display-q-text');
    textContainer.innerHTML = '';

    if (this.lang === 'bilingual') {
      textContainer.innerHTML = `
        <div class="english-question" style="font-weight: 600; margin-bottom: 8px;">${q.englishVersion.question}</div>
        <div class="hindi-question" style="font-weight: 500; color: #4f46e5; border-top: 1px dashed #e2e8f0; padding-top: 8px; margin-top: 8px; font-family: 'Inter', sans-serif;">${q.hindiVersion.question}</div>
      `;
    } else {
      const version = this.lang === 'hi' ? q.hindiVersion : q.englishVersion;
      textContainer.innerText = version.question;
    }

    // Display Options
    const optionsContainer = document.getElementById('display-options-container');
    optionsContainer.innerHTML = '';

    const optionLetters = ['A', 'B', 'C', 'D', 'E'];
    for (let optIdx = 0; optIdx < 5; optIdx++) {
      const letter = optionLetters[optIdx];
      const isSelected = this.answers[q._id] === letter;
      
      const row = document.createElement('div');
      row.className = `option-row ${isSelected ? 'selected' : ''}`;
      row.onclick = () => this.selectOption(letter);

      let optionContent = '';
      if (this.lang === 'bilingual') {
        const engOpt = q.englishVersion.options[optIdx] || '';
        const hinOpt = q.hindiVersion.options[optIdx] || '';
        if (engOpt.trim() === hinOpt.trim()) {
          optionContent = `<div class="option-label" style="font-weight: 500;">${engOpt}</div>`;
        } else {
          optionContent = `
            <div class="option-label">
              <span class="eng-option-text" style="font-weight: 500; display: block;">${engOpt}</span>
              <span class="hin-option-text" style="color: #6366f1; display: block; font-size: 0.9em; margin-top: 2px;">${hinOpt}</span>
            </div>
          `;
        }
      } else {
        const version = this.lang === 'hi' ? q.hindiVersion : q.englishVersion;
        const optText = version.options[optIdx] || '';
        optionContent = `<div class="option-label">${optText}</div>`;
      }

      row.innerHTML = `
        <div class="option-circle">${letter}</div>
        ${optionContent}
      `;
      optionsContainer.appendChild(row);
    }

    this.renderPalette();
  },

  selectOption(letter) {
    const q = this.questions[this.currentIndex];
    this.answers[q._id] = letter;
    
    // Auto-update state if marked review
    if (this.states[q._id] === 'marked') {
      this.states[q._id] = 'marked-answered';
    } else {
      this.states[q._id] = 'answered';
    }

    this.showQuestion(this.currentIndex);
  },

  clearResponse() {
    const q = this.questions[this.currentIndex];
    this.answers[q._id] = '';
    
    if (this.states[q._id] === 'marked-answered') {
      this.states[q._id] = 'marked';
    } else {
      this.states[q._id] = 'not-answered';
    }
    
    this.showQuestion(this.currentIndex);
  },

  saveAndNext() {
    const q = this.questions[this.currentIndex];
    const letter = this.answers[q._id];

    if (letter) {
      this.states[q._id] = this.states[q._id] === 'marked' || this.states[q._id] === 'marked-answered' ? 'marked-answered' : 'answered';
    } else {
      this.states[q._id] = 'not-answered';
    }

    if (this.currentIndex < this.questions.length - 1) {
      this.showQuestion(this.currentIndex + 1);
    } else {
      alert('You have reached the end of the test. You can review your questions or click Submit Test.');
    }
  },

  prevQuestion() {
    if (this.currentIndex > 0) {
      this.showQuestion(this.currentIndex - 1);
    }
  },

  markForReview() {
    const q = this.questions[this.currentIndex];
    const letter = this.answers[q._id];

    if (letter) {
      this.states[q._id] = 'marked-answered';
    } else {
      this.states[q._id] = 'marked';
    }

    if (this.currentIndex < this.questions.length - 1) {
      this.showQuestion(this.currentIndex + 1);
    } else {
      this.renderPalette();
    }
  },

  setLanguage(language) {
    this.lang = language;
    document.getElementById('btn-lang-bilingual').classList.toggle('active', language === 'bilingual');
    document.getElementById('btn-lang-en').classList.toggle('active', language === 'en');
    document.getElementById('btn-lang-hi').classList.toggle('active', language === 'hi');
    this.showQuestion(this.currentIndex);
  },

  renderPalette() {
    const paletteGrid = document.getElementById('exam-palette-grid');
    paletteGrid.innerHTML = '';

    // Count states
    let answeredCount = 0;
    let notAnsweredCount = 0;
    let notVisitedCount = 0;
    let markedCount = 0;
    let markedAnsweredCount = 0;

    this.questions.forEach((q, index) => {
      const state = this.states[q._id];
      
      if (state === 'answered') answeredCount++;
      else if (state === 'not-answered') notAnsweredCount++;
      else if (state === 'not-visited') notVisitedCount++;
      else if (state === 'marked') markedCount++;
      else if (state === 'marked-answered') markedAnsweredCount++;

      const btn = document.createElement('button');
      btn.className = `palette-item ${state} ${index === this.currentIndex ? 'active' : ''}`;
      btn.innerText = index + 1;
      btn.id = `palette-btn-${index}`;
      btn.onclick = () => this.showQuestion(index);
      
      paletteGrid.appendChild(btn);
    });

    // Update legend statistics
    document.querySelector('.legend-box.answered').innerText = answeredCount;
    document.querySelector('.legend-box.not-answered').innerText = notAnsweredCount;
    document.querySelector('.legend-box.not-visited').innerText = notVisitedCount;
    document.querySelector('.legend-box.marked').innerText = markedCount;
    document.querySelector('.legend-box.marked-answered').innerText = markedAnsweredCount;
  },

  startTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);

    const timerEl = document.getElementById('exam-timer');

    this.timerInterval = setInterval(() => {
      this.timeLeftSeconds--;
      this.timeTakenSeconds++;

      // Warning when timer is under 5 minutes
      if (this.timeLeftSeconds < 300) {
        timerEl.parentElement.classList.add('timer-warning');
      }

      if (this.timeLeftSeconds <= 0) {
        clearInterval(this.timerInterval);
        alert('Time Limit Exceeded! Your answers are being submitted automatically.');
        this.submitTest();
        return;
      }

      const minutes = Math.floor(this.timeLeftSeconds / 60);
      const seconds = this.timeLeftSeconds % 60;
      timerEl.innerText = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }, 1000);
  },

  triggerSubmitConfirmation() {
    let answered = 0;
    let unanswered = 0;
    let marked = 0;

    this.questions.forEach(q => {
      const state = this.states[q._id];
      if (state === 'answered' || state === 'marked-answered') answered++;
      else if (state === 'marked') marked++;
      else unanswered++;
    });

    document.getElementById('modal-stat-answered').innerText = answered;
    document.getElementById('modal-stat-unanswered').innerText = unanswered;
    document.getElementById('modal-stat-marked').innerText = marked;

    document.getElementById('submitConfirmModal').classList.remove('hidden');
  },

  closeSubmitModal() {
    document.getElementById('submitConfirmModal').classList.add('hidden');
  },

  async submitTest() {
    this.closeSubmitModal();
    clearInterval(this.timerInterval);
    this.exitFullScreen();
    this.destroyAntiCheat();

    app.showLoading('Grading answers and generating rank metrics...');

    try {
      const response = await fetch('/api/results/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth.getToken()}`
        },
        body: JSON.stringify({
          testType: this.testType,
          testIdentifier: this.testIdentifier,
          timeTakenSeconds: this.timeTakenSeconds,
          answers: this.answers
        })
      });

      const data = await response.json();
      app.hideLoading();

      if (data.success) {
        app.showResultReport(data.result.id);
      } else {
        alert(data.message || 'Error submitting test.');
        app.navigateTo('dashboard');
      }
    } catch (error) {
      app.hideLoading();
      console.error(error);
      alert('Error submitting test.');
    }
  },

  confirmExitTest() {
    document.getElementById('exitConfirmModal').classList.remove('hidden');
  },

  closeExitModal() {
    document.getElementById('exitConfirmModal').classList.add('hidden');
  },

  executeExitTest() {
    this.closeExitModal();
    this.submitTest();
  },

  /* ==================== SECURITY & ANTI-CHEAT ==================== */
  enterFullScreen() {
    const docEl = document.documentElement;
    if (docEl.requestFullscreen) docEl.requestFullscreen();
    else if (docEl.mozRequestFullScreen) docEl.mozRequestFullScreen();
    else if (docEl.webkitRequestFullscreen) docEl.webkitRequestFullscreen();
    else if (docEl.msRequestFullscreen) docEl.msRequestFullscreen();
    this.fullScreenEnforced = true;
  },

  exitFullScreen() {
    if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
    this.fullScreenEnforced = false;
  },

  initAntiCheat() {
    // 1. Detect tab switching / window blur
    this._blurListener = () => {
      this.cheatCount++;
      alert(`⚠️ SECURITY ALERT: Window focus loss detected (${this.cheatCount}/3). Tab switches are strictly forbidden during the test!`);
      if (this.cheatCount >= 3) {
        alert('🚨 ANTI-CHEAT SHUTDOWN: Multiple security violations detected. The test will be submitted immediately.');
        this.submitTest();
      }
    };
    
    // 2. Prevent right clicks (inspection)
    this._contextMenuListener = (e) => e.preventDefault();
    
    // 3. Block copy paste
    this._copyPasteListener = (e) => e.preventDefault();

    window.addEventListener('blur', this._blurListener);
    document.addEventListener('contextmenu', this._contextMenuListener);
    document.addEventListener('copy', this._copyPasteListener);
    document.addEventListener('paste', this._copyPasteListener);
  },

  destroyAntiCheat() {
    if (this._blurListener) {
      window.removeEventListener('blur', this._blurListener);
    }
    if (this._contextMenuListener) {
      document.removeEventListener('contextmenu', this._contextMenuListener);
    }
    if (this._copyPasteListener) {
      document.removeEventListener('copy', this._copyPasteListener);
      document.removeEventListener('paste', this._copyPasteListener);
    }
  }
};
