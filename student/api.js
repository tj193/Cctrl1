(() => {
  'use strict';
  const base = ['localhost', '127.0.0.1'].includes(location.hostname)
    ? `http://${location.hostname}:8001` : location.origin;
  const demo = new URLSearchParams(location.search).get('demo') === '1';
  const token = () => sessionStorage.getItem('studentToken');
  const logout = () => {
    sessionStorage.removeItem('studentToken');
    sessionStorage.removeItem('loggedInUser');
    location.href = '../login.html';
  };
  async function request(path, options = {}) {
    if (!token()) { logout(); throw new Error('Sign in to continue.'); }
    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${token()}`);
    if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type'))
      headers.set('Content-Type', 'application/json');
    let response;
    try { response = await fetch(`${base}${path}`, { ...options, headers }); }
    catch { throw new Error('Could not reach the DarbGo API. Check your connection and try again.'); }
    if (response.status === 401) { logout(); throw new Error('Your session expired. Sign in again.'); }
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(typeof body.detail === 'string' ? body.detail : `Request failed (${response.status}).`);
    }
    return response.status === 204 ? null : response.json();
  }
  window.DarbStudentApi = { request, token, logout, demo };
})();
