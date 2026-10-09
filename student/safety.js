(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  let subscriptions = [];
  let selected = null;
  let locationUrl = '';
  const icon = (name, className = '') => {
    const paths = {
      shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
      send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
      phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.5 3a2 2 0 0 1-.6 1.8L7.2 10a16 16 0 0 0 6.8 6.8l1.5-1.8a2 2 0 0 1 1.8-.6l3 .5a2 2 0 0 1 1.7 2Z"/>',
      pin: '<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
      message: '<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-4-.9L3 21l1.9-5.5a9 9 0 0 1-.9-4A8.5 8.5 0 0 1 12.5 3H13a8.5 8.5 0 0 1 8 8.5Z"/>'
    };
    return `<svg class="safety-icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
  };

  const field = (label, value) => value ? `${label}: ${String(value).trim()}` : null;
  const details = subscription => [
    field('السائق', subscription.driver_name),
    field('منطقة الصعود', subscription.pickup_area),
    field('الجامعة', subscription.university),
    field('وقت الانطلاق', subscription.departure_time?.slice(0, 5)),
    field('المركبة', subscription.vehicle_model),
    field('رقم اللوحة', subscription.vehicle_plate)
  ].filter(Boolean).join('\n');
  const shareMessage = subscription => ['تفاصيل خط النقل الجامعي في DarbGo', details(subscription),
    'ملاحظة: هذه تفاصيل النقل المجدول وليست معلومات عن موقعي المباشر.'].filter(Boolean).join('\n\n');
  const emergencyMessage = subscription => ['🚨 تنبيه طوارئ — DarbGo', 'أحتاج إلى مساعدتك بشكل عاجل.',
    details(subscription) && `هذه معلومات خط النقل الجامعي المشترك به:\n${details(subscription)}`,
    'يرجى التواصل معي بأسرع وقت ممكن.',
    'ملاحظة: هذه معلومات الخط المسجل وليست موقعي المباشر.'].filter(Boolean).join('\n\n');
  const whatsApp = message => window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
  const note = value => {
    $('safetyFeedback').textContent = value;
    if ($('safetyModalFeedback')) $('safetyModalFeedback').textContent = value;
  };

  function current() {
    return subscriptions.find(item => String(item.id) === $('safetySubscription').value) || null;
  }
  function selectSubscription() {
    selected = current();
    $('shareRideButton').disabled = !selected;
  }
  function displayRides(rides) {
    subscriptions = rides || [];
    const select = $('safetySubscription');
    select.replaceChildren();
    subscriptions.forEach((item, index) => {
      const label = [item.pickup_area, item.university].filter(Boolean).join(' → ') || `Accepted ride ${index + 1}`;
      select.add(new Option(label, String(item.id)));
    });
    $('safetySubscriptionField').hidden = subscriptions.length < 2;
    $('safetyEmpty').hidden = subscriptions.length > 0 || rides === null;
    $('safetyActions').hidden = subscriptions.length === 0;
    note(rides === null ? 'Ride details are temporarily unavailable. Emergency options remain available.' : '');
    selectSubscription();
  }
  function openEmergency() {
    locationUrl = '';
    $('locationResult').hidden = true;
    $('locationLoading').hidden = true;
    $('safetyDialog').showModal();
    $('getLocationButton').focus();
  }
  function shareSelected(emergency = false) {
    if (!emergency && !selected) return;
    whatsApp(emergency ? emergencyMessage(selected || {}) : shareMessage(selected));
  }
  function getLocation() {
    if (!navigator.geolocation) { note('Location is unavailable in this browser.'); return; }
    const button = $('getLocationButton');
    button.disabled = true;
    $('locationLoading').hidden = false;
    $('locationResult').hidden = true;
    note('Requesting one-time location permission…');
    navigator.geolocation.getCurrentPosition(position => {
      const { latitude, longitude } = position.coords;
      locationUrl = `https://www.google.com/maps?q=${encodeURIComponent(`${latitude},${longitude}`)}`;
      $('mapsLink').href = locationUrl;
      $('locationResult').hidden = false;
      $('locationLoading').hidden = true;
      button.disabled = false;
      note('Your one-time location is ready. It is not live tracking.');
    }, error => {
      $('locationLoading').hidden = true;
      button.disabled = false;
      note(error.code === 1 ? 'Location permission was denied.' :
        error.code === 3 ? 'Location timed out. Please try again.' : 'Your location is unavailable. Please try again.');
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 });
  }
  function init(rides) {
    const host = $('upcomingRide');
    if (!host || window.DarbStudentApi.demo) return;
    const section = document.createElement('section');
    section.className = 'safety-panel';
    section.innerHTML = `<div class="safety-heading"><span class="safety-heading-icon">${icon('shield')}</span>
      <div><p class="eyebrow-label">TRAVEL WITH CONFIDENCE</p><h3>Ride safety</h3>
      <p>Keep someone informed about your journey, or find help when you need it.</p></div></div>
      <p id="safetyFeedback" class="safety-feedback" role="status" aria-live="polite"></p>
      <div class="safety-card-grid">
        <article class="safety-action-card safety-share-card"><div class="safety-card-icon">${icon('send')}</div>
          <div class="safety-card-copy"><h4>Share your ride</h4><p>Send your scheduled ride details to someone you trust. You choose who receives them.</p></div>
          <div id="safetyActions"><label id="safetySubscriptionField" hidden>Choose a ride<select id="safetySubscription"></select></label>
          <p id="safetyEmpty" class="safety-empty" hidden>No accepted ride is available to share.</p>
          <button class="safety-cta safety-share-cta" id="shareRideButton" type="button">Share Ride <span aria-hidden="true">→</span></button></div>
        </article>
        <article class="safety-action-card safety-emergency-card"><div class="safety-card-icon">${icon('shield')}</div>
          <div class="safety-card-copy"><h4>Emergency assistance</h4><p>Quick access to emergency calling, a trusted contact, and location sharing.</p></div>
          <button class="safety-cta safety-emergency-cta" id="emergencyButton" type="button">Get Assistance <span aria-hidden="true">→</span></button>
        </article>
      </div>`;
    host.append(section);
    const dialog = document.createElement('dialog');
    dialog.id = 'safetyDialog';
    dialog.className = 'route-dialog safety-dialog';
    dialog.setAttribute('aria-labelledby', 'safetyTitle');
    dialog.innerHTML = `<button class="dialog-close safety-close" id="closeSafetyDialog" type="button" aria-label="Close emergency assistance">Close</button>
      <div class="dialog-content safety-dialog-content"><div class="safety-modal-heading"><span class="safety-heading-icon safety-heading-icon-red">${icon('shield')}</span>
      <div><p class="eyebrow-label">RIDE SAFETY</p><h2 id="safetyTitle">Emergency assistance</h2>
      <p>Choose the help you need. Calls and messages are completed by you.</p></div></div>
      <p id="safetyModalFeedback" class="safety-feedback" role="status" aria-live="polite"></p>
      <div class="safety-option-grid">
      <section class="safety-option"><span class="safety-option-icon safety-red">${icon('phone')}</span><div><h3>Call emergency services</h3>
      <p>Open your device's dialer to call 911. A phone app may be required on desktop.</p>
      <a class="safety-modal-cta" href="tel:911">Call 911 <span aria-hidden="true">→</span></a></div></section>
      <section class="safety-option"><span class="safety-option-icon">${icon('message')}</span><div><h3>Alert a trusted contact</h3>
      <p>Prepare an Arabic message. Choose the recipient and send it yourself.</p>
      <button class="safety-modal-cta" id="alertContactButton" type="button">Open WhatsApp <span aria-hidden="true">→</span></button></div></section>
      </div>
      <section class="safety-location-section"><div class="safety-location-heading"><span class="safety-option-icon">${icon('pin')}</span>
      <div><h3>Share my location</h3><p>Choose a one-time location link or share live location directly in WhatsApp.</p></div></div>
      <div class="safety-location-grid"><div class="safety-location-card"><h4>Current location</h4>
      <p>Ask for permission once and prepare a Google Maps link. This is not live tracking.</p>
      <button class="safety-modal-cta" id="getLocationButton" type="button">Get my current location</button>
      <p id="locationLoading" hidden>Locating…</p><div id="locationResult" class="safety-location-results" hidden>
      <a class="safety-modal-cta" id="mapsLink" target="_blank" rel="noopener noreferrer">Open Google Maps</a>
      <button class="safety-modal-cta" id="shareLocationButton" type="button">Share on WhatsApp</button>
      <button class="safety-modal-cta" id="copyLocationButton" type="button">Copy link</button></div></div>
      <div class="safety-location-card"><h4>WhatsApp live location</h4>
      <p>WhatsApp handles live sharing. DarbGo will not request your location for this option.</p>
      <ol><li>Open WhatsApp and select a trusted contact.</li><li>Open Attach, then Location.</li>
      <li>Select Share Live Location, choose a duration, and send.</li></ol>
      <a class="safety-modal-cta" href="https://api.whatsapp.com/" target="_blank" rel="noopener noreferrer">Open WhatsApp</a></div></div></section></div>`;
    document.body.append(dialog);
    $('safetySubscription').onchange = selectSubscription;
    $('shareRideButton').onclick = () => shareSelected();
    $('emergencyButton').onclick = openEmergency;
    $('closeSafetyDialog').onclick = () => dialog.close();
    $('alertContactButton').onclick = () => shareSelected(true);
    $('getLocationButton').onclick = getLocation;
    $('shareLocationButton').onclick = () => { if (locationUrl) whatsApp(`هذا موقعي الحالي لمرة واحدة:\n${locationUrl}`); };
    $('copyLocationButton').onclick = async () => {
      try { await navigator.clipboard.writeText(locationUrl); note('Location link copied.'); }
      catch { note('Could not copy the link. Open Google Maps to copy it.'); }
    };
    displayRides(rides);
  }
  window.DarbStudentSafety = { init, shareMessage, emergencyMessage };
})();
