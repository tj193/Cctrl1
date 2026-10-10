(() => {
  'use strict';
  const demo = new URLSearchParams(location.search).get('demo') === '1';
  const pages = [
    ['Dashboard', 'driver_dashboard.html'], ['My Routes', 'my_routes.html'],
    ['Create Route', 'create_route.html'], ['Opportunities', 'opportunities.html'],
    ['Student Requests', 'student_requests.html'], ['My Students', 'my_students.html'],
    ['Reports & Support', 'reports.html'], ['Plans & Pricing', 'pricing.html'], ['Profile', 'profile.html'],
  ];
  const nav = document.getElementById('nav');
  pages.forEach(([label, file]) => {
    const link = document.createElement('a');
    link.href = `${file}${demo ? '?demo=1' : ''}`;
    link.textContent = label;
    if (file === 'pricing.html') link.setAttribute('aria-current', 'page');
    nav.append(link);
  });
  const logout = document.createElement('a');
  logout.href = '../login.html?role=driver';
  logout.className = 'logout';
  logout.textContent = 'Log out';
  nav.append(logout);
  const sidebar = document.getElementById('driverSidebar');
  const backdrop = document.getElementById('backdrop');
  const menu = document.getElementById('menuButton');
  const close = () => { sidebar.classList.remove('open'); backdrop.hidden = true; menu.setAttribute('aria-expanded', 'false'); };
  menu.addEventListener('click', () => {
    const open = !sidebar.classList.contains('open');
    sidebar.classList.toggle('open', open);
    backdrop.hidden = !open;
    menu.setAttribute('aria-expanded', String(open));
  });
  backdrop.addEventListener('click', close);
  nav.addEventListener('click', event => { if (event.target.closest('a')) close(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
  window.DarbDriverSession?.ready.then(profile => {
    document.getElementById('identity').textContent = profile.name || 'Driver';
  }).catch(() => {
    document.getElementById('identity').textContent = 'Driver';
  });
  const price = document.getElementById('proPrice');
  const period = document.getElementById('proPeriod');
  const note = document.getElementById('priceNote');
  document.querySelectorAll('[data-period]').forEach(button => button.addEventListener('click', () => {
    const yearly = button.dataset.period === 'yearly';
    document.querySelectorAll('[data-period]').forEach(option => {
      const selected = option === button;
      option.classList.toggle('selected', selected);
      option.setAttribute('aria-pressed', String(selected));
    });
    price.textContent = yearly ? '240,000 IQD' : '25,000 IQD';
    period.textContent = yearly ? '/ year' : '/ month';
    note.textContent = yearly ? 'Illustrative annual price.' : 'Proposed monthly price.';
  }));
})();
