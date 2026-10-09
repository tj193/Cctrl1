(() => {
  'use strict';
  if (!window.DarbStudentApi?.demo) return;
  const page = document.body.dataset.page || 'journey';
  const pageFiles = { journey:'dashboard.html', routes:'routes.html', requests:'requests.html', waitlist:'waitlist.html', upcoming:'upcoming.html' };
  const targetPages = { journey:'journey', routeSearch:'routes', requests:'requests', waitlist:'waitlist', upcomingRide:'upcoming', messages:'upcoming' };
  const views = document.createElement('template');
  views.innerHTML = window.DarbStudentViews;
  const sections = { journey:['journey','journeyProgressSection'], routes:['routeSearch'], requests:['requests'], waitlist:['waitlist'], upcoming:['upcomingRide'] };
  sections[page].forEach(id => document.getElementById('mainContent').append(views.content.querySelector(`#${id}`)));
  const get = id => document.getElementById(id) || views.content.querySelector(`#${id}`);
  document.querySelector(`[data-page="${page}"][href]`).setAttribute('aria-current','page');
  const legacyPage = targetPages[location.hash.slice(1)];
  if (legacyPage && legacyPage !== page) { location.replace(pageFiles[legacyPage]); return; }
  const setSidebar = open => {
    get('studentSidebar').classList.toggle('is-open', open);
    get('sidebarBackdrop').hidden = !open;
    get('sidebarToggle').setAttribute('aria-expanded', String(open));
  };
  get('sidebarToggle').onclick = () => setSidebar(get('sidebarToggle').getAttribute('aria-expanded') !== 'true');
  get('sidebarBackdrop').onclick = () => setSidebar(false);
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && get('sidebarToggle').getAttribute('aria-expanded') === 'true') { setSidebar(false); get('sidebarToggle').focus(); } });
  let user;
  try { user = JSON.parse(sessionStorage.getItem('loggedInUser') || 'null'); } catch { user = null; }
  if (!user || user.role !== 'student') { window.location.replace(window.DarbAccounts.loginUrl); return; }

  const demo = window.DarbStudentDemo;
  const firstName = (user.fullName || 'Student').trim().split(/\s+/)[0];
  const formatTime = value => { if (!value || !/^\d{2}:\d{2}$/.test(value)) return 'Not set'; const [hour, minute] = value.split(':').map(Number); return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`; };
  const values = { home:user.homeArea || 'Your area', university:user.university || 'Your university', arrival:formatTime(user.arrivalTime) };
  const clone = value => JSON.parse(JSON.stringify(value));
  const state = { searched:false, noMatch:false, routes:clone(demo.routes), requests:clone(demo.requests.slice(0,2)), notifications:clone(demo.notifications), waitlist:{ joined:false, newMatch:false } };
  const storageKey = `darbgoStudentDashboard:${user.email || user.phone || user.fullName}`;
  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
    if (saved && Array.isArray(saved.requests) && Array.isArray(saved.notifications) && saved.waitlist) {
      state.requests = saved.requests; state.notifications = saved.notifications; state.waitlist = saved.waitlist;
      state.searched = saved.searched === true; state.noMatch = saved.noMatch === true;
    }
  } catch { /* Keep defaults when storage is unavailable. */ }
  const saveState = () => {
    try { sessionStorage.setItem(storageKey, JSON.stringify({ requests:state.requests, notifications:state.notifications, waitlist:state.waitlist, searched:state.searched, noMatch:state.noMatch })); } catch { /* Navigation remains available. */ }
  };
  window.addEventListener('pagehide', saveState);
  const navigate = target => { saveState(); location.href = pageFiles[targetPages[target] || target] || pageFiles.journey; };
  state.routes.slice(0,4).forEach(route => { route.destination = values.university; });
  state.routes[0].startArea = values.home;
  const statusLabel = { pending:'Pending', accepted:'Driver approved', confirmed:'Confirmed', declined:'Declined', cancelled:'Cancelled', action_required:'Action required' };

  document.title = `${{journey:'Your journey',routes:'Routes',requests:'My requests',waitlist:'Waitlist',upcoming:'Upcoming ride'}[page]} — DarbGo`;
  get('studentFirstName').textContent = firstName; get('profileName').textContent = firstName; get('profileInitial').textContent = firstName[0].toUpperCase(); get('sceneStudentInitial').textContent = firstName[0].toUpperCase(); get('profilePopoverName').textContent = user.fullName || firstName; get('profilePopoverEmail').textContent = user.email || '';
  ['homeArea','sceneHomeArea','preferenceArea','progressHome'].forEach(id => get(id).textContent = values.home);
  ['university','sceneUniversity','preferenceUniversity'].forEach(id => get(id).textContent = values.university);
  ['arrivalTime','sceneArrivalTime','preferenceTime'].forEach(id => get(id).textContent = values.arrival);
  const hour = new Date().getHours(); get('journey').querySelector('.hero-copy h1').firstChild.textContent = `${hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'}, `;
  get('dayLabel').textContent = new Intl.DateTimeFormat('en-US',{weekday:'long',month:'long',day:'numeric'}).format(new Date()).toUpperCase();
  if (page === 'journey') window.DarbJourneyMap?.init({ origin:values.home, destination:values.university, governorate:user.governorate, studentInitial:firstName[0].toUpperCase() });

  const routeById = id => state.routes.find(route => route.id === id) || demo.routes.find(route => route.id === id);
  const requestForRoute = id => state.requests.find(request => request.routeId === id && !['declined','cancelled'].includes(request.status));
  let toastTimer;
  const toast = message => { clearTimeout(toastTimer); get('toast').textContent = message; get('toast').hidden = false; toastTimer = setTimeout(() => get('toast').hidden = true, 2600); };
  const say = message => window.DarbGoPet?.say ? window.DarbGoPet.say(message) : window.DarbGoPet?.play('wave',{restart:true});

  const routeCard = route => {
    const request = requestForRoute(route.id); const buttonLabel = request ? statusLabel[request.status] : 'Request seat';
    return `<article class="route-card" data-route-id="${route.id}"><div class="route-card-top"><span class="match-pill">${route.match}% match</span><span class="seat-pill">${route.seats} ${route.seats === 1 ? 'seat' : 'seats'} left</span></div><h3 class="route-path-title">${route.startArea} <span>→</span> ${route.destination}</h3><p class="route-pickup">Pickup ${route.pickupWindow} · Leaves ${route.departure}</p><div class="route-driver"><span class="avatar" aria-hidden="true">${route.driver.initials}</span><div class="driver-copy"><strong>${route.driver.name}${route.driver.verified ? ' <span class="verified">Verified</span>' : ''}</strong><span>${route.vehicle.model} · ${route.vehicle.year}</span></div><span class="driver-rating">${route.driver.rating}<br><small>rating</small></span></div><div class="route-card-price"><div><strong>${route.price.toLocaleString()} IQD</strong><span>per month</span></div><div><strong>${route.departure}</strong><span>departure</span></div></div><div class="route-card-actions"><button class="details-button" type="button" data-action="details">View details</button><button class="request-button${request ? ' is-sent' : ''}" type="button" data-action="request" ${request ? 'disabled' : ''}>${buttonLabel}</button></div></article>`;
  };

  const renderRoutes = () => {
    const minimumSeats = Number(get('seatFilter').value); const sort = get('sortRoutes').value;
    const routes = state.routes.filter(route => route.seats >= minimumSeats).sort((a,b) => sort === 'price' ? a.price-b.price : sort === 'seats' ? b.seats-a.seats : sort === 'departure' ? a.departure.localeCompare(b.departure) : b.match-a.match);
    get('matchCount').textContent = `${routes.length} ${routes.length === 1 ? 'route matches' : 'routes match'} your journey`;
    get('resultsNote').textContent = `Sorted by ${{match:'strongest match',departure:'departure time',price:'lowest price',seats:'available seats'}[sort]}`;
    get('routeGrid').innerHTML = routes.map(routeCard).join('');
  };

  const showSearchState = name => { get('searchStart').hidden = name !== 'start'; get('searchingState').hidden = name !== 'loading'; get('routeResults').hidden = name !== 'results'; get('noRoutesState').hidden = name !== 'no-match'; };
  const setProgress = stage => {
    const order = ['details','search','request','confirmed']; const active = order.indexOf(stage);
    document.querySelectorAll('#journeyProgress li').forEach((item,index) => { item.classList.toggle('is-complete',index < active); item.classList.toggle('is-active',index === active); });
    const copy = { search:'Your details are saved. Search when you are ready.', request:'Routes found. Compare them and follow your requests below.', confirmed:'A seat is confirmed. Your upcoming ride is ready.' };
    get('progressSummary').textContent = copy[stage] || copy.search;
  };
  let searchTimer;
  const findRoutes = () => { if (page !== 'routes') { saveState(); location.href = 'routes.html?search=1'; return; } clearTimeout(searchTimer); state.searched = true; showSearchState('loading'); get('sceneStatus').textContent='Searching routes'; get('sceneMap').classList.add('is-searching'); get('routeSearch').scrollIntoView({behavior:'smooth',block:'start'}); searchTimer=setTimeout(()=>{ get('sceneMap').classList.remove('is-searching'); if(state.noMatch){showSearchState('no-match');get('sceneStatus').textContent='No match yet';say('No route yet. I will keep looking!');}else{renderRoutes();showSearchState('results');get('sceneStatus').textContent='Routes found';get('sceneMap').classList.add('is-route-found');setProgress('request');get('progressSearch').textContent='Routes found';} },900); };

  const timelineFor = status => {
    const steps = [{label:'Request sent',done:true},{label:'Driver review'},{label:'Driver accepted'},{label:'Seat confirmed'}];
    if(status==='pending') steps[1].current=true;
    if(status==='accepted'){steps[1].done=true;steps[2].done=true;steps[3]={label:'Your confirmation',current:true};}
    if(status==='confirmed') steps.forEach(step=>step.done=true);
    if(status==='declined'){steps[1].done=true;steps[2]={label:'Driver declined',failed:true};steps.length=3;}
    if(status==='cancelled'){steps[1]={label:'Request cancelled',failed:true};steps.length=2;}
    if(status==='action_required'){steps[1].done=true;steps[2]={label:'Change suggested',current:true};steps[3]={label:'Your response'};}
    return steps.map(step=>`<li class="${step.done?'done':step.current?'current':step.failed?'failed':''}">${step.label}</li>`).join('');
  };
  const bookingAction = request => {
    if (request.status === 'accepted') {
      return `<div class="booking-confirmation"><div><strong>Your driver has approved this request.</strong><p>Confirm your booking to see your upcoming ride and contact your driver.</p></div><button class="primary-action" data-request-action="confirm" type="button" lang="ar" dir="rtl">تأكيد الحجز</button></div>`;
    }
    if (request.status === 'confirmed') {
      return `<div class="booking-confirmation is-confirmed"><p>Your booking is confirmed. Your pickup details are ready.</p><a class="secondary-action" href="upcoming.html?request=${encodeURIComponent(request.id)}">View upcoming ride</a></div>`;
    }
    return '';
  };

  const renderRequests = () => {
    get('requestsEmpty').hidden = state.requests.length > 0;
    get('requestList').innerHTML = state.requests.map(request=>{ const route=routeById(request.routeId); if(!route)return''; return `<article class="request-card" data-request-id="${request.id}"><div class="request-card-header"><div><h3>${route.startArea} → ${route.destination}</h3><p class="request-meta">Requested ${request.created} · Updated ${request.updated}</p></div><span class="status-badge ${request.status}">${statusLabel[request.status]}</span></div><div class="request-body"><div class="request-driver"><span class="avatar">${route.driver.initials}</span><div><strong>${route.driver.name}</strong><small>${route.vehicle.model}</small></div></div><ol class="request-timeline">${timelineFor(request.status)}</ol></div>${request.status==='action_required'?`<div class="request-action"><p>Driver suggested a different pickup time: <strong>${request.suggestedTime}</strong></p><div><button class="accept-change" data-request-action="accept" type="button">Accept</button><button class="decline-change" data-request-action="decline" type="button">Decline</button></div></div>`:''}${bookingAction(request)}</article>`;}).join('');
    renderUpcoming(); updateProgressFromRequests();
  };
  const updateProgressFromRequests = () => { const confirmed=state.requests.some(item=>item.status==='confirmed'); const active=state.requests.some(item=>!['declined','cancelled'].includes(item.status)); get('progressRequest').textContent=active?'Request in progress':'No active request'; get('progressConfirmed').textContent=confirmed?'Seat confirmed':'Waiting for confirmation'; setProgress(confirmed?'confirmed':active?'request':state.searched?'request':'search'); };

  const renderWaitlist = () => { get('waitlist').hidden=false; if(!state.waitlist.joined){get('waitlistCard').innerHTML='<div><h3>No waitlisted journey yet.</h3><p>Search for routes first. If no route fits, join the waitlist.</p><a class="secondary-action" href="routes.html">Explore routes</a></div>';return;} get('waitlistCard').innerHTML=`<div class="waitlist-journey"><p class="panel-label">LOOKING FOR A ROUTE</p><h3>${values.home} → ${values.university}</h3><p>Status: ${state.waitlist.newMatch?'A new match is ready':'Searching available routes'}</p><div class="waitlist-route"><span>${values.home}</span><i></i><span>${values.university}</span></div>${state.waitlist.newMatch?'<div class="new-match-banner"><strong>New match found — 91%</strong><button id="viewWaitlistMatch" type="button">View route</button></div>':''}</div><ol class="waitlist-progress"><li class="done">Request registered</li><li class="done">Searching available routes</li><li class="${state.waitlist.newMatch?'done':'current'}">Waiting for a suitable match</li><li class="${state.waitlist.newMatch?'current':''}">Driver available</li></ol>`; };
  const driverContact = driver => {
    const icon = '<svg class="whatsapp-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="currentColor"><path d="M20.52 3.48A11.87 11.87 0 0 0 12.05 0C5.47 0 .12 5.35.12 11.93c0 2.1.55 4.15 1.6 5.96L0 24l6.27-1.64a11.94 11.94 0 0 0 5.78 1.47h.01c6.58 0 11.93-5.35 11.94-11.93a11.85 11.85 0 0 0-3.48-8.42ZM12.06 21.8a9.9 9.9 0 0 1-5.04-1.38l-.36-.21-3.72.98.99-3.63-.23-.37a9.88 9.88 0 0 1-1.52-5.26c0-5.47 4.45-9.92 9.92-9.92a9.84 9.84 0 0 1 7.02 2.91 9.86 9.86 0 0 1 2.9 7.02c0 5.47-4.45 9.92-9.96 9.92Zm5.44-7.43c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.48-.88-.78-1.48-1.75-1.65-2.05-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.49s1.07 2.89 1.22 3.09c.15.2 2.1 3.2 5.09 4.49.71.3 1.27.49 1.7.63.72.23 1.37.2 1.89.12.58-.09 1.76-.72 2.01-1.42.25-.7.25-1.3.17-1.42-.07-.13-.27-.2-.57-.35Z"/></svg>';
    const phone = window.DarbAccounts.normalizePhone(String(driver.whatsapp || driver.phone || '')).replace(/^\+/, '');
    if (!/^[1-9]\d{7,14}$/.test(phone)) return `<button class="whatsapp-button" type="button" disabled>${icon}Chat on WhatsApp</button><p class="contact-note">The driver’s WhatsApp number is not available yet.</p>`;
    return `<a class="whatsapp-button" href="https://wa.me/${phone}" target="_blank" rel="noopener noreferrer">${icon}Chat on WhatsApp <span aria-hidden="true">↗</span></a>`;
  };
  const renderUpcoming = () => { const selectedId=new URLSearchParams(location.search).get('request'); const request=state.requests.find(item=>item.status==='confirmed' && item.id===selectedId) || state.requests.find(item=>item.status==='confirmed'); get('upcomingRide').hidden=false; if(!request){get('upcomingCard').innerHTML='<div><h3>No confirmed ride yet.</h3><p>Your driver and pickup details will appear after your seat is confirmed.</p><a class="secondary-action" href="requests.html">View requests</a></div>';return;} const route=routeById(request.routeId); get('upcomingCard').innerHTML=`<div><div class="upcoming-driver"><span class="avatar">${route.driver.initials}</span><div><h3>${route.driver.name}</h3><span>${route.driver.rating} rating · ${route.driver.verified?'Verified driver':'Driver'}</span></div></div><p class="route-pickup">${route.vehicle.model} · ${route.vehicle.year} · ${route.vehicle.color}</p>${driverContact(route.driver)}</div><div class="upcoming-facts"><div><span>Pickup point</span><strong>${route.pickupPoint}</strong></div><div><span>Pickup time</span><strong>${route.pickupWindow}</strong></div><div><span>University</span><strong>${route.destination}</strong></div><div><span>Schedule</span><strong>${route.days}</strong></div></div>`; };

  const renderNotifications = () => { const unread=state.notifications.filter(item=>item.unread).length; get('notificationCount').textContent=unread;  get('notificationCount').hidden=unread===0;  const today=state.notifications.filter(item=>!['Yesterday','September 21'].includes(item.time)); const older=state.notifications.filter(item=>!today.includes(item)); const group=(label,items)=>items.length?`<p class="notification-group-label">${label}</p>${items.map(item=>`<button class="notification-item ${item.unread?'unread':''} ${item.type==='message'?'message':''}" data-note-id="${item.id}" type="button"><i></i><span><strong>${item.title}</strong><span>${item.body}</span><time>${item.time}</time></span></button>`).join('')}`:''; get('notificationList').innerHTML=group('TODAY',today)+group('EARLIER',older); };
  const toggleNotifications = open => { get('notificationDrawer').classList.toggle('is-open',open); get('notificationDrawer').setAttribute('aria-hidden',String(!open)); get('notificationDrawer').inert=!open; get('drawerBackdrop').hidden=!open; get('notificationButton').setAttribute('aria-expanded',String(open)); if(open)setTimeout(()=>get('closeNotifications').focus(),50); };

  const openDetails = id => { const route=routeById(id); const request=requestForRoute(id); get('routeDialogContent').innerHTML=`<div class="dialog-content"><div class="dialog-top"><div><p class="panel-label">${route.match}% ROUTE MATCH</p><h2 id="dialogTitle">${route.startArea} → ${route.destination}</h2></div><span class="seat-pill">${route.seats} seats left</span></div><div class="dialog-driver"><span class="avatar">${route.driver.initials}</span><div class="driver-copy"><strong>${route.driver.name} ${route.driver.verified?'<span class="verified">Verified</span>':''}</strong><span>${route.driver.rating} rating · ${route.vehicle.model} · ${route.vehicle.year}</span></div></div><div class="detail-grid"><div><span>Pickup window</span><strong>${route.pickupWindow}</strong></div><div><span>Departure</span><strong>${route.departure}</strong></div><div><span>Estimated arrival</span><strong>${route.arrival}</strong></div><div><span>Monthly price</span><strong>${route.price.toLocaleString()} IQD</strong></div><div><span>University days</span><strong>${route.days}</strong></div><div><span>Pickup point</span><strong>${route.pickupPoint}</strong></div><div><span>Vehicle</span><strong>${route.vehicle.model} · ${route.vehicle.color}</strong></div><div><span>Available seats</span><strong>${route.seats}</strong></div></div><div class="dialog-actions"><button class="ghost-action" id="dialogCancel" type="button">Keep comparing</button><button class="primary-action" id="dialogRequest" type="button" ${request?'disabled':''}>${request?statusLabel[request.status]:'Request a seat'}</button></div></div>`; get('routeDialog').showModal(); get('dialogCancel').onclick=()=>get('routeDialog').close(); get('dialogRequest').onclick=()=>requestSeat(id); };
  const addNotification = (title,body,target='requests') => { state.notifications.unshift({id:`note-${Date.now()}`,type:'request',title,body,time:'Just now',unread:true,target}); renderNotifications(); };
  const requestSeat = id => { if(requestForRoute(id)){toast('You already have an active request for this route.');return;} state.requests.unshift({id:`request-${Date.now()}`,routeId:id,status:'pending',created:'Just now',updated:'Just now'}); get('routeDialog').close(); renderRoutes(); renderRequests(); addNotification('Request sent','Your seat request was sent successfully.'); toast('Request sent. You can follow it in My Requests.'); say('Your request is on its way!'); navigate('requests'); };

  const resetScenario = () => { clearTimeout(searchTimer); state.searched=false;state.noMatch=false;state.requests=[];state.waitlist={joined:false,newMatch:false};state.notifications=clone(demo.notifications);showSearchState('start');get('sceneStatus').textContent='Ready to search';get('sceneMap').classList.remove('is-searching','is-route-found'); };
  const applyScenario = scenario => { resetScenario(); const requestByStatus=status=>clone(demo.requests.find(item=>item.status===status)); if(scenario==='routes'){state.searched=true;renderRoutes();showSearchState('results');}
    if(scenario==='no-match'){state.searched=true;state.noMatch=true;showSearchState('no-match');}
    if(scenario==='waitlist'){state.waitlist={joined:true,newMatch:false};}
    if(scenario==='waitlist-match'){state.waitlist={joined:true,newMatch:true};}
    if(['pending','accepted','confirmed','declined','action'].includes(scenario)){const status=scenario==='action'?'action_required':scenario;state.requests=[requestByStatus(status)];state.searched=true;renderRoutes();showSearchState('results');}
    if(scenario==='multiple'){state.requests=clone(demo.requests.slice(0,4));state.searched=true;renderRoutes();showSearchState('results');}
    if(scenario==='notifications'){state.requests=[requestByStatus('accepted')];toggleNotifications(true);}
    if(scenario==='message'){state.notifications=clone(demo.notifications.filter(item=>item.type==='message'));state.notifications[0].unread=true;toggleNotifications(true);}
    if(scenario==='upcoming'){state.requests=[requestByStatus('confirmed')];}
    renderRequests();renderWaitlist();renderNotifications(); if(scenario!=='notifications'&&scenario!=='message')toggleNotifications(false); };

  get('findRouteButton').onclick=findRoutes; get('panelFindRouteButton').onclick=findRoutes; get('editJourneyButton').onclick=()=>location.href='register.html'; get('sortRoutes').onchange=renderRoutes; get('seatFilter').onchange=renderRoutes;
  get('routeGrid').addEventListener('click',event=>{const card=event.target.closest('.route-card');if(!card)return;if(event.target.dataset.action==='details')openDetails(card.dataset.routeId);if(event.target.dataset.action==='request')requestSeat(card.dataset.routeId);});
  get('requestList').addEventListener('click', event => {
    const action = event.target.closest('[data-request-action]')?.dataset.requestAction;
    const card = event.target.closest('.request-card');
    if (!card || !action) return;
    const request = state.requests.find(item => item.id === card.dataset.requestId);
    if (!request) return;

    if (action === 'confirm' && request.status === 'accepted') {
      request.status = 'confirmed';
      request.updated = 'Just now';
      addNotification('Booking confirmed', 'Your upcoming ride and driver details are ready.', 'upcomingRide');
      saveState();
      location.href = `upcoming.html?request=${encodeURIComponent(request.id)}`;
      return;
    }
    if (request.status !== 'action_required') return;
    if (action === 'accept') {
      request.status = 'accepted';
      request.updated = 'Just now';
      addNotification('Change accepted', 'Your updated pickup time was sent to the driver.');
      toast('Pickup change accepted. Confirm your booking to continue.');
    } else if (action === 'decline') {
      request.status = 'cancelled';
      request.updated = 'Just now';
      toast('Pickup change declined.');
    } else {
      return;
    }
    renderRequests();
    renderRoutes();
    saveState();
  });
  get('joinWaitlistButton').onclick=()=>{state.waitlist={joined:true,newMatch:false};renderWaitlist();navigate('waitlist');toast('Your journey was added to the waitlist.');say('Your journey is registered. I will keep looking!');};
  get('waitlist').addEventListener('click',event=>{if(event.target.id==='viewWaitlistMatch'){state.noMatch=false;state.searched=true;renderRoutes();showSearchState('results');navigate('routeSearch');}});
  get('notificationButton').onclick=()=>toggleNotifications(true);get('closeNotifications').onclick=()=>toggleNotifications(false);get('drawerBackdrop').onclick=()=>toggleNotifications(false);get('markAllRead').onclick=()=>{state.notifications.forEach(item=>item.unread=false);renderNotifications();};
  get('notificationList').addEventListener('click',event=>{const button=event.target.closest('[data-note-id]');if(!button)return;const note=state.notifications.find(item=>item.id===button.dataset.noteId);note.unread=false;renderNotifications();toggleNotifications(false);navigate(note.target);});
  get('closeRouteDialog').onclick=()=>get('routeDialog').close();get('routeDialog').addEventListener('click',event=>{if(event.target===get('routeDialog'))get('routeDialog').close();});
  const profileButton=get('profileButton'),profilePopover=get('profilePopover');profileButton.onclick=()=>{profilePopover.hidden=!profilePopover.hidden;profileButton.setAttribute('aria-expanded',String(!profilePopover.hidden));};document.addEventListener('click',event=>{if(!event.target.closest('.account-menu'))profilePopover.hidden=true;});get('logoutButton').onclick=window.DarbAccounts.logout;
  get('demoScenario').onchange=event=>{applyScenario(event.target.value);saveState();};

  get('notificationDrawer').inert = true;
  if (state.searched) { renderRoutes(); showSearchState(state.noMatch ? 'no-match' : 'results'); } else { showSearchState('start'); }
  renderRequests(); renderWaitlist(); renderNotifications();
  if (page === 'routes' && new URLSearchParams(location.search).get('search') === '1') { history.replaceState(null, '', 'routes.html'); findRoutes(); }
})();
