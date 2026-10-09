(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  let account;
  try { account = JSON.parse(sessionStorage.getItem('loggedInUser') || 'null'); } catch { account = null; }
  const api = window.DarbStudentApi;
  if (api.demo ? (!account || account.role !== 'student') : !api.token()) { location.replace(window.DarbAccounts.loginUrl); return; }
  const service = window.DarbStudentReports;
  const statusLabel = { pending: 'Pending', investigating: 'Investigating', resolved: 'Resolved', dismissed: 'Dismissed' };
  const label = value => statusLabel[String(value || '').toLowerCase()] || 'Unknown';
  const date = value => value ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(value)) : 'Not available';
  const message = (value, error = false) => { $('reportFeedback').textContent = value; $('reportFeedback').dataset.error = String(error); };
  $('profileName').textContent = account?.fullName || 'Student';
  $('logoutButton').onclick = api.demo ? window.DarbAccounts.logout : api.logout;
  $('profileButton').onclick = () => { $('profilePopover').hidden = !$('profilePopover').hidden; };
  $('profilePopoverName').textContent = account?.fullName || 'Student';
  $('profilePopoverEmail').textContent = account?.email || '';
  const sidebar = open => {
    $('studentSidebar').classList.toggle('is-open', open);
    $('sidebarBackdrop').hidden = !open;
    $('sidebarToggle').setAttribute('aria-expanded', String(open));
  };
  $('sidebarToggle').onclick = () => sidebar($('sidebarToggle').getAttribute('aria-expanded') !== 'true');
  $('sidebarBackdrop').onclick = () => sidebar(false);
  document.addEventListener('keydown', event => { if (event.key === 'Escape') sidebar(false); });
  $('closeReportDetails').onclick = () => $('reportDetails').close();

  async function load() {
    $('reportsList').textContent = 'Loading reports…';
    try {
      const reports = await service.list(account);
      $('reportsList').replaceChildren();
      if (!reports.length) { $('reportsList').textContent = 'No reports yet.'; return; }
      for (const report of reports) {
        const article = document.createElement('article');
        article.className = 'support-report-card';
        const heading = document.createElement('h3'); heading.textContent = report.subject;
        const meta = document.createElement('p'); meta.textContent = `${report.id} · ${date(report.created_at)}`;
        const badge = document.createElement('span'); badge.className = 'status-badge'; badge.textContent = label(report.status);
        const button = document.createElement('button'); button.type = 'button'; button.className = 'secondary-action'; button.textContent = 'View details';
        button.onclick = () => openDetails(report.id);
        article.append(heading, meta, badge, button);
        $('reportsList').append(article);
      }
    } catch (error) { $('reportsList').textContent = error.message || 'Could not load reports.'; }
  }

  async function openDetails(id) {
    $('reportDetailsContent').textContent = 'Loading details…';
    $('reportDetails').showModal();
    try {
      const report = await service.detail(account, id);
      if (!report) throw new Error('Report is unavailable for this account.');
      const content = $('reportDetailsContent'); content.replaceChildren();
      for (const [title, value] of Object.entries({ Reference: report.id, Type: report.type, Subject: report.subject, Description: report.description, Submitted: date(report.created_at), Status: label(report.status) })) {
        const row = document.createElement('p');
        const strong = document.createElement('strong'); strong.textContent = `${title}: `;
        row.append(strong, document.createTextNode(value || 'Not available')); content.append(row);
      }
      if (report.public_resolution) {
        const row = document.createElement('p'); row.textContent = `Resolution: ${report.public_resolution}`; content.append(row);
      }
      if (Array.isArray(report.status_history) && report.status_history.length) {
        const heading = document.createElement('h3'); heading.textContent = 'Status history'; content.append(heading);
        for (const entry of report.status_history) { const row = document.createElement('p'); row.textContent = `${date(entry.created_at)} · ${label(entry.status)}`; content.append(row); }
      }
    } catch (error) { $('reportDetailsContent').textContent = error.message || 'Could not load details.'; }
  }

  $('createReportForm').onsubmit = async event => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const input = {
      type: $('reportType').value,
      subject: $('reportSubject').value.trim(),
      description: $('reportDescription').value.trim(),
    };
    if (!input.type || input.subject.length < 5 || input.description.length < 20) { message('Enter a type, a subject of at least 5 characters, and a description of at least 20 characters.', true); return; }
    $('submitReport').disabled = true; message('Submitting report…');
    try {
      const report = await service.create(account, input);
      form.reset(); message(api.demo ? `Demo report ${report.id} saved in this browser session.` : `Report ${report.id} submitted.`);
      await load();
    } catch (error) { message(error.message || 'Could not save demo report.', true); }
    finally { $('submitReport').disabled = false; }
  };
  if (api.demo) load();
  else api.request('/student/profile').then(profile => {
    account = { fullName: profile.name, email: profile.email, role: 'student' };
    $('profileName').textContent = profile.name;
    $('profilePopoverName').textContent = profile.name;
    $('profilePopoverEmail').textContent = profile.email;
    document.querySelector('.support-demo-note')?.remove();
    $('submitReport').textContent = 'Submit report';
    return load();
  }).catch(error => { $('reportsList').textContent = error.message || 'Could not load your profile.'; });
})();
