(() => {
  'use strict';
  const form = document.getElementById('driverForm');
  const value = id => document.getElementById(id).value.trim();
  const message = document.createElement('p');
  message.className = 'auth-message';
  message.setAttribute('role', 'alert');
  form.append(message);
  const success = document.getElementById('registrationSuccess');
  const reference = document.getElementById('applicationReference');
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('button[type=submit]');
    message.textContent = '';
    const password = document.getElementById('driverPassword').value;
    if (password !== document.getElementById('driverConfirmPassword').value) { message.textContent = 'Passwords do not match.'; return; }
    if (password.length < 12) { message.textContent = 'Use at least 12 characters for your password.'; return; }
    button.disabled = true;
    try {
      const phone = value('driverPhone');
      const result = await window.DarbDriverApi.submit({
        full_name: value('driverName'), email: value('driverEmail'), phone, password,
        vehicle_type: value('vehicleType'), vehicle_model: value('vehicleModel'),
        plate_number: value('plateNumber'), license_number: value('licenseNumber'), national_id: value('nationalId')
      });
      form.reset();
      form.hidden = true;
      document.querySelector('.bottom-link').hidden = true;
      reference.textContent = `Application number: #${result.application_id}`;
      document.getElementById('applicationPhone').textContent = phone;
      success.hidden = false;
      success.focus();
    } catch (error) { message.textContent = error.message || 'The application could not be sent.'; }
    finally { button.disabled = false; }
  });
})();
