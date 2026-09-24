(() => {
  'use strict';

  const centers = {
    baghdad: [33.3152, 44.3661], basra: [30.5085, 47.7804], nineveh: [36.34, 43.13], anbar: [33.43, 43.3],
    babil: [32.47, 44.42], karbala: [32.61, 44.02], najaf: [32.0, 44.33], diyala: [33.75, 44.63],
    kirkuk: [35.47, 44.39], erbil: [36.19, 44.01], sulaymaniyah: [35.56, 45.43], duhok: [36.86, 42.99]
  };
  let map;

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
      if (!container || !window.L || map) return;
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
