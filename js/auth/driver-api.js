(() => {
  'use strict';
  const baseUrl = ['localhost', '127.0.0.1'].includes(window.location.hostname)
    ? `http://${window.location.hostname}:8000` : window.location.origin;

  async function request(path, options) {
    let response;
    try { response = await fetch(`${baseUrl}${path}`, options); }
    catch { throw new Error('Driver service is unavailable. Please try again later.'); }
    let data;
    try { data = await response.json(); } catch { data = {}; }
    if (!response.ok) {
      const detail = data.detail;
      throw new Error(typeof detail === 'string' ? detail : 'The request could not be completed. Check your details.');
    }
    return data;
  }

  window.DarbDriverApi = {
    submit(application) {
      return request('/auth/driver-applications', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(application)
      });
    },
    async login(identifier, password) {
      const body = new URLSearchParams({ username: identifier.trim(), password });
      return request('/auth/driver-login', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body
      });
    }
  };
})();
