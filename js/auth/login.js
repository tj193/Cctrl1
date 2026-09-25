(() => {
  'use strict';
  const form = document.getElementById('loginForm');
  const message = document.createElement('p');
  message.className = 'auth-message';
  message.setAttribute('role', 'alert');
  form.append(message);
  const password = document.getElementById('loginPassword');
  const toggle = document.getElementById('toggleLoginPassword');
  toggle.addEventListener('click', () => {
    const show = password.type === 'password';
    password.type = show ? 'text' : 'password';
    toggle.textContent = show ? 'Hide' : 'Show';
    toggle.setAttribute('aria-pressed', String(show));
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('button[type=submit]');
    button.disabled = true;
    message.textContent = '';
    try {
      let user;
      try {
        user = await window.DarbAccounts.login(document.getElementById('loginIdentifier').value, password.value);
      } catch (localError) {
        const apiBase = ['localhost', '127.0.0.1'].includes(window.location.hostname)
          ? `http://${window.location.hostname}:8000` : window.location.origin;
        try {
          const formData = new URLSearchParams({ username: document.getElementById('loginIdentifier').value, password: password.value });
          const response = await fetch(`${apiBase}/auth/driver-login`, { method: 'POST', body: formData });
          const result = await response.json();
          if (!response.ok) throw new Error(response.status === 403 ? result.detail : localError.message);
          user = result;
          sessionStorage.setItem('loggedInUser', JSON.stringify(user));
        } catch (apiError) {
          throw apiError instanceof TypeError ? localError : apiError;
        }
      }
      const destinations = { student: 'student/dashboard.html', driver: 'driver/driver_dashboard.html', admin: 'admin/dashboard.html' };
      if (!destinations[user.role]) throw new Error('This demo account has an unsupported role.');
      window.location.href = destinations[user.role];
    } catch (error) {
      message.textContent = error instanceof SyntaxError ? 'Saved demo data could not be read. Try a separate browser profile.' : error.message;
    } finally { button.disabled = false; }
  });
})();
