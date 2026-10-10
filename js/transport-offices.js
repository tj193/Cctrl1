(() => {
  const header = document.getElementById('site-header');
  const nav = document.getElementById('navigation');
  const menu = document.querySelector('.menu');
  const close = () => { nav.classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); };
  const updateHeader = () => header.classList.toggle('nav-scrolled', window.scrollY > 12);
  updateHeader();
  window.addEventListener('scroll', updateHeader, { passive: true });
  menu.addEventListener('click', () => {
    const open = !nav.classList.contains('open');
    nav.classList.toggle('open', open);
    menu.setAttribute('aria-expanded', String(open));
  });
  nav.addEventListener('click', close);
  document.addEventListener('click', event => { if (!nav.contains(event.target) && !menu.contains(event.target)) close(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
})();
