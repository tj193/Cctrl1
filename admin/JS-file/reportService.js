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
    detail: id => response(`/admin/reports/${encodeURIComponent(id)}`, { headers: headers() }),
    review: (id, status, publicResolution, internalNotes) => response(`/admin/reports/${encodeURIComponent(id)}/review`, {
      method: 'PATCH', headers: { ...headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: status[0].toUpperCase() + status.slice(1),
        public_resolution: publicResolution, internal_notes: internalNotes }),
    }),
  };
})();
