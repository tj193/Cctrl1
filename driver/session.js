(() => {
  'use strict';
  const token = sessionStorage.getItem('driverToken');
  const loginUrl = '../login.html?role=driver';
  if (!token) { window.location.replace(loginUrl); return; }

  const baseUrl = ['localhost', '127.0.0.1'].includes(window.location.hostname)
    ? `http://${window.location.hostname}:8000` : window.location.origin;
  fetch(`${baseUrl}/auth/driver-me`, { headers: { Authorization: `Bearer ${token}` } })
    .then(async response => {
      if (!response.ok) throw new Error('Driver session expired');
      const driver = await response.json();
      const welcome = document.getElementById('driverWelcome');
      if (welcome) welcome.textContent = `Welcome, ${driver.name}`;
    })
    .catch(() => {
      sessionStorage.removeItem('driverToken');
      window.location.replace(loginUrl);
    });

  document.addEventListener('DOMContentLoaded', () => {
    const logout = document.querySelector('.logout');
    if (logout) logout.addEventListener('click', () => sessionStorage.removeItem('driverToken'));
  });
})();
