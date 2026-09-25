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
        if (user.role === 'driver') throw new Error('Driver sign-in requires the server.');
      } catch (localError) {
        const apiBase = ['localhost', '127.0.0.1'].includes(window.location.hostname)
          ? `http://${window.location.hostname}:8000` : window.location.origin;
        const formData = new URLSearchParams({ username: document.getElementById('loginIdentifier').value, password: password.value });
        try {
          const studentResponse = await fetch(`${apiBase}/auth/student-login`, { method: 'POST', body: formData });
          const studentResult = await studentResponse.json();
          if (studentResponse.ok) {
            user = { role: 'student', fullName: studentResult.name, email: studentResult.email, status: 'active' };
            sessionStorage.setItem('loggedInUser', JSON.stringify(user));
          } else if (studentResponse.status === 403) {
            throw new Error(studentResult.detail);
          } else {
            const driverResponse = await fetch(`${apiBase}/auth/driver-login`, { method: 'POST', body: formData });
            const driverResult = await driverResponse.json();
            if (!driverResponse.ok) throw new Error(driverResponse.status === 403 ? driverResult.detail : localError.message);
            sessionStorage.setItem('driverToken', driverResult.access_token);
            user = { role: 'driver' };
          }
        } catch (apiError) {
          throw apiError instanceof TypeError ? new Error('Could not reach the DarbGo API. Start the server and try again.') : apiError;
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
