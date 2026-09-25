(() => {
  'use strict';
  const loginUrl = '../login.html?role=driver';
  const token = sessionStorage.getItem('driverToken');
  if (!token) {
    window.location.replace(loginUrl);
    return;
  }
  const apiBase = ['localhost', '127.0.0.1'].includes(window.location.hostname)
    ? `http://${window.location.hostname}:8000` : window.location.origin;
  fetch(`${apiBase}/auth/driver-me`, { headers: { Authorization: `Bearer ${token}` } })
    .then(async response => {
      if (!response.ok) throw new Error('Driver session expired');
      const profile = await response.json();
      const welcome = document.getElementById('driverWelcome');
      if (welcome) welcome.textContent = `Welcome, ${profile.name}`;
    })
    .catch(() => {
      sessionStorage.removeItem('driverToken');
      window.location.replace(loginUrl);
    });
  document.querySelectorAll('.logout').forEach(link => {
    link.href = loginUrl;
    link.addEventListener('click', () => sessionStorage.removeItem('driverToken'));
  });
})();
