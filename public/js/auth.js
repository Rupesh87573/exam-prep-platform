// Custom Toast Notification System
window.showToast = function(message, type = 'info') {
  let container = document.getElementById('toast-notification-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-notification-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast-message ${type}`;

  let iconClass = 'fa-circle-info';
  if (type === 'success') iconClass = 'fa-circle-check';
  else if (type === 'error') iconClass = 'fa-circle-xmark';
  else if (type === 'warning') iconClass = 'fa-triangle-exclamation';

  toast.innerHTML = `
    <div class="toast-icon"><i class="fa-solid ${iconClass}"></i></div>
    <div class="toast-text">${message.replace(/\n/g, '<br>')}</div>
    <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
  `;

  container.appendChild(toast);

  // Automatically remove toast after 4 seconds (slide out finishes at 4s)
  setTimeout(() => {
    if (toast.parentElement) toast.remove();
  }, 4000);
};

// Override default window.alert
window.alert = function(message) {
  const lowerMsg = message.toLowerCase();
  let type = 'info';
  if (lowerMsg.includes('success') || lowerMsg.includes('welcome') || lowerMsg.includes('unlocked') || lowerMsg.includes('passed') || lowerMsg.includes('recorded')) {
    type = 'success';
  } else if (lowerMsg.includes('error') || lowerMsg.includes('fail') || lowerMsg.includes('invalid') || lowerMsg.includes('incorrect') || lowerMsg.includes('expired') || lowerMsg.includes('forbidden') || lowerMsg.includes('rejected') || lowerMsg.includes('denied') || lowerMsg.includes('alert') || lowerMsg.includes('security') || lowerMsg.includes('violation')) {
    type = 'error';
  } else if (lowerMsg.includes('warning') || lowerMsg.includes('caution') || lowerMsg.includes('required') || lowerMsg.includes('missing') || lowerMsg.includes('select a file')) {
    type = 'warning';
  }
  
  window.showToast(message, type);
};

const auth = {
  mobile: '',
  otpToken: null,

  init() {
    // Check if token exists on initialization
    const token = this.getToken();
    if (token) {
      this.checkSession();
    }
  },

  getToken() {
    return localStorage.getItem('token');
  },

  setToken(token) {
    localStorage.setItem('token', token);
  },

  clearToken() {
    localStorage.removeItem('token');
  },

  async handleSendOtp(event) {
    event.preventDefault();
    const name = document.getElementById('reg-name').value.trim();
    const mobile = document.getElementById('reg-mobile').value.trim();

    if (!mobile || mobile.length < 10) {
      alert('Please enter a valid 10-digit mobile number.');
      return;
    }

    app.showLoading('Sending verification OTP...');

    try {
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile })
      });
      const data = await response.json();
      app.hideLoading();

      if (data.success) {
        this.mobile = mobile;
        this.name = name; // Save in-memory to send during verification
        
        // Show OTP step
        this.showOtpStep(data.otp);
      } else {
        alert(data.message || 'Failed to send OTP. Try again.');
      }
    } catch (error) {
      app.hideLoading();
      console.error(error);
      alert('Error connecting to authentication server.');
    }
  },

  async handleVerifyOtp(event) {
    event.preventDefault();
    const otp = document.getElementById('reg-otp').value.trim();

    if (!otp || otp.length < 6) {
      alert('Please enter the 6-digit OTP code.');
      return;
    }

    app.showLoading('Verifying code...');

    try {
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mobile: this.mobile,
          otp,
          name: this.name
        })
      });
      const data = await response.json();
      app.hideLoading();

      if (data.success) {
        this.setToken(data.token);
        app.user = data.user;
        app.updateUIForUser();
        alert(`Welcome, ${data.user.name}!`);
        app.navigateTo('dashboard');
      } else if (data.isNewUser) {
        alert(data.message);
        this.showMobileStep();
      } else {
        alert(data.message || 'Incorrect OTP code.');
      }
    } catch (error) {
      app.hideLoading();
      console.error(error);
      alert('Verification server error.');
    }
  },

  showMobileStep() {
    document.getElementById('auth-step-mobile').classList.remove('hidden');
    document.getElementById('auth-step-otp').classList.add('hidden');
    document.getElementById('reg-otp').value = '';
  },

  showOtpStep(simulatedOtp) {
    document.getElementById('auth-step-mobile').classList.add('hidden');
    document.getElementById('auth-step-otp').classList.remove('hidden');
    document.getElementById('display-otp-mobile').innerText = `+91 ${this.mobile}`;
    
    // Show simulated OTP to user on the screen so they don't have to trace terminal
    document.getElementById('simulated-otp-code').innerText = simulatedOtp;
  },

  async checkSession() {
    const token = this.getToken();
    if (!token) return;

    try {
      const response = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();

      if (data.success) {
        app.user = data.user;
        app.userStats = data.stats;
        app.updateUIForUser();
        
        // If we are currently on landing or login view, take user to dashboard
        if (app.currentView === 'login' || app.currentView === 'landing') {
          app.navigateTo('dashboard');
        }
      } else {
        // Token has expired or is invalid
        this.clearToken();
        app.user = null;
        app.updateUIForGuest();
      }
    } catch (error) {
      console.error('Session verification error:', error);
    }
  },

  logout() {
    this.clearToken();
    app.user = null;
    app.userStats = null;
    app.updateUIForGuest();
    alert('Logged out successfully.');
    app.navigateTo('landing');
  }
};
