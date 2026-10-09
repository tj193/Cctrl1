(() => {
  'use strict';
  const loginUrl = '../login.html?role=driver';
  const token = sessionStorage.getItem('driverToken');
  if (!token) {
    location.replace(loginUrl);
    return;
  }
  const apiBase = ['localhost', '127.0.0.1'].includes(location.hostname)
    ? `http://${location.hostname}:8001` : location.origin;
  window.DarbDriverSession = { token, apiBase, profile: null };
  window.DarbDriverSession.ready = fetch(`${apiBase}/auth/driver-me`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(async response => {
    if (response.status === 401 || response.status === 403) {
      sessionStorage.removeItem('driverToken');
      location.replace(loginUrl);
      throw new Error('Driver session expired.');
    }
    if (!response.ok) throw new Error(`Profile could not be loaded (${response.status}).`);
    const profile = await response.json();
    window.DarbDriverSession.profile = profile;
    return profile;
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('.logout')) return;
    sessionStorage.removeItem('driverToken');
    sessionStorage.removeItem('darbgoDriverDemo');
  });
})();
