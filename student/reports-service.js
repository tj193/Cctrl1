(() => {
  'use strict';
  // The student account store is a browser-only demo. Never send these reports to an admin API.
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
    mode: 'demo',
    async list(account) { return read(account); },
    async detail(account, id) { return read(account).find(report => report.id === id) || null; },
    async create(account, input) {
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
