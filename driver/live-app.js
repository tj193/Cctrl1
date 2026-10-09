(() => {
  'use strict';
  if (new URLSearchParams(location.search).get('demo') === '1') return;
  const page = document.body.dataset.page;
  const main = document.getElementById('pageContent');
  const session = window.DarbDriverSession;
  const pages = [
    ['dashboard', 'Dashboard', 'driver_dashboard.html'], ['routes', 'My Routes', 'my_routes.html'],
    ['create', 'Create Route', 'create_route.html'], ['requests', 'Student Requests', 'student_requests.html'],
    ['students', 'My Students', 'my_students.html'], ['reports', 'Reports & Support', 'reports.html'],
    ['profile', 'Profile', 'profile.html'], ['opportunities', 'Opportunities', 'opportunities.html'],
  ];
  const node = (tag, className, value) => {
    const item = document.createElement(tag);
    if (className) item.className = className;
    if (value != null) item.textContent = value;
    return item;
  };
  const panel = (title) => { const item = node('section', 'panel'); item.append(node('h2', '', title)); return item; };
  const message = (parent, text, error = false) => {
    const item = node('p', error ? 'error' : 'support-note', text);
    item.setAttribute('role', error ? 'alert' : 'status');
    parent.append(item);
    return item;
  };
  const money = value => value == null ? 'Price unavailable' : `${Number(value).toLocaleString()} IQD`;
  const time = value => value ? String(value).slice(0, 5) : 'Not set';
  async function request(path, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${session.token}`);
    if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    let response;
    try { response = await fetch(`${session.apiBase}${path}`, { ...options, headers }); }
    catch { throw new Error('Could not reach the DarbGo API. Check your connection.'); }
    if (response.status === 401 || response.status === 403) {
      sessionStorage.removeItem('driverToken');
      location.href = '../login.html?role=driver';
      throw new Error('Driver session expired or access was denied.');
    }
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(typeof body.detail === 'string' ? body.detail : `Request failed (${response.status}).`);
    }
    return response.status === 204 ? null : response.json();
  }
  async function publicCatalogue(path) {
    const response = await fetch(`${session.apiBase}/public/catalogue/${path}`);
    if (!response.ok) throw new Error('Location catalogue is unavailable.');
    return response.json();
  }
  function start(title, description) {
    main.replaceChildren();
    const head = node('div', 'page-head');
    const text = node('div');
    text.append(node('p', 'eyebrow', 'DRIVER SPACE'), node('h1', '', title), node('p', '', description));
    head.append(text);
    main.append(head);
  }
  function routeCard(route, editable = false) {
    const card = node('article', 'panel');
    card.append(node('h2', '', `${route.origin_area} → ${route.destination_university}`),
                node('p', '', `Status: ${route.status} · Driver: ${route.driver_name}`),
                node('p', '', `Departure ${time(route.departure_time)} · Return ${time(route.return_time)}`),
                node('p', '', `${money(route.price_iqd)} · ${route.occupied_seats}/${route.capacity} seats occupied · ${route.available_seats} available`));
    if (editable) {
      const edit = node('button', 'button-secondary', 'Update capacity and price');
      edit.type = 'button';
      edit.onclick = () => {
        const form = node('form', 'field');
        const capacity = node('input'); capacity.type = 'number'; capacity.min = String(Math.max(1, route.occupied_seats)); capacity.value = String(route.capacity); capacity.required = true;
        const price = node('input'); price.type = 'number'; price.min = '0'; price.value = String(route.price_iqd ?? 0); price.required = true;
        const submit = node('button', 'button', 'Save'); submit.type = 'submit';
        for (const [label, input] of [['Capacity', capacity], ['Price in IQD', price]]) {
          const field = node('label', 'field', label); field.append(input); form.append(field);
        }
        form.append(submit);
        form.onsubmit = async event => {
          event.preventDefault(); submit.disabled = true;
          try {
            await request(`/driver/routes/${route.id}`, { method: 'PATCH', body: JSON.stringify({
              capacity: Number(capacity.value), price_iqd: Number(price.value)
            }) });
            await renderRoutes();
          } catch (error) { message(card, error.message, true); submit.disabled = false; }
        };
        card.append(form); edit.remove();
      };
      const disable = node('button', 'button-secondary', 'Disable route');
      disable.type = 'button'; disable.disabled = route.status === 'Disabled';
      disable.onclick = async () => {
        if (!confirm('Disable this route for new requests?')) return;
        disable.disabled = true;
        try { await request(`/driver/routes/${route.id}/disable`, { method: 'PATCH' }); await renderRoutes(); }
        catch (error) { message(card, error.message, true); disable.disabled = false; }
      };
      card.append(edit, disable);
    }
    return card;
  }
  async function renderDashboard() {
    start('Driver dashboard', 'Your current routes and incoming requests.');
    const [routes, requests] = await Promise.all([request('/driver/routes'), request('/driver/ride-requests')]);
    const stats = panel('Overview');
    stats.append(node('p', '', `${routes.length} routes · ${requests.filter(row => row.status === 'Pending').length} pending requests`),
                 node('p', '', `${routes.reduce((sum, row) => sum + row.occupied_seats, 0)} occupied seats`));
    main.append(stats);
    if (!routes.length) message(main, 'No routes yet. Create a route to start receiving requests.');
    routes.slice(0, 3).forEach(route => main.append(routeCard(route)));
  }
  async function renderRoutes() {
    start('My routes', 'Only routes owned by your approved Driver account appear here.');
    const routes = await request('/driver/routes');
    if (!routes.length) message(main, 'You have not created a route yet.');
    routes.forEach(route => main.append(routeCard(route, true)));
  }
  async function renderCreate() {
    start('Create route', 'Choose canonical areas and universities from the current catalogue.');
    const [areas, universities] = await Promise.all([publicCatalogue('areas'), publicCatalogue('universities')]);
    const form = node('form', 'panel');
    const controls = {};
    for (const [key, label, type] of [
      ['from_area_id', 'Starting area', 'select'], ['to_university_id', 'Destination university', 'select'],
      ['departure_time', 'Departure time', 'time'], ['return_time', 'Return time', 'time'],
      ['capacity', 'Capacity', 'number'], ['price_iqd', 'Price in IQD', 'number'],
    ]) {
      const wrapper = node('label', 'field', label);
      const input = node(type === 'select' ? 'select' : 'input');
      if (type !== 'select') input.type = type;
      input.required = true;
      if (type === 'number') input.min = key === 'capacity' ? '1' : '0';
      if (key === 'from_area_id') {
        input.append(new Option('Choose an area', ''));
        areas.forEach(row => input.add(new Option(`${row.name} · ${row.governorate}`, String(row.id))));
      }
      if (key === 'to_university_id') {
        input.append(new Option('Choose a university', ''));
        universities.forEach(row => input.add(new Option(`${row.name} · ${row.governorate || ''}`, String(row.id))));
      }
      controls[key] = input; wrapper.append(input); form.append(wrapper);
    }
    const submit = node('button', 'button', 'Create route'); submit.type = 'submit'; form.append(submit);
    form.onsubmit = async event => {
      event.preventDefault(); submit.disabled = true;
      try {
        const payload = Object.fromEntries(Object.entries(controls).map(([key, input]) => [key,
          ['from_area_id', 'to_university_id', 'capacity', 'price_iqd'].includes(key) ? Number(input.value) : input.value]));
        await request('/driver/routes', { method: 'POST', body: JSON.stringify(payload) });
        location.href = 'my_routes.html';
      } catch (error) { message(form, error.message, true); submit.disabled = false; }
    };
    main.append(form);
  }
  async function renderRequests() {
    start('Student requests', 'Accepting a request reserves a seat. Pending requests do not.');
    const requests = await request('/driver/ride-requests');
    const routes = await request('/driver/routes');
    if (!requests.length) message(main, 'No incoming requests yet.');
    for (const item of requests) {
      const route = routes.find(row => row.id === item.route_id);
      const card = panel(`${item.student_name} · ${item.status}`);
      card.append(node('p', '', route ? `${route.origin_area} → ${route.destination_university}` : `Route ${item.route_id}`));
      if (item.status === 'Pending') for (const decision of ['accept', 'decline']) {
        const button = node('button', decision === 'accept' ? 'button' : 'button-secondary',
                            decision === 'accept' ? 'Accept and reserve seat' : 'Decline');
        button.type = 'button';
        button.onclick = async () => {
          button.disabled = true;
          try { await request(`/driver/ride-requests/${item.id}/${decision}`, { method: 'POST' }); await renderRequests(); }
          catch (error) { message(card, error.message, true); button.disabled = false; }
        };
        card.append(button);
      }
      main.append(card);
    }
  }
  async function renderStudents() {
    start('My students', 'Active enrollments on your routes.');
    const routes = await request('/driver/routes');
    if (!routes.length) message(main, 'No routes yet.');
    for (const route of routes) {
      const card = panel(`${route.origin_area} → ${route.destination_university}`);
      const enrollment = await request(`/driver/routes/${route.id}/enrollments`);
      card.append(node('p', '', `${enrollment.occupied_seats}/${enrollment.capacity} seats occupied`));
      if (!enrollment.students.length) message(card, 'No accepted students yet.');
      enrollment.students.forEach(student => card.append(node('p', '', student.student_name)));
      main.append(card);
    }
  }
  async function renderReports() {
    start('Reports & Support', 'Your reports are visible to you and authorized Admins.');
    const form = node('form', 'panel');
    const type = node('select');
    type.required = true;
    [['', 'Choose type'], ['student', 'Student'], ['route', 'Route'], ['service', 'Service'], ['account', 'Account'], ['other', 'Other']]
      .forEach(([value, label]) => type.add(new Option(label, value)));
    const subject = node('input'); subject.required = true; subject.minLength = 4; subject.maxLength = 120;
    const description = node('textarea'); description.required = true; description.minLength = 15; description.maxLength = 4000;
    const submit = node('button', 'button', 'Submit report'); submit.type = 'submit';
    for (const [label, input] of [['Type', type], ['Subject', subject], ['Description', description]]) {
      const wrapper = node('label', 'field', label); wrapper.append(input); form.append(wrapper);
    }
    form.append(submit); main.append(form);
    form.onsubmit = async event => {
      event.preventDefault(); submit.disabled = true;
      try {
        await request('/driver/reports', { method: 'POST', body: JSON.stringify({
          type: type.value, subject: subject.value.trim(), description: description.value.trim()
        }) });
        await renderReports();
      } catch (error) { message(form, error.message, true); submit.disabled = false; }
    };
    const reports = await request('/driver/reports');
    if (!reports.length) message(main, 'No reports yet.');
    reports.forEach(report => {
      const card = panel(report.subject);
      card.append(node('p', '', `Status: ${report.status}`), node('p', '', report.description || ''));
      if (report.public_resolution) card.append(node('p', '', `Public resolution: ${report.public_resolution}`));
      main.append(card);
    });
  }
  function renderProfile(profile) {
    start('Driver profile', 'Your approved Driver account.');
    const card = panel('Account');
    card.append(node('p', '', `Name: ${profile.name}`), node('p', '', `Email: ${profile.email}`),
                node('p', '', `Approval: ${profile.status}`));
    message(card, 'Profile editing is not yet supported by the Driver API.');
    main.append(card);
  }
  async function boot() {
    const nav = document.getElementById('nav');
    pages.forEach(([key, label, file]) => {
      const link = node('a', '', label); link.href = file;
      if (key === page) link.setAttribute('aria-current', 'page');
      nav.append(link);
    });
    const logout = node('button', 'logout', 'Log out');
    logout.type = 'button';
    logout.onclick = () => {
      sessionStorage.removeItem('driverToken');
      location.href = '../login.html?role=driver';
    };
    nav.append(logout);
    const menu = document.getElementById('menuButton');
    menu.onclick = () => {
      const open = !document.getElementById('driverSidebar').classList.contains('is-open');
      document.getElementById('driverSidebar').classList.toggle('is-open', open);
      document.getElementById('backdrop').hidden = !open;
      menu.setAttribute('aria-expanded', String(open));
    };
    document.getElementById('backdrop').onclick = () => menu.click();
    document.getElementById('pageTitle').textContent = pages.find(row => row[0] === page)?.[1] || 'Driver';
    try {
      const profile = await session.ready;
      document.getElementById('identity').textContent = profile.name;
      if (page === 'dashboard') await renderDashboard();
      else if (page === 'routes') await renderRoutes();
      else if (page === 'create') await renderCreate();
      else if (page === 'requests') await renderRequests();
      else if (page === 'students') await renderStudents();
      else if (page === 'reports') await renderReports();
      else if (page === 'profile') renderProfile(profile);
      else {
        start('Opportunities', 'Aggregated route demand is not available to Drivers yet.');
        message(main, 'This view will be enabled when a Driver demand API is available.');
      }
    } catch (error) { main.replaceChildren(); message(main, error.message || 'Could not load Driver data.', true); }
  }
  boot();
})();
