(() => {
    "use strict";
    const apiBase = ["localhost", "127.0.0.1"].includes(location.hostname)
        ? `http://${location.hostname}:8000` : location.origin;
    const token = sessionStorage.getItem("adminToken");
    const range = document.getElementById("timeRangeFilter");
    const universityFilter = document.getElementById("universityDemandFilter");
    const form = document.getElementById("demandFilterForm");
    const bodies = {
        routes: document.getElementById("topRoutesTableBody"),
        universities: document.getElementById("topUniversitiesTableBody"),
        areas: document.getElementById("topAreasTableBody"),
        times: document.getElementById("peakTimesTableBody"),
    };
    const columns = { routes: 5, universities: 3, areas: 3, times: 3 };
    const escape = value => String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[char]);
    let requests = [];

    function row(target, values) {
        const tr = document.createElement("tr");
        tr.innerHTML = values.map(value => `<td>${escape(value)}</td>`).join("");
        target.append(tr);
    }

    function render() {
        Object.entries(bodies).forEach(([key, body]) => body.replaceChildren());
        const now = new Date();
        const start = new Date(now);
        if (range.value === "this_week") {
            start.setDate(now.getDate() - ((now.getDay() + 6) % 7));
            start.setHours(0, 0, 0, 0);
        } else if (range.value === "this_month") {
            start.setDate(1);
            start.setHours(0, 0, 0, 0);
        }
        const visible = requests.filter(item =>
            (range.value === "all_time" || new Date(item.created_at) >= start)
            && (universityFilter.value === "all" || String(item.university_id) === universityFilter.value));
        const routes = new Map(), universities = new Map(), areas = new Map(), times = new Map();
        for (const item of visible) {
            const routeKey = `${item.area_id}:${item.university_id}`;
            const route = routes.get(routeKey) || { ...item, count: 0 };
            route.count++;
            routes.set(routeKey, route);
            const university = universities.get(item.university_id) || { name: item.university_name, count: 0, routes: new Set() };
            university.count++;
            if (item.route_exists) university.routes.add(item.area_id);
            universities.set(item.university_id, university);
            const area = areas.get(item.area_id) || { name: item.area_name, governorate: item.governorate, count: 0, unmet: 0 };
            area.count++;
            if (!item.route_exists) area.unmet++;
            areas.set(item.area_id, area);
            if (item.preferred_time) {
                const time = new Date(item.preferred_time);
                if (!Number.isNaN(time.getTime())) {
                    const slot = `${String(time.getHours()).padStart(2, "0")}:00`;
                    const key = `${slot}:${item.university_id}`;
                    const entry = times.get(key) || { slot, name: item.university_name, count: 0 };
                    entry.count++;
                    times.set(key, entry);
                }
            }
        }
        [...routes.values()].sort((a, b) => b.count - a.count).forEach((item, index) =>
            row(bodies.routes, [index + 1, `${item.area_name} · ${item.governorate}`, item.university_name, item.count, item.route_exists ? "Serviced" : "Unmet"]));
        [...universities.values()].sort((a, b) => b.count - a.count).forEach(item =>
            row(bodies.universities, [item.name, item.count, item.routes.size]));
        [...areas.values()].sort((a, b) => b.count - a.count).forEach(item =>
            row(bodies.areas, [`${item.name} · ${item.governorate}`, item.count, item.unmet]));
        [...times.values()].sort((a, b) => b.count - a.count).forEach(item =>
            row(bodies.times, [item.slot, item.name, item.count]));
        Object.entries(bodies).forEach(([key, body]) => {
            if (!body.children.length) row(body, ["No matching requests.", ...Array(columns[key] - 1).fill("")]);
        });
    }

    async function load() {
        if (!token) return;
        try {
            const response = await fetch(`${apiBase}/admin/route-demand/analytics`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!response.ok) throw new Error("Could not load route demand.");
            requests = await response.json();
            const names = new Map(requests.map(item => [item.university_id, item.university_name]));
            [...names].sort((a, b) => a[1].localeCompare(b[1])).forEach(([id, name]) => {
                const option = new Option(name, id);
                universityFilter.add(option);
            });
            render();
        } catch {
            Object.entries(bodies).forEach(([key, body]) => row(body, ["Could not load data.", ...Array(columns[key] - 1).fill("")]));
        }
    }
    range.addEventListener("change", render);
    universityFilter.addEventListener("change", render);
    form.addEventListener("reset", () => setTimeout(render, 0));
    load();
})();
