(() => {
  'use strict';
  // Fictional, driver-only preview records. No API request or cross-role storage uses them.
  window.DarbDriverDemo = {
    routes: [
      { id: 'demo-route-1', areaId: 101, universityId: 201, area: 'Sample North', university: 'Sample University', stops: ['Sample Square'], departure: '07:15', returnTime: '14:30', capacity: 12, price: 45000, status: 'Active' },
      { id: 'demo-route-2', areaId: 102, universityId: 201, area: 'Sample West', university: 'Sample University', stops: [], departure: '08:00', returnTime: '15:00', capacity: 8, price: 35000, status: 'Active' },
    ],
    requests: [
      { id: 'demo-request-1', student: 'Sample Student A', area: 'Sample North', routeId: 'demo-route-1', requestedAt: '2026-10-01', time: '07:15', status: 'Pending' },
      { id: 'demo-request-2', student: 'Sample Student B', area: 'Sample West', routeId: 'demo-route-2', requestedAt: '2026-10-02', time: '08:00', status: 'Pending' },
      { id: 'demo-request-3', student: 'Sample Student C', area: 'Sample North', routeId: 'demo-route-1', requestedAt: '2026-10-03', time: '07:15', status: 'Accepted' },
    ],
    demand: [
      { id: 'demo-demand-1', areaId: 101, universityId: 201, area: 'Sample North', university: 'Sample University', count: 9, time: '07:00–07:30', serviced: true },
      { id: 'demo-demand-2', areaId: 103, universityId: 202, area: 'Sample East', university: 'Sample College', count: 14, time: '06:30–07:00', serviced: false },
    ],
    areas: [{ id: 101, name: 'Sample North' }, { id: 102, name: 'Sample West' }, { id: 103, name: 'Sample East' }],
    universities: [{ id: 201, name: 'Sample University' }, { id: 202, name: 'Sample College' }],
  };
})();
