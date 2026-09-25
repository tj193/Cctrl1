(() => {
  'use strict';
  const form = document.getElementById('driverForm');
  const value = id => document.getElementById(id).value.trim();
  const apiBase = ['localhost', '127.0.0.1'].includes(window.location.hostname)
    ? `http://${window.location.hostname}:8000` : window.location.origin;
  const message = document.createElement('p');
  message.className = 'auth-message';
  message.setAttribute('role', 'status');
  form.append(message);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('button[type=submit]');
    message.textContent = '';
    const password = document.getElementById('driverPassword').value;
    if (password !== document.getElementById('driverConfirmPassword').value) { message.textContent = 'Passwords do not match.'; return; }
    if (password.length < 12) { message.textContent = 'Use at least 12 characters for your password.'; return; }
    const phone = window.DarbAccounts.normalizePhone(value('driverPhone'));
    if (!/^\+9647\d{9}$/.test(phone)) { message.textContent = 'Enter a valid Iraqi mobile number.'; return; }
    button.disabled = true;
    try {
      const response = await fetch(`${apiBase}/auth/driver-register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: value('driverName'), email: value('driverEmail'), phone, password,
          vehicle_type: value('vehicleType'), vehicle_model: value('vehicleModel'),
          plate_number: value('plateNumber'), license_number: value('drivingLicense'),
          national_id: value('idDocument')
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(typeof result.detail === 'string' ? result.detail : 'Please check the registration details.');
      form.reset();
      message.textContent = `Application #${result.application_id} sent for admin review. You can sign in after approval.`;
      message.classList.add('success');
    } catch (error) {
      message.classList.remove('success');
      message.textContent = error instanceof TypeError
        ? 'Could not reach the DarbGo API. Start the server and try again.'
        : error.message;
    }
    finally { button.disabled = false; }
  });
})();
