(() => {
  'use strict';
  const api = () => window.DarbGoAdminApi;
  const token = () => sessionStorage.getItem('adminToken');
  const headers = () => ({ Authorization: `Bearer ${token()}` });
  async function response(path, options = {}) {
    const result = await api().fetchResponse(`${api().baseUrl}${path}`, options);
    if (!result.ok) {
      const body = await result.json().catch(() => ({}));
      throw new Error(typeof body.detail === 'string' ? body.detail : `Request failed (${result.status}).`);
    }
    return result.json();
  }
  window.DarbAdminReports = {
    list: () => response('/admin/reports', { headers: headers() }),
    updateStatus: (id, status, notes) => response(`/admin/reports/${encodeURIComponent(id)}/status`, {
      method: 'PATCH', headers: { ...headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, notes }),
    }),
  };
})();
