(() => {
  'use strict';
  const api = window.DarbStudentApi;
  if (api.demo) return;

  const page = document.body.dataset.page || 'journey';
  const main = document.getElementById('mainContent');
  const $ = id => document.getElementById(id);
  const state = { profile: null, areas: [], universities: [], routes: [], requests: [], demands: [] };
  const sections = { journey: ['journey', 'journeyProgressSection'], routes: ['routeSearch'], requests: ['requests'], waitlist: ['waitlist'], upcoming: ['upcomingRide'] };
  const text = (id, value) => { if ($(id)) $(id).textContent = value; };
  const element = (tag, className, value) => {
    const item = document.createElement(tag);
    if (className) item.className = className;
    if (value != null) item.textContent = value;
    return item;
  };
  const line = (parent, label, value) => {
    const item = element('div');
    item.append(element('span', '', label), element('strong', '', value));
    parent.append(item);
  };
  const message = (parent, value, error = false) => {
    const item = element('p', error ? 'auth-message' : 'action-note', value);
    item.setAttribute('role', error ? 'alert' : 'status');
    parent.append(item);
    return item;
  };
  const formattedTime = value => {
    if (!value) return 'Not set';
    const [hours, minutes] = String(value).slice(0, 5).split(':').map(Number);
    return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`;
  };
  const shortTime = value => value ? String(value).slice(0, 5) : 'Not set';
  const price = value => value == null ? 'Price unavailable' : `${Number(value).toLocaleString()} IQD`;
  const date = value => value ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(value)) : 'Not available';
  const areaName = id => state.areas.find(item => item.id === id)?.name || 'Area not set';
  const universityName = id => state.universities.find(item => item.id === id)?.name || 'University not set';
  const choices = (select, rows, id) => {
    select.replaceChildren(new Option('Choose an option', ''));
    rows.forEach(item => select.add(new Option(item.name, String(item.id))));
    if (id != null) select.value = String(id);
    select.required = true;
  };
  const existingRequest = routeId => state.requests.find(item => item.route_id === routeId && ['Pending', 'Accepted'].includes(item.status));
  const alternativeRoutes = (routes, originalId) => {
    const rejected = new Set(state.requests.filter(item => item.status === 'Declined').map(item => item.route_id));
    return routes.filter(route => route.id !== originalId && !rejected.has(route.id) &&
      !existingRequest(route.id) && route.from_area_id === state.profile.area_id &&
      route.to_university_id === state.profile.university_id &&
      route.status === 'Active' && route.available_seats > 0)
      .sort((a, b) => String(a.departure_time || '').localeCompare(String(b.departure_time || '')));
  };

  function showToast(value) {
    const toast = $('toast');
    toast.textContent = value;
    toast.hidden = false;
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => { toast.hidden = true; }, 3500);
  }

  function loadView() {
    const template = document.createElement('template');
    template.innerHTML = window.DarbStudentViews;
    main.replaceChildren();
    for (const id of sections[page] || sections.journey) main.append(template.content.querySelector(`#${id}`));
    document.title = `${{ journey: 'Your journey', routes: 'Routes', requests: 'My requests', waitlist: 'Waitlist', upcoming: 'Upcoming ride' }[page]} — DarbGo`;
  }

  function bindProfile() {
    const profile = state.profile;
    const name = (profile.name || 'Student').trim();
    const first = name.split(/\s+/)[0];
    text('profileName', first);
    text('profileInitial', first[0].toUpperCase());
    text('profilePopoverName', name);
    text('profilePopoverEmail', profile.email || '');
    text('studentFirstName', first);
    text('sceneStudentInitial', first[0].toUpperCase());
    for (const id of ['homeArea', 'sceneHomeArea', 'preferenceArea', 'progressHome']) text(id, areaName(profile.area_id));
    for (const id of ['university', 'sceneUniversity', 'preferenceUniversity']) text(id, universityName(profile.university_id));
    for (const id of ['arrivalTime', 'sceneArrivalTime', 'preferenceTime']) text(id, formattedTime(profile.preferred_arrival_time));
    if (page === 'journey') {
      const hour = new Date().getHours();
      $('journey').querySelector('.hero-copy h1').firstChild.textContent = `${hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'}, `;
      text('dayLabel', new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()).toUpperCase());
    }
  }

  function initMap() {
    const container = $('sceneMap');
    if (!container) return;
    container.replaceChildren();
    container.setAttribute('aria-label', 'Map preview. A route path is not available.');
    container.closest('.journey-scene').setAttribute('aria-label', 'Map preview and saved journey details. Geographic route data is unavailable.');
    if (window.L) {
      const map = L.map(container, { zoomControl: true, scrollWheelZoom: false }).setView([33.3152, 44.3661], 6);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18, attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);
      setTimeout(() => map.invalidateSize(), 0);
    } else {
      container.append(element('p', 'map-unavailable', 'Map preview unavailable'));
    }
    text('sceneStatus', 'Route path unavailable');
    text('actionNote', 'Search uses your saved area and university. Map route details are not available yet.');
  }

  function renderProgress() {
    const accepted = state.requests.some(item => item.status === 'Accepted');
    const pending = state.requests.some(item => item.status === 'Pending');
    const stage = accepted ? 3 : pending ? 2 : 1;
    const items = [...$('journeyProgress').children];
    items.forEach((item, index) => {
      item.classList.toggle('is-complete', index < stage);
      item.classList.toggle('is-active', index === stage);
    });
    text('progressSearch', 'Find available routes');
    text('progressRequest', accepted ? 'Driver accepted' : pending ? 'Awaiting driver decision' : 'No active request');
    text('progressConfirmed', accepted ? 'Seat reserved' : 'No seat reserved');
    text('progressSummary', accepted ? 'Your driver accepted a request. A seat is reserved.' : pending ? 'Your request is awaiting the driver. No seat is reserved yet.' : 'Your details are saved. Search when you are ready.');
  }

  function preferenceForm() {
    const panel = element('section', 'dashboard-section profile-preferences');
    panel.id = 'profilePreferences';
    panel.hidden = true;
    panel.append(element('p', 'eyebrow-label', 'SAVED JOURNEY'), element('h2', '', 'Journey details'));
    const form = element('form', 'preferences-form');
    const area = element('select');
    const university = element('select');
    const arrival = element('input');
    arrival.type = 'time';
    choices(area, state.areas, state.profile.area_id);
    choices(university, state.universities, state.profile.university_id);
    arrival.value = shortTime(state.profile.preferred_arrival_time) === 'Not set' ? '' : shortTime(state.profile.preferred_arrival_time);
    for (const [label, control] of [['Home area', area], ['University', university], ['Preferred arrival', arrival]]) {
      const field = element('label', 'field', label);
      field.append(control);
      form.append(field);
    }
    const save = element('button', 'primary-action', 'Save journey details');
    save.type = 'submit';
    form.append(save);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      save.disabled = true;
      panel.querySelector('[role=alert]')?.remove();
      try {
        state.profile = await api.request('/student/profile', { method: 'PUT', body: JSON.stringify({
          area_id: Number(area.value), university_id: Number(university.value), preferred_arrival_time: arrival.value || null
        }) });
        bindProfile();
        showToast('Journey details saved.');
        panel.hidden = true;
      } catch (error) { message(panel, error.message || 'Could not save journey details.', true); }
      finally { save.disabled = false; }
    });
    panel.append(form);
    main.insertBefore(panel, $('journeyProgressSection'));
    $('editJourneyButton').onclick = () => {
      panel.hidden = !panel.hidden;
      if (!panel.hidden) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
  }

  async function renderJourney() {
    bindProfile();
    initMap();
    preferenceForm();
    $('findRouteButton').onclick = () => { location.href = 'routes.html?search=1'; };
    try {
      state.requests = await api.request('/student/ride-requests');
      renderProgress();
    } catch (error) { message($('journeyProgressSection'), error.message, true); }
  }

  function routeCard(route) {
    const card = element('article', 'route-card');
    const top = element('div', 'route-card-top');
    top.append(element('span', 'seat-pill', `${route.available_seats} ${route.available_seats === 1 ? 'seat' : 'seats'} available`));
    card.append(top, element('h3', 'route-path-title', `${route.origin_area} → ${route.destination_university}`),
      element('p', 'route-pickup', `Leaves ${formattedTime(route.departure_time)} · Returns ${formattedTime(route.return_time)}`));
    const driver = element('div', 'route-driver');
    const name = route.driver_name || 'Driver';
    const copy = element('div', 'driver-copy');
    copy.append(element('strong', '', name), element('span', '', 'Driver'));
    driver.append(element('span', 'avatar', name[0].toUpperCase()), copy);
    card.append(driver);
    const facts = element('div', 'route-card-price');
    line(facts, 'Price', price(route.price_iqd));
    line(facts, 'Seats occupied', `${route.occupied_seats} / ${route.capacity}`);
    card.append(facts);
    const actions = element('div', 'route-card-actions');
    const details = element('button', 'details-button', 'View details');
    details.type = 'button';
    details.onclick = async () => {
      details.disabled = true;
      try {
        const current = await api.request(`/student/routes/${route.id}`);
        const content = $('routeDialogContent');
        content.className = 'dialog-content';
        content.replaceChildren();
        const heading = element('div', 'dialog-top');
        const title = element('h2', '', `${current.origin_area} → ${current.destination_university}`);
        title.id = 'dialogTitle';
        heading.append(title);
        const grid = element('div', 'detail-grid');
        for (const [label, value] of [['Driver', current.driver_name], ['Departure', formattedTime(current.departure_time)],
          ['Return', formattedTime(current.return_time)], ['Price', price(current.price_iqd)],
          ['Seats available', String(current.available_seats)], ['Status', current.status]]) line(grid, label, value);
        content.append(heading, grid);
        $('routeDialog').showModal();
      } catch (error) { message(card, error.message, true); }
      finally { details.disabled = false; }
    };
    const request = element('button', 'request-button', 'Request seat');
    request.type = 'button';
    const existing = existingRequest(route.id);
    if (existing) request.textContent = existing.status === 'Accepted' ? 'Seat reserved' : 'Request pending';
    else if (route.available_seats < 1 || route.status !== 'Active') request.textContent = 'No seats available';
    request.disabled = !!existing || route.available_seats < 1 || route.status !== 'Active';
    request.onclick = async () => {
      request.disabled = true;
      try {
        await api.request('/student/ride-requests', { method: 'POST', body: JSON.stringify({ route_id: route.id }) });
        state.requests = await api.request('/student/ride-requests');
        request.textContent = 'Request pending';
        showToast('Request sent. A seat is reserved only after the driver accepts.');
        if (page === 'requests') await renderRequests();
        else await searchRoutes();
      } catch (error) { message(card, error.message, true); request.disabled = false; }
    };
    if (route.available_seats < 1 || route.status !== 'Active') {
      const findAlternatives = element('button', 'request-button', 'Find alternatives');
      findAlternatives.type = 'button';
      findAlternatives.onclick = () => {
        card.querySelector('.alternative-results')?.remove();
        card.append(alternativesPanel(state.routes, route.id));
      };
      actions.append(details, findAlternatives);
    } else actions.append(details, request);
    card.append(actions);
    return card;
  }

  function alternativesPanel(routes, originalId, error = false) {
    const panel = element('section', 'alternative-results');
    panel.append(element('h4', '', 'Alternative routes'));
    if (error) {
      message(panel, 'Could not load alternative routes. Please try again later.', true);
      return panel;
    }
    const matches = alternativeRoutes(routes, originalId);
    if (!matches.length) {
      panel.append(element('p', 'action-note', 'No available routes match your saved pickup area and university.'));
      const waitlist = element('a', 'secondary-action', 'View waitlist / route demand');
      waitlist.href = 'waitlist.html';
      panel.append(waitlist);
      return panel;
    }
    const list = element('div', 'alternative-route-list');
    list.append(...matches.map(routeCard));
    panel.append(list);
    return panel;
  }

  function displayRoutes() {
    const minimum = Number($('seatFilter').value);
    const order = $('sortRoutes').value;
    const routes = state.routes.filter(item => item.available_seats >= minimum).sort((a, b) =>
      order === 'price' ? (a.price_iqd ?? Infinity) - (b.price_iqd ?? Infinity) :
      order === 'seats' ? b.available_seats - a.available_seats :
      String(a.departure_time || '').localeCompare(String(b.departure_time || '')));
    text('matchCount', `${routes.length} ${routes.length === 1 ? 'route' : 'routes'} available`);
    text('resultsNote', 'Live routes from the current database');
    $('routeGrid').replaceChildren(...routes.map(routeCard));
    $('searchStart').hidden = true;
    $('searchingState').hidden = true;
    $('routeResults').hidden = routes.length === 0;
    $('noRoutesState').hidden = routes.length !== 0;
    if (!routes.length) {
      $('noRoutesState').querySelector('h3').textContent = 'No routes are available for this journey.';
      $('noRoutesState').querySelector('p:not(.panel-label)').textContent = 'You can register route demand for your saved area and university.';
    }
  }

  async function searchRoutes() {
    $('searchStart').hidden = true;
    $('searchingState').hidden = false;
    $('routeResults').hidden = true;
    $('noRoutesState').hidden = true;
    try {
      const query = new URLSearchParams();
      if (state.profile.area_id) query.set('from_area_id', state.profile.area_id);
      if (state.profile.university_id) query.set('to_university_id', state.profile.university_id);
      [state.routes, state.requests] = await Promise.all([
        api.request(`/student/routes?${query}`), api.request('/student/ride-requests')
      ]);
      displayRoutes();
    } catch (error) {
      $('searchingState').hidden = true;
      $('searchStart').hidden = false;
      message($('searchStart'), error.message, true);
    }
  }

  async function renderRoutes() {
    bindProfile();
    text('preferenceArea', areaName(state.profile.area_id));
    text('preferenceUniversity', universityName(state.profile.university_id));
    text('preferenceTime', formattedTime(state.profile.preferred_arrival_time));
    $('routeSearch').querySelector('.section-intro > p').textContent = 'Compare live schedules, driver, available seats, and price.';
    $('searchStart').querySelector('p:not(.panel-label)').textContent = 'Search uses your saved area and university. Arrival time is shown for reference.';
    $('searchingState').querySelector('p:not(.panel-label)').textContent = 'Checking routes for your saved area and university.';
    $('sortRoutes').options[0].textContent = 'Departure time';
    $('sortRoutes').options[0].value = 'departure';
    $('panelFindRouteButton').onclick = searchRoutes;
    $('joinWaitlistButton').onclick = () => { location.href = 'waitlist.html'; };
    $('sortRoutes').onchange = displayRoutes;
    $('seatFilter').onchange = displayRoutes;
    if (new URLSearchParams(location.search).get('search') === '1') await searchRoutes();
  }

  function requestTimeline(status) {
    const list = element('ol', 'request-timeline');
    const steps = status === 'Accepted' ? [['Request sent', 'done'], ['Driver reviewed', 'done'], ['Driver accepted', 'done'], ['Seat reserved', 'done']] :
      status === 'Declined' ? [['Request sent', 'done'], ['Driver reviewed', 'done'], ['Driver declined', 'failed']] :
      [['Request sent', 'done'], ['Driver review', 'current'], ['Driver decision', ''], ['Seat reservation', '']];
    for (const [label, style] of steps) list.append(element('li', style, label));
    return list;
  }

  async function routeFor(request) {
    try { return await api.request(`/student/routes/${request.route_id}`); }
    catch { return null; }
  }

  async function renderRequests() {
    const list = $('requestList');
    list.replaceChildren();
    $('requests').querySelector('.section-intro > p').textContent = 'Track real driver decisions. Pending requests do not reserve seats.';
    try {
      state.requests = await api.request('/student/ride-requests');
      $('requestsEmpty').hidden = state.requests.length > 0;
      const requestRoutes = [];
      for (const request of state.requests) requestRoutes.push({ request, route: await routeFor(request) });
      const needsAlternatives = ({ request, route }) => request.status === 'Declined' ||
        (request.status === 'Pending' && (!route || route.status === 'Full' || route.available_seats < 1));
      let alternatives = [];
      let alternativeError = false;
      if (requestRoutes.some(needsAlternatives)) {
        if (state.profile.area_id && state.profile.university_id) {
          const query = new URLSearchParams({
            from_area_id: state.profile.area_id, to_university_id: state.profile.university_id
          });
          try { alternatives = await api.request(`/student/routes?${query}`); }
          catch { alternativeError = true; }
        }
      }
      for (const { request, route } of requestRoutes) {
        const card = element('article', 'request-card');
        const header = element('div', 'request-card-header');
        const heading = element('div');
        heading.append(element('h3', '', route ? `${route.origin_area} → ${route.destination_university}` : `Request ${request.id}`),
          element('p', 'request-meta', `Requested ${date(request.created_at)} · ${route ? `Route ${route.id}` : 'Route details unavailable'}`));
        header.append(heading, element('span', `status-badge ${request.status.toLowerCase()}`, request.status));
        const body = element('div', 'request-body');
        const driver = element('div', 'request-driver');
        const name = route?.driver_name || 'Driver unavailable';
        const driverCopy = element('div');
        driverCopy.append(element('strong', '', name), element('small', '', request.status === 'Accepted' ? 'Seat reserved' : 'No seat reserved yet'));
        driver.append(element('span', 'avatar', name[0].toUpperCase()), driverCopy);
        body.append(driver, requestTimeline(request.status));
        card.append(header, body);
        if (needsAlternatives({ request, route })) card.append(alternativesPanel(alternatives, request.route_id, alternativeError));
        list.append(card);
      }
    } catch (error) { message(list, error.message, true); }
  }

  async function renderUpcoming() {
    const section = $('upcomingRide');
    section.hidden = false;
    section.querySelector('h2').textContent = 'Your accepted rides.';
    section.querySelector('.section-intro > p').textContent = 'Accepted requests with a reserved seat appear here.';
    const card = $('upcomingCard');
    const safetyRides = [];
    try {
      state.requests = await api.request('/student/ride-requests');
      const accepted = state.requests.filter(item => item.status === 'Accepted');
      if (!accepted.length) { card.append(element('h3', '', 'No accepted ride yet.'), element('p', '', 'Your upcoming ride appears after a driver accepts your request.')); return safetyRides; }
      for (const request of accepted) {
        const route = await routeFor(request);
        safetyRides.push({ id: request.id, driver_name: route?.driver_name,
          pickup_area: route?.origin_area, university: route?.destination_university,
          departure_time: route?.departure_time });
        const ride = element('div', 'upcoming-ride-item');
        const details = element('div');
        details.append(element('p', 'eyebrow-label', 'SEAT RESERVED'), element('h3', '', route ? `${route.origin_area} → ${route.destination_university}` : `Route ${request.route_id}`));
        const driver = element('div', 'upcoming-driver');
        const name = route?.driver_name || 'Driver unavailable';
        driver.append(element('span', 'avatar', name[0].toUpperCase()), element('strong', '', name));
        details.append(driver);
        const facts = element('div', 'upcoming-facts');
        line(facts, 'Departure', formattedTime(route?.departure_time));
        line(facts, 'Return', formattedTime(route?.return_time));
        line(facts, 'Price', price(route?.price_iqd));
        line(facts, 'Accepted', date(request.decided_at));
        ride.append(details, facts);
        card.append(ride);
      }
    } catch (error) {
      card.replaceChildren(message(card, 'Could not load your rides. Please try again later.', true));
      return null;
    }
    return safetyRides;
  }

  async function renderWaitlist() {
    const section = $('waitlist');
    section.hidden = false;
    section.querySelector('h2').textContent = 'Your route demand.';
    section.querySelector('.section-intro > p').textContent = 'Route demand is tracked here. It does not reserve a seat.';
    const card = $('waitlistCard');
    try { state.demands = await api.request('/student/route-demand'); }
    catch (error) { message(card, error.message, true); return; }
    card.replaceChildren();
    const copy = element('div', 'waitlist-journey');
    copy.append(element('p', 'eyebrow-label', 'ROUTE DEMAND'), element('h3', '', `${areaName(state.profile.area_id)} → ${universityName(state.profile.university_id)}`),
      element('p', '', 'Register your journey when no suitable route exists. No seat is reserved.'));
    const other = element('div');
    if (state.demands.length) {
      for (const demand of state.demands) {
        const item = element('div', 'waitlist-progress');
        item.append(element('strong', '', `${areaName(demand.from_area_id)} → ${universityName(demand.to_university_id)}`),
          element('p', '', `Status: ${demand.status} · Created ${date(demand.created_at)}`));
        other.append(item);
      }
    }
    const sameJourney = state.demands.some(item => item.from_area_id === state.profile.area_id && item.to_university_id === state.profile.university_id && item.status === 'Active');
    if (!sameJourney && state.profile.area_id && state.profile.university_id) {
      const button = element('button', 'primary-action', 'Register route demand');
      button.type = 'button';
      button.onclick = async () => {
        button.disabled = true;
        try {
          await api.request('/student/route-demand', { method: 'POST', body: JSON.stringify({
            from_area_id: state.profile.area_id, to_university_id: state.profile.university_id
          }) });
          await renderWaitlist();
          showToast('Route demand recorded. No seat is reserved.');
        } catch (error) { message(other, error.message, true); button.disabled = false; }
      };
      other.append(button);
    }
    card.append(copy, other);
  }

  async function init() {
    if (!api.token()) { api.logout(); return; }
    document.querySelector('.demo-dock')?.remove();
    $('notificationButton').disabled = true;
    $('notificationButton').title = 'Notifications are not available yet.';
    text('notificationCount', '0');
    $('logoutButton').onclick = api.logout;
    $('closeRouteDialog').onclick = () => $('routeDialog').close();
    $('profileButton').onclick = () => {
      $('profilePopover').hidden = !$('profilePopover').hidden;
      $('profileButton').setAttribute('aria-expanded', String(!$('profilePopover').hidden));
    };
    document.addEventListener('click', event => {
      if (!event.target.closest('.account-menu')) $('profilePopover').hidden = true;
    });
    $('sidebarToggle').onclick = () => {
      const open = !$('studentSidebar').classList.contains('is-open');
      $('studentSidebar').classList.toggle('is-open', open);
      $('sidebarBackdrop').hidden = !open;
      $('sidebarToggle').setAttribute('aria-expanded', String(open));
    };
    $('sidebarBackdrop').onclick = () => $('sidebarToggle').click();
    document.querySelector(`[data-page="${page}"][href]`)?.setAttribute('aria-current', 'page');
    main.replaceChildren(message(main, 'Loading your journey…'));
    try {
      [state.areas, state.universities, state.profile] = await Promise.all([
        api.request('/student/areas'), api.request('/student/universities'), api.request('/student/profile')
      ]);
      loadView();
      bindProfile();
      if (page === 'journey') await renderJourney();
      else if (page === 'routes') await renderRoutes();
      else if (page === 'requests') await renderRequests();
      else if (page === 'waitlist') await renderWaitlist();
      else if (page === 'upcoming') {
        const safetyRides = await renderUpcoming();
        window.DarbStudentSafety?.init(safetyRides);
      }
    } catch (error) { main.replaceChildren(message(main, error.message || 'Could not load your journey.', true)); }
  }
  init();
})();
