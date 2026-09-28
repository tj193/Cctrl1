(() => {
  'use strict';

  const centers = {
    baghdad: [33.3152, 44.3661], basra: [30.5085, 47.7804], nineveh: [36.34, 43.13], anbar: [33.43, 43.3],
    babil: [32.47, 44.42], karbala: [32.61, 44.02], najaf: [32.0, 44.33], diyala: [33.75, 44.63],
    kirkuk: [35.47, 44.39], erbil: [36.19, 44.01], sulaymaniyah: [35.56, 45.43], duhok: [36.86, 42.99]
  };
  let map;

  // The recorded journey has a local geographic preview so it is usable when
  // the map CDN, tile server, or public routing service is unavailable.
  const demoJourney = options =>
    options.governorate === 'baghdad' &&
    options.origin === 'المنصور' &&
    options.destination === 'جامعة بغداد';
  const localJourney = (container, options) => {
    const start = document.createElement('span');
    start.className = 'journey-local-label journey-local-start';
    start.textContent = options.origin;
    const finish = document.createElement('span');
    finish.className = 'journey-local-label journey-local-finish';
    finish.textContent = options.destination;
    container.innerHTML = `<svg class="journey-local-map" viewBox="0 0 800 440" role="img" aria-label="Map route from Al-Mansour to the University of Baghdad">
      <rect width="800" height="440" fill="#e8eddf"/>
      <path d="M0 53H800M0 117H800M0 181H800M0 246H800M0 312H800M0 381H800M77 0V440M159 0V440M243 0V440M327 0V440M411 0V440M495 0V440M579 0V440M663 0V440M747 0V440" stroke="#fff" stroke-width="10"/>
      <path d="M-20 102C160 128 239 110 374 134S660 161 820 142M-20 283C178 267 272 286 384 269S625 270 820 245M190-20C213 104 232 206 265 460M555-20C536 117 546 247 572 460" stroke="#cbd5c4" stroke-width="5" fill="none"/>
      <path d="M463-20C441 79 456 147 479 213S489 366 527 460" stroke="#a8d9eb" stroke-width="45" fill="none"/>
      <path d="M463-20C441 79 456 147 479 213S489 366 527 460" stroke="#78c4e5" stroke-width="31" fill="none"/>
      <path d="M179 168L245 180 327 181 410 181 479 213 541 246 620 284" fill="none" stroke="#fff" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M179 168L245 180 327 181 410 181 479 213 541 246 620 284" fill="none" stroke="#087bff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="179" cy="168" r="16" fill="#087bff" stroke="#fff" stroke-width="5"/><circle cx="620" cy="284" r="16" fill="#142d51" stroke="#fff" stroke-width="5"/>
      <text x="75" y="92">Al-Mansour</text><text x="328" y="93">Baghdad</text><text x="533" y="389">University of Baghdad</text>
    </svg>`;
    container.append(start, finish);
    container.dataset.mapReady = 'true';
  };

  const wait = milliseconds => new Promise(resolve => window.setTimeout(resolve, milliseconds));
  const cacheKey = query => `darbgo-map:${query.toLowerCase()}`;
  const geocode = async query => {
    const cached = sessionStorage.getItem(cacheKey(query));
    if (cached) return JSON.parse(cached);
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.search = new URLSearchParams({ format: 'jsonv2', limit: '1', countrycodes: 'iq', q: query });
    const response = await fetch(url, { headers: { 'Accept-Language': 'ar,en;q=0.8' } });
    if (!response.ok) throw new Error('Location lookup failed');
    const [result] = await response.json();
    if (!result) throw new Error('Location not found');
    const point = [Number(result.lat), Number(result.lon)];
    sessionStorage.setItem(cacheKey(query), JSON.stringify(point));
    return point;
  };

  const routeBetween = async (origin, destination) => {
    const coordinates = `${origin[1]},${origin[0]};${destination[1]},${destination[0]}`;
    const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson`);
    if (!response.ok) throw new Error('Route lookup failed');
    const data = await response.json();
    return data.routes?.[0]?.geometry?.coordinates?.map(([longitude, latitude]) => [latitude, longitude]);
  };

  const marker = (letter, campus = false) => window.L.divIcon({
    className: '',
    html: `<span class="journey-marker${campus ? ' campus' : ''}"><span>${letter}</span></span>`,
    iconSize: [38, 38], iconAnchor: [19, 19]
  });

  const drawJourney = async options => {
    const center = centers[options.governorate] || centers.baghdad;
    const fallbackOrigin = [center[0] - 0.025, center[1] - 0.04];
    const fallbackDestination = [center[0] + 0.02, center[1] + 0.045];
    let origin = fallbackOrigin, destination = fallbackDestination;
    const context = options.governorate ? `${options.governorate}, Iraq` : 'Iraq';

    try { origin = await geocode(`${options.origin}, ${context}`); } catch {}
    await wait(1100);
    try { destination = await geocode(`${options.destination}, Iraq`); } catch {}

    window.L.marker(origin, { icon: marker(options.studentInitial || 'S') }).addTo(map).bindTooltip(options.origin);
    window.L.marker(destination, { icon: marker('U', true) }).addTo(map).bindTooltip(options.destination);
    let route;
    try { route = await routeBetween(origin, destination); } catch {}
    const journeyLine = window.L.polyline(route?.length ? route : [origin, destination], { color: '#087bff', weight: 6, opacity: .9, lineCap: 'round' }).addTo(map);
    window.L.polyline(route?.length ? route : [origin, destination], { color: '#ffffff', weight: 2, opacity: .85, dashArray: '3 9' }).addTo(map);
    map.fitBounds(journeyLine.getBounds(), { padding: [55, 55], maxZoom: 14 });
  };

  window.DarbJourneyMap = {
    init(options) {
      const container = document.getElementById('sceneMap');
      if (!container || map) return;
      if (demoJourney(options)) {
        localJourney(container, options);
        return;
      }
      if (!window.L) return;
      container.replaceChildren();
      const center = centers[options.governorate] || centers.baghdad;
      map = window.L.map(container, { zoomControl: true, attributionControl: true, scrollWheelZoom: false }).setView(center, 12);
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);
      drawJourney(options);
    }
  };
})();
