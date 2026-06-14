const admin = {
  currentTab: 'analytics',
  questions: [],
  chapters: [],
  
  // Chart references to prevent layout reuse errors
  regChart: null,
  chapterChart: null,

  initAdminDashboard() {
    this.loadStats();
    this.initDragDrop();
    this.loadChaptersDropdown();
    this.loadMockTestsDropdown();
  },

  async handleAdminLogin(event) {
    event.preventDefault();
    const passcode = document.getElementById('admin-passcode').value;

    app.showLoading('Checking passcode credentials...');
    
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode })
      });
      const data = await response.json();
      app.hideLoading();

      if (data.success) {
        auth.setToken(data.token);
        app.user = data.user;
        app.updateUIForUser();
        
        document.getElementById('admin-passcode').value = '';
        alert('Welcome back, Admin! Redirecting to dashboard.');
        app.navigateTo('admin-dashboard');
        this.loadStats();
        this.initDragDrop();
        this.loadChaptersDropdown();
      } else {
        alert(data.message || 'Passcode rejected.');
      }
    } catch (error) {
      app.hideLoading();
      console.error(error);
      alert('Error connecting to administrator servers.');
    }
  },

  switchTab(tabName) {
    this.currentTab = tabName;
    document.querySelectorAll('.admin-tab').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.admin-tab-content').forEach(el => el.classList.remove('active'));

    const tabTrigger = Array.from(document.querySelectorAll('.admin-tab')).find(el => el.getAttribute('onclick').includes(tabName));
    if (tabTrigger) tabTrigger.classList.add('active');
    
    const contentFrame = document.getElementById(`admin-tab-${tabName}`);
    if (contentFrame) contentFrame.classList.add('active');

    // Action handlers based on active tab
    if (tabName === 'analytics') this.loadStats();
    else if (tabName === 'users') this.loadUsers();
    else if (tabName === 'questions') this.loadQuestionsList();
  },

  async loadStats() {
    try {
      const response = await fetch('/api/admin/stats', {
        headers: { 'Authorization': `Bearer ${auth.getToken()}` }
      });
      const data = await response.json();

      if (!data.success) {
        alert(data.message || 'Failed to retrieve analytics.');
        return;
      }

      const { stats } = data;
      document.getElementById('admin-stat-users').innerText = stats.totalUsers;
      document.getElementById('admin-stat-active').innerText = stats.activeUsers;
      document.getElementById('admin-stat-paid').innerText = stats.paidUsers;
      document.getElementById('admin-stat-revenue').innerText = `₹${stats.revenue.toFixed(2)}`;

      // Render Charts
      this.renderRegistrationsChart(stats.dailyRegistrations);
      this.renderChaptersChart(stats.popularChapters);
    } catch (error) {
      console.error('Error fetching admin stats:', error);
    }
  },

  renderRegistrationsChart(dailyData) {
    const ctx = document.getElementById('chart-registrations');
    if (!ctx) return;

    if (this.regChart) this.regChart.destroy();

    const labels = dailyData.map(d => d._id);
    const counts = dailyData.map(d => d.count);

    this.regChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels.length ? labels : ['No Data'],
        datasets: [{
          label: 'Daily Sign Ups',
          data: counts.length ? counts : [0],
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false
      }
    });
  },

  renderChaptersChart(chapterData) {
    const ctx = document.getElementById('chart-popular-chapters');
    if (!ctx) return;

    if (this.chapterChart) this.chapterChart.destroy();

    const labels = chapterData.map(d => d._id);
    const counts = chapterData.map(d => d.count);

    this.chapterChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels.length ? labels : ['No Data'],
        datasets: [{
          label: 'Attempt Counter',
          data: counts.length ? counts : [0],
          backgroundColor: '#1e3a8a',
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: 'y', // Horizontal bars
        responsive: true,
        maintainAspectRatio: false
      }
    });
  },

  async loadUsers(searchVal = '') {
    try {
      const url = searchVal ? `/api/admin/users?search=${encodeURIComponent(searchVal)}` : '/api/admin/users';
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${auth.getToken()}` }
      });
      const data = await response.json();

      const tbody = document.getElementById('admin-users-tbody');
      tbody.innerHTML = '';

      if (!data.success || data.users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center">No matching user profiles found.</td></tr>`;
        return;
      }

      data.users.forEach(u => {
        const tr = document.createElement('tr');
        
        let subActionBtn = '';
        if (u.subscriptionStatus === 'paid') {
          subActionBtn = `<button class="btn btn-warning btn-xs" onclick="admin.toggleUserPremium('${u._id}', 'free')" title="Lock to Free"><i class="fa-solid fa-lock"></i> Revoke</button>`;
        } else {
          subActionBtn = `<button class="btn btn-success btn-xs" onclick="admin.toggleUserPremium('${u._id}', 'paid')" title="Unlock to Premium"><i class="fa-solid fa-unlock"></i> Approve</button>`;
        }

        const deleteBtn = `<button class="btn btn-danger btn-xs" onclick="admin.deleteUser('${u._id}', '${u.name}')" title="Delete Account"><i class="fa-solid fa-trash"></i> Delete</button>`;

        tr.innerHTML = `
          <td><strong>${u.name}</strong></td>
          <td>+91 ${u.mobile}</td>
          <td>${new Date(u.registeredDate).toLocaleDateString()}</td>
          <td>${u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : 'N/A'}</td>
          <td><span class="sub-pill ${u.subscriptionStatus}">${u.subscriptionStatus}</span></td>
          <td class="text-center">${u.attemptsCount} Attempts</td>
          <td class="text-center" style="display: flex; gap: 8px; justify-content: center;">
            ${subActionBtn}
            ${deleteBtn}
          </td>
        `;
        tbody.appendChild(tr);
      });
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  },

  async toggleUserPremium(userId, targetStatus) {
    const actionText = targetStatus === 'paid' ? 'approve premium access for' : 'revoke premium access from';
    if (!confirm(`Are you sure you want to ${actionText} this user?`)) {
      return;
    }

    app.showLoading('Updating subscription status...');
    try {
      const response = await fetch(`/api/admin/users/${userId}/subscription`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth.getToken()}`
        },
        body: JSON.stringify({ subscriptionStatus: targetStatus })
      });
      const data = await response.json();
      app.hideLoading();

      if (data.success) {
        alert(data.message);
        this.loadUsers();
        this.loadStats();
      } else {
        alert(data.message || 'Failed to update subscription status.');
      }
    } catch (error) {
      app.hideLoading();
      console.error(error);
      alert('Error updating user subscription status.');
    }
  },

  async deleteUser(userId, name) {
    if (!confirm(`⚠️ WARNING: Are you absolutely sure you want to delete user "${name}"?\nThis permanently deletes their profile, result history, and payment logs. This action cannot be undone.`)) {
      return;
    }

    app.showLoading('Deleting user account...');
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${auth.getToken()}` }
      });
      const data = await response.json();
      app.hideLoading();

      if (data.success) {
        alert(data.message);
        this.loadUsers();
        this.loadStats();
      } else {
        alert(data.message || 'Failed to delete user.');
      }
    } catch (error) {
      app.hideLoading();
      console.error(error);
      alert('Error deleting user account.');
    }
  },

  searchUsers(val) {
    // Debounce/Filter user listings
    this.loadUsers(val);
  },

  async exportUserData() {
    try {
      const response = await fetch('/api/admin/users/export', {
        headers: { 'Authorization': `Bearer ${auth.getToken()}` }
      });
      const data = await response.json();
      
      if (!data.success) {
        alert('Failed to export details.');
        return;
      }

      // Download JSON structure
      const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ExamPrep_Users_${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      alert('Error exporting file.');
    }
  },

  /* ==================== BULK UPLOADING ==================== */
  initDragDrop() {
    const zone = document.getElementById('drag-drop-zone');
    const input = document.getElementById('bulk-upload-file');
    
    if (!zone) return;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      zone.addEventListener(eventName, (e) => e.preventDefault(), false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
      zone.addEventListener(eventName, () => zone.classList.add('dragover'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      zone.addEventListener(eventName, () => zone.classList.remove('dragover'), false);
    });

    zone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files.length) {
        input.files = files;
        this.updateFileIndicator(files[0]);
      }
    });

    input.addEventListener('change', () => {
      if (input.files.length) {
        this.updateFileIndicator(input.files[0]);
      }
    });
  },

  updateFileIndicator(file) {
    document.getElementById('drag-drop-zone').classList.add('hidden');
    const info = document.getElementById('file-selected-info');
    info.classList.remove('hidden');
    document.getElementById('selected-filename').innerText = file.name;
    document.getElementById('selected-filesize').innerText = `${Math.round(file.size / 1024)} KB`;
  },

  clearSelectedFile() {
    document.getElementById('bulk-upload-file').value = '';
    document.getElementById('file-selected-info').classList.add('hidden');
    document.getElementById('drag-drop-zone').classList.remove('hidden');
  },

  async handleBulkUpload(event) {
    event.preventDefault();
    const input = document.getElementById('bulk-upload-file');
    if (!input.files.length) {
      alert('Select a file to parse!');
      return;
    }

    const formData = new FormData();
    formData.append('file', input.files[0]);

    app.showLoading('Uploading file & processing database insertions...');

    try {
      const response = await fetch('/api/admin/questions/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${auth.getToken()}` },
        body: formData
      });
      const data = await response.json();
      app.hideLoading();

      if (data.success) {
        alert(data.message);
        this.clearSelectedFile();
        this.switchTab('questions');
      } else {
        alert(data.message || 'File processing failed.');
      }
    } catch (error) {
      app.hideLoading();
      console.error(error);
      alert('Connection error occurred while processing bulk uploads.');
    }
  },

  /* ==================== ANNOUNCEMENTS ==================== */
  async handleBroadcast(event) {
    event.preventDefault();
    const message = document.getElementById('broadcast-message').value.trim();

    if (!message) return;

    app.showLoading('Broadcasting announcement...');

    try {
      const response = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth.getToken()}`
        },
        body: JSON.stringify({ message })
      });
      const data = await response.json();
      app.hideLoading();

      if (data.success) {
        alert('Broadcast notification successfully sent!');
        document.getElementById('broadcast-message').value = '';
      } else {
        alert(data.message || 'Failed to broadcast message.');
      }
    } catch (error) {
      app.hideLoading();
      console.error(error);
      alert('Network error broadcasting notification.');
    }
  },

  /* ==================== QUESTIONS CRUD ==================== */
  async loadChaptersDropdown() {
    try {
      const response = await fetch('/api/questions/chapters', {
        headers: { 'Authorization': `Bearer ${auth.getToken()}` }
      });
      const data = await response.json();

      if (data.success) {
        this.chapters = data.chapters;
        
        // Fill question filters
        const filterDropdown = document.getElementById('admin-select-chapter-filter');
        filterDropdown.innerHTML = '<option value="">Choose a Chapter...</option>';
        
        // Fill manual creator
        const creatorDropdown = document.getElementById('q-chapter');
        creatorDropdown.innerHTML = '';

        data.chapters.forEach(ch => {
          const opt = `<option value="${ch.name}">${ch.name}</option>`;
          filterDropdown.innerHTML += opt;
          creatorDropdown.innerHTML += opt;
        });
      }
    } catch (error) {
      console.error(error);
    }
  },

  async filterQuestions(chapterName) {
    if (!chapterName) {
      document.getElementById('admin-questions-list-wrapper').innerHTML = `<p class="text-center text-muted">Select a chapter or a mock test to review, edit, or delete questions.</p>`;
      return;
    }

    // Clear mock test dropdown to prevent double selection confusion
    const mockFilter = document.getElementById('admin-select-mock-filter');
    if (mockFilter) mockFilter.value = '';

    app.showLoading(`Loading database questions for ${chapterName}...`);

    try {
      const response = await fetch(`/api/questions/chapters/${encodeURIComponent(chapterName)}`, {
        headers: { 'Authorization': `Bearer ${auth.getToken()}` }
      });
      const data = await response.json();
      app.hideLoading();

      const wrapper = document.getElementById('admin-questions-list-wrapper');
      wrapper.innerHTML = '';

      if (!data.success || data.questions.length === 0) {
        wrapper.innerHTML = `<p class="text-center text-muted p-3">No questions found in this chapter. Try adding one!</p>`;
        return;
      }

      this.questions = data.questions;

      data.questions.forEach((q, idx) => {
        const item = document.createElement('div');
        item.className = 'admin-question-db-item p-3';
        item.innerHTML = `
          <h4>Q${idx + 1}: ${q.englishVersion.question}</h4>
          <p class="font-hindi text-muted">प्रश्न: ${q.hindiVersion.question}</p>
          <div class="actions-row">
            <button class="btn btn-outline btn-sm" onclick="admin.showEditQuestionModal('${q._id}')"><i class="fa-solid fa-pen-to-square"></i> Edit</button>
            <button class="btn btn-danger btn-sm" onclick="admin.deleteQuestion('${q._id}', '${chapterName}')"><i class="fa-solid fa-trash-can"></i> Delete</button>
          </div>
        `;
        wrapper.appendChild(item);
      });
    } catch (error) {
      app.hideLoading();
      console.error(error);
      alert('Error fetching database questions.');
    }
  },

  async loadMockTestsDropdown() {
    try {
      const response = await fetch('/api/mocktests', {
        headers: { 'Authorization': `Bearer ${auth.getToken()}` }
      });
      const data = await response.json();

      if (data.success) {
        const filterDropdown = document.getElementById('admin-select-mock-filter');
        if (filterDropdown) {
          filterDropdown.innerHTML = '<option value="">Select Mock Test...</option>';
          const allMocks = [...data.paper1, ...data.paper2];
          allMocks.forEach(m => {
            filterDropdown.innerHTML += `<option value="${m._id}">${m.title} (${m.paperType})</option>`;
          });
        }
      }
    } catch (error) {
      console.error(error);
    }
  },

  async filterMockQuestions(mockTestId) {
    if (!mockTestId) {
      document.getElementById('admin-questions-list-wrapper').innerHTML = `<p class="text-center text-muted">Select a chapter or a mock test to review, edit, or delete questions.</p>`;
      return;
    }

    // Reset chapter filter to prevent confusion
    const chFilter = document.getElementById('admin-select-chapter-filter');
    if (chFilter) chFilter.value = '';

    app.showLoading(`Loading mock test questions...`);

    try {
      const response = await fetch(`/api/mocktests/${mockTestId}`, {
        headers: { 'Authorization': `Bearer ${auth.getToken()}` }
      });
      const data = await response.json();
      app.hideLoading();

      const wrapper = document.getElementById('admin-questions-list-wrapper');
      wrapper.innerHTML = '';

      if (!data.success || !data.mockTest || data.mockTest.questions.length === 0) {
        wrapper.innerHTML = `<p class="text-center text-muted p-3">No questions found in this mock test.</p>`;
        return;
      }

      this.questions = data.mockTest.questions;

      this.questions.forEach((q, idx) => {
        const item = document.createElement('div');
        item.className = 'admin-question-db-item p-3';
        item.innerHTML = `
          <h4>Q${idx + 1}: ${q.englishVersion.question}</h4>
          <p class="font-hindi text-muted">प्रश्न: ${q.hindiVersion.question}</p>
          <div class="actions-row">
            <button class="btn btn-outline btn-sm" onclick="admin.showEditQuestionModal('${q._id}')"><i class="fa-solid fa-pen-to-square"></i> Edit</button>
            <button class="btn btn-danger btn-sm" onclick="admin.deleteQuestion('${q._id}', 'mock_${mockTestId}')"><i class="fa-solid fa-trash-can"></i> Delete</button>
          </div>
        `;
        wrapper.appendChild(item);
      });
    } catch (error) {
      app.hideLoading();
      console.error(error);
      alert('Error fetching mock test questions.');
    }
  },

  loadQuestionsList() {
    const chapterVal = document.getElementById('admin-select-chapter-filter').value;
    const mockVal = document.getElementById('admin-select-mock-filter').value;
    if (mockVal) {
      this.filterMockQuestions(mockVal);
    } else {
      this.filterQuestions(chapterVal);
    }
  },

  showAddQuestionModal() {
    document.getElementById('form-question-editor').reset();
    document.getElementById('edit-q-id').value = '';
    document.getElementById('question-modal-title').innerText = 'Add Question Manually';
    document.getElementById('questionEditorModal').classList.remove('hidden');
    this.toggleMockTitleField('chapter');
  },

  showEditQuestionModal(qId) {
    const q = this.questions.find(item => item._id === qId);
    if (!q) return;

    document.getElementById('edit-q-id').value = q._id;
    document.getElementById('question-modal-title').innerText = 'Edit Question Details';

    // Populate English fields
    document.getElementById('q-text-en').value = q.englishVersion.question;
    document.getElementById('q-opt-a-en').value = q.englishVersion.options[0];
    document.getElementById('q-opt-b-en').value = q.englishVersion.options[1];
    document.getElementById('q-opt-c-en').value = q.englishVersion.options[2];
    document.getElementById('q-opt-d-en').value = q.englishVersion.options[3];
    document.getElementById('q-opt-e-en').value = q.englishVersion.options[4] || 'None of the above';

    // Populate Hindi fields
    document.getElementById('q-text-hi').value = q.hindiVersion.question;
    document.getElementById('q-opt-a-hi').value = q.hindiVersion.options[0];
    document.getElementById('q-opt-b-hi').value = q.hindiVersion.options[1];
    document.getElementById('q-opt-c-hi').value = q.hindiVersion.options[2];
    document.getElementById('q-opt-d-hi').value = q.hindiVersion.options[3];
    document.getElementById('q-opt-e-hi').value = q.hindiVersion.options[4] || 'उपरोक्त में से कोई नहीं';

    // Settings
    document.getElementById('q-correct').value = q.correctOption;
    document.getElementById('q-chapter').value = q.chapterName;
    document.getElementById('q-type').value = q.questionType;

    this.toggleMockTitleField(q.questionType);
    
    document.getElementById('questionEditorModal').classList.remove('hidden');
  },

  closeQuestionModal() {
    document.getElementById('questionEditorModal').classList.add('hidden');
  },

  toggleMockTitleField(type) {
    const field = document.getElementById('form-group-mock-title');
    field.classList.toggle('hidden', type !== 'mock');
  },

  async saveQuestion(event) {
    event.preventDefault();
    const id = document.getElementById('edit-q-id').value;
    
    const payload = {
      englishVersion: {
        question: document.getElementById('q-text-en').value,
        options: [
          document.getElementById('q-opt-a-en').value,
          document.getElementById('q-opt-b-en').value,
          document.getElementById('q-opt-c-en').value,
          document.getElementById('q-opt-d-en').value,
          document.getElementById('q-opt-e-en').value
        ]
      },
      hindiVersion: {
        question: document.getElementById('q-text-hi').value,
        options: [
          document.getElementById('q-opt-a-hi').value,
          document.getElementById('q-opt-b-hi').value,
          document.getElementById('q-opt-c-hi').value,
          document.getElementById('q-opt-d-hi').value,
          document.getElementById('q-opt-e-hi').value
        ]
      },
      correctOption: document.getElementById('q-correct').value,
      chapterName: document.getElementById('q-chapter').value,
      questionType: document.getElementById('q-type').value,
      mockTestTitle: document.getElementById('q-mock-title').value
    };

    app.showLoading('Saving question...');

    try {
      let url = '/api/admin/questions/add';
      let method = 'POST';

      if (id) {
        url = `/api/admin/questions/${id}`;
        method = 'PUT';
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth.getToken()}`
        },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      app.hideLoading();

      if (data.success) {
        alert('Question details successfully saved.');
        this.closeQuestionModal();
        this.loadQuestionsList();
      } else {
        alert(data.message || 'Error saving question.');
      }
    } catch (error) {
      app.hideLoading();
      console.error(error);
      alert('Error updating question record.');
    }
  },

  async deleteQuestion(qId, chapterName) {
    if (!confirm('Are you absolutely sure you want to delete this question? This action cannot be undone.')) {
      return;
    }

    app.showLoading('Deleting question...');

    try {
      const response = await fetch(`/api/admin/questions/${qId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${auth.getToken()}` }
      });
      const data = await response.json();
      app.hideLoading();

      if (data.success) {
        alert(data.message);
        if (chapterName.startsWith('mock_')) {
          this.filterMockQuestions(chapterName.replace('mock_', ''));
        } else {
          this.filterQuestions(chapterName);
        }
      } else {
        alert(data.message || 'Failed to delete question.');
      }
    } catch (error) {
      app.hideLoading();
      console.error(error);
      alert('Connection error deleting question.');
    }
  },

  async autoTranslateFields() {
    const qText = document.getElementById('q-text-en').value.trim();
    const optA = document.getElementById('q-opt-a-en').value.trim();
    const optB = document.getElementById('q-opt-b-en').value.trim();
    const optC = document.getElementById('q-opt-c-en').value.trim();
    const optD = document.getElementById('q-opt-d-en').value.trim();
    const optE = document.getElementById('q-opt-e-en').value.trim();

    if (!qText) {
      alert('Please fill in the English Question Text first!');
      return;
    }

    app.showLoading('Translating English fields to Hindi...');

    const translateApi = async (text) => {
      if (!text || !text.trim()) return '';
      try {
        const response = await fetch('/api/admin/translate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${auth.getToken()}`
          },
          body: JSON.stringify({ text })
        });
        const data = await response.json();
        return data.success ? data.translated : text;
      } catch (e) {
        return text;
      }
    };

    try {
      document.getElementById('q-text-hi').value = await translateApi(qText);
      if (optA) document.getElementById('q-opt-a-hi').value = await translateApi(optA);
      if (optB) document.getElementById('q-opt-b-hi').value = await translateApi(optB);
      if (optC) document.getElementById('q-opt-c-hi').value = await translateApi(optC);
      if (optD) document.getElementById('q-opt-d-hi').value = await translateApi(optD);
      
      if (optE) {
        if (optE === 'None of the above') {
          document.getElementById('q-opt-e-hi').value = 'उपरोक्त में से कोई नहीं';
        } else {
          document.getElementById('q-opt-e-hi').value = await translateApi(optE);
        }
      }
      
      app.hideLoading();
    } catch (error) {
      app.hideLoading();
      console.error(error);
      alert('Translation failed. Please try again.');
    }
  },

  logout() {
    auth.logout();
  }
};
