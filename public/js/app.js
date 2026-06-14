const app = {
  currentView: 'landing',
  user: null,
  userStats: null,
  activeMockTab: 'paper1',

  init() {
    // Check local session
    auth.init();

    // Initialize Theme
    this.initTheme();

    // Set initial view
    const hash = window.location.hash.substring(1);
    if (hash && ['landing', 'login', 'dashboard', 'practice-lobby', 'mock-lobby'].includes(hash)) {
      this.navigateTo(hash);
    } else {
      this.navigateTo('landing');
    }

    // Window navigation hash listener
    window.addEventListener('hashchange', () => {
      const targetHash = window.location.hash.substring(1);
      if (targetHash && targetHash !== this.currentView) {
        this.navigateTo(targetHash);
      }
    });

    // Populate dynamic announcements list
    this.loadSystemNotifications();
  },

  navigateTo(viewName) {
    // Enforce login for private paths
    const privateViews = ['dashboard', 'practice-lobby', 'mock-lobby', 'admin-dashboard'];
    if (privateViews.includes(viewName) && !auth.getToken()) {
      alert('Authentication required. Please login first!');
      this.navigateTo('login');
      return;
    }

    this.currentView = viewName;
    window.location.hash = viewName;

    // Toggle active classes on SPA views
    document.querySelectorAll('.spa-view').forEach(view => {
      view.classList.toggle('active', view.id === `view-${viewName}`);
    });

    // Handle Navbar items highlights
    document.querySelectorAll('.nav-item').forEach(item => {
      const match = item.getAttribute('onclick') && item.getAttribute('onclick').includes(viewName);
      item.classList.toggle('active', !!match);
    });

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Custom view hooks
    if (viewName === 'dashboard') this.loadUserDashboard();
    else if (viewName === 'practice-lobby') this.loadPracticeLobby();
    else if (viewName === 'mock-lobby') this.loadMockLobby();
    else if (viewName === 'admin-dashboard') admin.initAdminDashboard();
  },

  updateUIForUser() {
    const isPaid = this.user.subscriptionStatus === 'paid' || this.user.role === 'admin';
    const subBadge = document.getElementById('headerSubBadge');
    
    subBadge.innerText = isPaid ? 'Premium Member' : 'Free User';
    subBadge.className = `sub-badge ${isPaid ? 'paid-badge' : 'free-badge'}`;
    
    // Toggle navigation visibilities
    document.querySelectorAll('.hidden-guest').forEach(el => el.classList.remove('hidden'));
    
    // Header Auth
    const authArea = document.getElementById('headerAuthArea');
    authArea.innerHTML = `
      <span class="mr-2 text-muted">Hi, <strong>${this.user.name}</strong></span>
      ${this.user.role === 'admin' ? '<button class="btn btn-accent btn-sm mr-2" onclick="app.navigateTo(\'admin-dashboard\')"><i class="fa-solid fa-gears"></i> Admin</button>' : ''}
      <button class="btn btn-outline btn-sm" onclick="auth.logout()"><i class="fa-solid fa-power-off"></i> Logout</button>
    `;
  },

  updateUIForGuest() {
    const subBadge = document.getElementById('headerSubBadge');
    subBadge.innerText = 'Free User';
    subBadge.className = 'sub-badge free-badge';

    document.querySelectorAll('.hidden-guest').forEach(el => el.classList.add('hidden'));

    const authArea = document.getElementById('headerAuthArea');
    authArea.innerHTML = `<button class="btn btn-outline" onclick="app.navigateTo('login')"><i class="fa-solid fa-right-to-bracket"></i> Login / Register</button>`;
  },

  async loadUserDashboard() {
    await auth.checkSession(); // refresh session data
    
    if (!this.user) return;

    document.getElementById('dash-user-name').innerText = this.user.name;
    document.getElementById('welcome-user-name').innerText = this.user.name;
    document.getElementById('dash-user-mobile').innerText = `+91 ${this.user.mobile}`;

    // Render Subscription box
    const subBox = document.getElementById('dash-sub-box');
    const isPaid = this.user.subscriptionStatus === 'paid' || this.user.role === 'admin';
    
    if (isPaid) {
      const expiryText = this.user.subscriptionExpiry ? new Date(this.user.subscriptionExpiry).toLocaleDateString() : 'Lifetime';
      subBox.innerHTML = `
        <span class="sub-pill paid">Premium Account</span>
        <p>Your access is active! Expiry Date: <strong>${expiryText}</strong></p>
      `;
    } else {
      subBox.innerHTML = `
        <span class="sub-pill free">Free Account</span>
        <p>Unlock all 16 chapters and 30 Mock Tests immediately.</p>
        <button class="btn btn-primary btn-sm btn-block" onclick="app.purchasePremium()">Upgrade Premium (₹100)</button>
      `;
    }

    // Populate Metrics
    const history = this.userStats ? this.userStats.history : [];
    document.getElementById('stat-tests-attempted').innerText = history.length;

    let scoreSum = 0;
    let maxScore = 0;

    history.forEach(h => {
      const accuracy = (h.correctCount / h.totalQuestions) * 100;
      scoreSum += accuracy;
      if (h.score > maxScore) maxScore = h.score;
    });

    const avgAccuracy = history.length ? (scoreSum / history.length).toFixed(1) : '0.0';
    document.getElementById('stat-avg-score').innerText = `${avgAccuracy}%`;
    document.getElementById('stat-highest-score').innerText = maxScore.toFixed(2);

    // Populate History Table
    const tbody = document.getElementById('dash-attempts-tbody');
    tbody.innerHTML = '';

    if (history.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center">No test attempts recorded. Select Practice or Mock Tests to start!</td></tr>`;
      return;
    }

    history.forEach(h => {
      const tr = document.createElement('tr');
      const accuracy = ((h.correctCount / h.totalQuestions) * 100).toFixed(1);
      
      tr.innerHTML = `
        <td><strong>${h.testIdentifier}</strong></td>
        <td><span class="q-type-badge">${h.testType === 'mock' ? 'Mock Test' : 'Chapter Practice'}</span></td>
        <td>${h.score} / ${h.totalQuestions}</td>
        <td>${accuracy}%</td>
        <td>${new Date(h.attemptedDate).toLocaleDateString()}</td>
        <td><button class="btn btn-outline btn-sm" onclick="app.showResultReport('${h.id}')"><i class="fa-solid fa-eye"></i> Review</button></td>
      `;
      tbody.appendChild(tr);
    });
  },

  async loadPracticeLobby() {
    app.showLoading('Loading chapter configurations...');
    try {
      const response = await fetch('/api/questions/chapters', {
        headers: { 'Authorization': `Bearer ${auth.getToken()}` }
      });
      const data = await response.json();
      app.hideLoading();

      if (!data.success) return;

      const container = document.getElementById('chapters-list-container');
      container.innerHTML = '';

      data.chapters.forEach(ch => {
        const card = document.createElement('div');
        card.className = `chapter-card ${ch.isLocked ? 'locked' : ''}`;
        
        card.innerHTML = `
          ${ch.isLocked ? '<div class="lock-overlay-badge"><i class="fa-solid fa-lock"></i></div>' : '<div class="lock-overlay-badge unlocked-icon"><i class="fa-solid fa-lock-open"></i></div>'}
          <div>
            <div class="chapter-num">Chapter ${ch.id}</div>
            <h3>${ch.name}</h3>
          </div>
          <div class="footer-info">
            <span class="q-count"><i class="fa-solid fa-circle-question"></i> 100 MCQs</span>
            ${ch.isLocked ? 
              `<button class="btn btn-outline btn-sm" onclick="app.purchasePremium()"><i class="fa-solid fa-bolt text-warning"></i> Unlock</button>` : 
              `<button class="btn btn-accent btn-sm" onclick="exam.startTest('chapter', '${ch.name}', '${ch.name}')">Start Practice</button>`
            }
          </div>
        `;
        container.appendChild(card);
      });
    } catch (error) {
      app.hideLoading();
      console.error(error);
    }
  },

  async loadMockLobby() {
    app.showLoading('Loading mock examinations...');
    try {
      const response = await fetch('/api/mocktests', {
        headers: { 'Authorization': `Bearer ${auth.getToken()}` }
      });
      const data = await response.json();
      app.hideLoading();

      if (!data.success) return;

      this.renderMockPaperList(data.paper1, 'mock-paper1-container');
      this.renderMockPaperList(data.paper2, 'mock-paper2-container');
    } catch (error) {
      app.hideLoading();
      console.error(error);
    }
  },

  renderMockPaperList(mockList, containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    if (!mockList.length) {
      container.innerHTML = `<p class="text-center text-muted col-12 p-3">No mock test sheets uploaded for this paper yet.</p>`;
      return;
    }

    mockList.forEach(test => {
      const card = document.createElement('div');
      card.className = `chapter-card ${test.isLocked ? 'locked' : ''}`;

      card.innerHTML = `
        ${test.isLocked ? '<div class="lock-overlay-badge"><i class="fa-solid fa-lock"></i></div>' : '<div class="lock-overlay-badge unlocked-icon"><i class="fa-solid fa-lock-open"></i></div>'}
        <div>
          <div class="chapter-num">${test.paperType}</div>
          <h3>${test.title}</h3>
        </div>
        <div class="footer-info">
          <span class="q-count"><i class="fa-solid fa-circle-question"></i> 100 Qs | ${test.timerMinutes || 120} Min</span>
          ${test.isLocked ? 
            `<button class="btn btn-outline btn-sm" onclick="app.purchasePremium()"><i class="fa-solid fa-bolt text-warning"></i> Unlock</button>` : 
            `<button class="btn btn-primary btn-sm" onclick="exam.startTest('mock', '${test._id}', '${test.title}')">Start Exam</button>`
          }
        </div>
      `;
      container.appendChild(card);
    });
  },

  switchMockTab(tabId) {
    this.activeMockTab = tabId;
    document.querySelectorAll('#view-mock-lobby .tab-btn').forEach(btn => {
      const match = btn.getAttribute('onclick').includes(tabId);
      btn.classList.toggle('active', !!match);
    });
    
    document.getElementById('mock-paper1-container').classList.toggle('active', tabId === 'paper1');
    document.getElementById('mock-paper2-container').classList.toggle('active', tabId === 'paper2');
  },

  async showResultReport(resultId) {
    app.navigateTo('result-analysis');
    app.showLoading('Retrieving detailed answers analysis...');

    try {
      const response = await fetch(`/api/results/${resultId}`, {
        headers: { 'Authorization': `Bearer ${auth.getToken()}` }
      });
      const data = await response.json();
      app.hideLoading();

      if (!data.success) {
        alert('Failed to load performance report.');
        app.navigateTo('dashboard');
        return;
      }

      const { resultDetails, questions } = data;

      // Save for re-attempts
      this.lastAttemptType = resultDetails.testType;
      this.lastAttemptIdentifier = resultDetails.testIdentifier;
      this.lastAttemptTitle = resultDetails.testTitle;

      document.getElementById('result-test-title').innerText = resultDetails.testTitle;
      document.getElementById('res-score').innerText = resultDetails.score.toFixed(2);
      document.getElementById('res-total-marks').innerText = resultDetails.totalQuestions;
      document.getElementById('res-rank').innerText = resultDetails.rank;
      document.getElementById('res-total-candidates').innerText = resultDetails.totalParticipants;
      
      const accuracy = ((resultDetails.correctCount / resultDetails.totalQuestions) * 100).toFixed(1);
      document.getElementById('res-accuracy').innerText = `${accuracy}%`;

      const minutes = Math.floor(resultDetails.timeTakenSeconds / 60);
      const seconds = resultDetails.timeTakenSeconds % 60;
      document.getElementById('res-time').innerText = `${minutes}m ${seconds}s`;

      document.getElementById('res-count-correct').innerText = resultDetails.correctCount;
      document.getElementById('res-count-incorrect').innerText = resultDetails.incorrectCount;
      document.getElementById('res-count-skipped').innerText = resultDetails.unattemptedCount;

      // Render Strength Areas
      const strongContainer = document.getElementById('res-strong-list');
      strongContainer.innerHTML = '';
      if (resultDetails.strongAreas.length) {
        resultDetails.strongAreas.forEach(area => {
          strongContainer.innerHTML += `<span class="sub-pill paid mr-2 mb-2">${area}</span>`;
        });
      } else {
        strongContainer.innerHTML = '<li>No chapters met the strong criteria in this test. Keep practicing!</li>';
      }

      // Render Weak Areas
      const weakContainer = document.getElementById('res-weak-list');
      weakContainer.innerHTML = '';
      if (resultDetails.weakAreas.length) {
        resultDetails.weakAreas.forEach(area => {
          weakContainer.innerHTML += `<span class="sub-pill free mr-2 mb-2">${area}</span>`;
        });
      } else {
        weakContainer.innerHTML = '<li>No chapters fell below the weak criteria in this test. Great job!</li>';
      }

      // Render Detailed Answer review
      const solContainer = document.getElementById('res-solutions-container');
      solContainer.innerHTML = '';

      questions.forEach((q, index) => {
        const userSelected = resultDetails.answers[q._id];
        const correct = q.correctOption;
        
        const solItem = document.createElement('div');
        solItem.className = 'sol-item';
        
        let statusClass = 'text-muted';
        let statusIcon = '<i class="fa-solid fa-circle-minus"></i> Unattempted';
        
        if (userSelected === correct) {
          statusClass = 'text-success';
          statusIcon = '<i class="fa-solid fa-circle-check"></i> Correct';
        } else if (userSelected) {
          statusClass = 'text-danger';
          statusIcon = '<i class="fa-solid fa-circle-xmark"></i> Incorrect';
        }

        const optionsHtml = ['A', 'B', 'C', 'D', 'E'].map((letter, optIdx) => {
          const engOpt = q.englishVersion.options[optIdx] || '';
          const hinOpt = q.hindiVersion.options[optIdx] || '';
          let rowClass = '';
          
          if (letter === correct) rowClass = 'correct';
          else if (letter === userSelected) rowClass = 'wrong';

          const displayOpt = engOpt.trim() === hinOpt.trim() ? engOpt : `${engOpt} / <span class="text-indigo" style="color:#6366f1;">${hinOpt}</span>`;
          return `<div class="sol-option ${rowClass}"><strong>${letter}:</strong> ${displayOpt}</div>`;
        }).join('');

        solItem.innerHTML = `
          <div class="sol-question">
            Q${index + 1}: ${q.englishVersion.question}
            <div class="font-hindi text-muted mt-2">प्र. ${q.hindiVersion.question}</div>
          </div>
          <div class="sol-options-grid">${optionsHtml}</div>
          <span class="sol-status-text ${statusClass}">${statusIcon}</span>
        `;
        solContainer.appendChild(solItem);
      });

    } catch (error) {
      app.hideLoading();
      console.error(error);
    }
  },

  reattemptTest() {
    if (this.lastAttemptType && this.lastAttemptIdentifier) {
      exam.startTest(this.lastAttemptType, this.lastAttemptIdentifier, this.lastAttemptTitle);
    }
  },

  /* ==================== SIMULATED CHEKOUT ==================== */
  purchasePremium() {
    if (!auth.getToken()) {
      alert('You must log in to upgrade your subscription.');
      this.navigateTo('login');
      return;
    }
    document.getElementById('paymentModal').classList.remove('hidden');
  },

  closePaymentModal() {
    document.getElementById('paymentModal').classList.add('hidden');
  },

  async confirmPayment() {
    const txnIdInput = document.getElementById('payment-txn-id');
    const customTxnId = txnIdInput ? txnIdInput.value.trim() : '';

    this.closePaymentModal();
    this.showLoading('Authorizing premium subscription payment...');

    try {
      const response = await fetch('/api/payments/checkout', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth.getToken()}` 
        },
        body: JSON.stringify({ transactionId: customTxnId })
      });
      const data = await response.json();
      this.hideLoading();

      if (data.success) {
        if (txnIdInput) txnIdInput.value = '';
        this.user = data.user;
        this.updateUIForUser();
        alert(`Success! Payment Recorded.\nTransaction ID: ${data.payment.transactionId}\nPremium status unlocked for 1 Year.`);
        
        // If on landing, redirect to dashboard
        if (this.currentView === 'landing') {
          this.navigateTo('dashboard');
        } else {
          this.loadUserDashboard();
        }
      } else {
        alert(data.message || 'Payment simulation failed.');
      }
    } catch (error) {
      this.hideLoading();
      console.error(error);
      alert('Network error authorizing checkout.');
    }
  },

  /* ==================== ANNOUNCEMENTS FETCH ==================== */
  async loadSystemNotifications() {
    try {
      const response = await fetch('/api/admin/notifications/list');
      const data = await response.json();
      
      if (data.success) {
        const container = document.getElementById('dashboard-notifications');
        if (!container) return;

        container.innerHTML = '';
        data.notifications.forEach(n => {
          container.innerHTML += `
            <li>
              ${n.message}
              <span>${new Date(n.date).toLocaleDateString()}</span>
            </li>
          `;
        });
      }
    } catch (error) {
      console.error(error);
    }
  },

  /* ==================== UI SPINNERS ==================== */
  showLoading(text = 'Processing request...') {
    document.getElementById('loadingText').innerText = text;
    document.getElementById('loadingOverlay').classList.remove('hidden');
  },

  hideLoading() {
    document.getElementById('loadingOverlay').classList.add('hidden');
  },

  scrollToSection(sectionId) {
    const el = document.getElementById(sectionId);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  },

  /* ==================== THEME TOGGLING ==================== */
  initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    this.updateThemeIcon(savedTheme);

    const toggleBtn = document.getElementById('themeToggleBtn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => this.toggleTheme());
    }
  },

  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    this.updateThemeIcon(newTheme);
  },

  updateThemeIcon(theme) {
    const toggleBtn = document.getElementById('themeToggleBtn');
    if (toggleBtn) {
      const icon = toggleBtn.querySelector('i');
      if (icon) {
        if (theme === 'dark') {
          icon.className = 'fa-solid fa-sun';
          icon.style.color = '#fbbf24';
        } else {
          icon.className = 'fa-solid fa-moon';
          icon.style.color = '';
        }
      }
    }
  }
};

// Initialize Application on window load
window.addEventListener('DOMContentLoaded', () => {
  app.init();
});
