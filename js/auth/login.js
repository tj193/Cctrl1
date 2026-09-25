(() => {
  'use strict';
  const form = document.getElementById('loginForm');
  const message = document.createElement('p');
  message.className = 'auth-message';
  message.setAttribute('role', 'alert');
  form.append(message);
  const password = document.getElementById('loginPassword');
  const role = document.getElementById('loginRole');
  if (new URLSearchParams(window.location.search).get('role') === 'driver') role.value = 'driver';
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
      if (role.value === 'driver') {
        const result = await window.DarbDriverApi.login(document.getElementById('loginIdentifier').value, password.value);
        sessionStorage.setItem('driverToken', result.access_token);
        window.location.href = 'driver/driver_dashboard.html';
        return;
      }
      const user = await window.DarbAccounts.login(document.getElementById('loginIdentifier').value, password.value);
      if (user.role !== 'student') throw new Error('Choose Driver for a driver account.');
      window.location.href = 'student/dashboard.html';
    } catch (error) {
      message.textContent = error instanceof SyntaxError ? 'Saved demo data could not be read. Try a separate browser profile.' : error.message;
    } finally { button.disabled = false; }
  });
})();
