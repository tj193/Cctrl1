(() => {
  'use strict';
  window.logout = window.DarbAccounts.logout;
  const expectedRole = document.body.dataset.role;
  let user;
  try { user = JSON.parse(sessionStorage.getItem('loggedInUser') || 'null'); } catch { user = null; }
  if (!user || user.role !== expectedRole) { window.location.replace(window.DarbAccounts.loginUrl); return; }
  const welcome = document.querySelector('.dashboard > p');
  welcome.textContent = `Welcome, ${user.fullName}. This is your local demo account.`;
  if (user.role === 'student') {
    const details = document.createElement('dl');
    for (const [label, value] of [['Governorate', user.governorate], ['Home area', user.homeArea], ['University', user.university], ['Arrival time', user.arrivalTime]]) {
      const term = document.createElement('dt'); term.textContent = label;
      const description = document.createElement('dd'); description.textContent = value || 'Not provided';
      details.append(term, description);
    }
    welcome.after(details);
  }
})();
