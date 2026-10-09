(() => {
  'use strict';
  const form = document.getElementById('loginForm');
  const message = document.createElement('p');
  message.className = 'auth-message';
  message.setAttribute('role', 'alert');
  form.append(message);
  const password = document.getElementById('loginPassword');
  document.getElementById('toggleLoginPassword').addEventListener('click', event => {
    const show = password.type === 'password';
    password.type = show ? 'text' : 'password';
    event.currentTarget.textContent = show ? 'Hide' : 'Show';
    event.currentTarget.setAttribute('aria-pressed', String(show));
  });
  const apiBase = ['localhost', '127.0.0.1'].includes(location.hostname)
    ? `http://${location.hostname}:8001` : location.origin;
  const preview = new URLSearchParams(location.search).get('demo') === '1';
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('button[type=submit]');
    button.disabled = true;
    message.textContent = '';
    try {
      if (preview) {
        const account = await window.DarbAccounts.login(document.getElementById('loginIdentifier').value, password.value);
        if (account.role !== 'student') throw new Error('Preview login supports Students only.');
        location.href = 'student/dashboard.html?demo=1';
        return;
      }
      const fields = new URLSearchParams({ username: document.getElementById('loginIdentifier').value.trim(), password: password.value });
      let response = await fetch(`${apiBase}/auth/student-login`, { method: 'POST', body: fields });
      let result = await response.json().catch(() => ({}));
      if (response.ok) {
        sessionStorage.removeItem('driverToken');
        sessionStorage.setItem('studentToken', result.access_token);
        sessionStorage.setItem('loggedInUser', JSON.stringify({ role: 'student', fullName: result.name, email: result.email }));
        location.href = 'student/dashboard.html';
        return;
      }
      if (response.status !== 401) throw new Error(typeof result.detail === 'string' ? result.detail : 'Student sign-in failed.');
      response = await fetch(`${apiBase}/auth/driver-login`, { method: 'POST', body: fields });
      result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof result.detail === 'string' ? result.detail : 'Email or password is incorrect.');
      sessionStorage.removeItem('studentToken');
      sessionStorage.removeItem('loggedInUser');
      sessionStorage.setItem('driverToken', result.access_token);
      location.href = 'driver/driver_dashboard.html';
    } catch (error) {
      message.textContent = error instanceof TypeError ? 'Could not reach the DarbGo API. Start the server and try again.'
        : error.message || 'Sign-in failed.';
    } finally {
      password.value = '';
      button.disabled = false;
    }
  });
})();
