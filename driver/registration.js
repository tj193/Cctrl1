(() => {
  'use strict';
  const form = document.getElementById('driverForm');
  const value = id => document.getElementById(id).value.trim();
  const filename = id => document.getElementById(id).files[0]?.name || '';
  const message = document.createElement('p');
  message.className = 'auth-message';
  message.setAttribute('role', 'alert');
  form.append(message);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('button[type=submit]');
    message.textContent = '';
    const password = document.getElementById('driverPassword').value;
    if (password !== document.getElementById('driverConfirmPassword').value) { message.textContent = 'Passwords do not match.'; return; }
    if (password.length < 8) { message.textContent = 'Use at least 8 characters for your password.'; return; }
    if (!/^\+9647\d{9}$/.test(window.DarbAccounts.normalizePhone(value('driverPhone')))) { message.textContent = 'Enter a valid Iraqi mobile number.'; return; }
    button.disabled = true;
    try {
      await window.DarbAccounts.create({
        fullName: value('driverName'), email: value('driverEmail'), phone: value('driverPhone'),
        vehicle: { type: value('vehicleType'), model: value('vehicleModel'), plateNumber: value('plateNumber'), seats: Number(value('numberOfSeats')), photo: filename('vehiclePhoto') },
        verification: { drivingLicense: filename('drivingLicense'), idDocument: filename('idDocument') }, role: 'driver', status: 'pending'
      }, password);
      form.reset();
      message.textContent = 'Demo application saved with pending status. Only file names are stored; no documents have been uploaded or sent for review.';
    } catch (error) { message.textContent = error.message || 'This demo account could not be saved.'; }
    finally { button.disabled = false; }
  });
})();
