(() => {
  'use strict';
  const api = window.DarbStudentApi;
  const prefix = 'darbgoDemoStudentReports:';
  const accountKey = account => String(account.id || account.email || '').trim().toLowerCase();
  const keyFor = account => {
    const key = accountKey(account);
    if (!key) throw new Error('Sign in again to use demo reports.');
    return prefix + key;
  };
  const read = account => {
    const reports = JSON.parse(sessionStorage.getItem(keyFor(account)) || '[]');
    if (!Array.isArray(reports)) throw new Error('Demo reports could not be loaded.');
    return reports;
  };
  window.DarbStudentReports = {
    mode: api.demo ? 'demo' : 'live',
    async list(account) { return api.demo ? read(account) : api.request('/student/reports'); },
    async detail(account, id) { return api.demo ? read(account).find(report => report.id === id) || null
      : api.request(`/student/reports/${encodeURIComponent(id)}`); },
    async create(account, input) {
      if (!api.demo) return api.request('/student/reports', { method: 'POST', body: JSON.stringify(input) });
      const reports = read(account);
      const report = {
        id: `DEMO-${crypto.randomUUID()}`,
        type: input.type,
        subject: input.subject,
        description: input.description,
        created_at: new Date().toISOString(),
        status: 'Pending',
      };
      sessionStorage.setItem(keyFor(account), JSON.stringify([report, ...reports]));
      return report;
    },
  };
})();
