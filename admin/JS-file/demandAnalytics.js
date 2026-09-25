(() => {
    'use strict';
    const token = sessionStorage.getItem('adminToken');
    const range = document.getElementById('timeRangeFilter');
    const universityFilter = document.getElementById('universityDemandFilter');
    const form = document.getElementById('demandFilterForm');
    const bodies = {
        routes: document.getElementById('topRoutesTableBody'),
        universities: document.getElementById('topUniversitiesTableBody'),
        areas: document.getElementById('topAreasTableBody'),
        times: document.getElementById('peakTimesTableBody'),
    };
    if (!token || !range || Object.values(bodies).some(body => !body)) return;
    const apiBase = ['localhost', '127.0.0.1'].includes(location.hostname)
        ? `http://${location.hostname}:8000` : location.origin;
    const columns = { routes: 5, universities: 3, areas: 3, times: 3 };
    let requests = [];
    const addRow = (body, values) => {
        const row = body.insertRow();
        values.forEach(value => {
            const cell = row.insertCell();
            cell.textContent = String(value ?? '');
        });
    };
    const draw = () => {
        Object.values(bodies).forEach(body => body.replaceChildren());
        const now = new Date();
        const start = new Date(now);
        if (range.value === 'this_week') {
            start.setDate(now.getDate() - ((now.getDay() + 6) % 7));
            start.setHours(0, 0, 0, 0);
        } else if (range.value === 'this_month') {
            start.setDate(1);
            start.setHours(0, 0, 0, 0);
        }
        const visible = requests.filter(item =>
            (range.value === 'all_time' || new Date(item.created_at) >= start)
            && (universityFilter.value === 'all' || String(item.university_id) === universityFilter.value));
        const routes = new Map(), universities = new Map(), areas = new Map(), times = new Map();
        for (const item of visible) {
            const routeKey = `${item.area_id}:${item.university_id}`;
            const route = routes.get(routeKey) || { ...item, count: 0 };
            route.count++;
            routes.set(routeKey, route);
            const university = universities.get(item.university_id) || { name: item.university_name, count: 0, areas: new Set() };
            university.count++;
            if (item.route_exists) university.areas.add(item.area_id);
            universities.set(item.university_id, university);
            const area = areas.get(item.area_id) || { name: item.area_name, governorate: item.governorate, count: 0, unmet: 0 };
            area.count++;
            if (!item.route_exists) area.unmet++;
            areas.set(item.area_id, area);
            if (item.preferred_time) {
                const time = new Date(item.preferred_time);
                if (!Number.isNaN(time.getTime())) {
                    const slot = `${String(time.getHours()).padStart(2, '0')}:00`;
                    const key = `${slot}:${item.university_id}`;
                    const value = times.get(key) || { slot, name: item.university_name, count: 0 };
                    value.count++;
                    times.set(key, value);
                }
            }
        }
        [...routes.values()].sort((a, b) => b.count - a.count).forEach((item, index) =>
            addRow(bodies.routes, [index + 1, `${item.area_name} · ${item.governorate}`, item.university_name, item.count, item.route_exists ? 'Serviced' : 'Unmet']));
        [...universities.values()].sort((a, b) => b.count - a.count).forEach(item =>
            addRow(bodies.universities, [item.name, item.count, item.areas.size]));
        [...areas.values()].sort((a, b) => b.count - a.count).forEach(item =>
            addRow(bodies.areas, [`${item.name} · ${item.governorate}`, item.count, item.unmet]));
        [...times.values()].sort((a, b) => b.count - a.count).forEach(item =>
            addRow(bodies.times, [item.slot, item.name, item.count]));
        Object.entries(bodies).forEach(([key, body]) => {
            if (!body.rows.length) addRow(body, ['No matching requests.', ...Array(columns[key] - 1).fill('')]);
        });
    };
    range.addEventListener('change', draw);
    universityFilter.addEventListener('change', draw);
    form.addEventListener('reset', () => setTimeout(draw, 0));
    fetch(`${apiBase}/admin/route-demand/analytics`, { headers: { Authorization: `Bearer ${token}` } })
        .then(response => response.ok ? response.json() : Promise.reject(new Error('Could not load data.')))
        .then(data => {
            requests = data;
            const names = new Map(data.map(item => [item.university_id, item.university_name]));
            [...names].sort((a, b) => a[1].localeCompare(b[1])).forEach(([id, name]) => universityFilter.add(new Option(name, id)));
            draw();
        })
        .catch(() => Object.entries(bodies).forEach(([key, body]) => addRow(body, ['Could not load data.', ...Array(columns[key] - 1).fill('')])));
})();
