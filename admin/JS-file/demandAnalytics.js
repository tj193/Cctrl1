(() => {
  "use strict";
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
  if (!token || !range || Object.values(bodies).some((body) => !body)) return;
  const apiBase = window.DarbGoAdminApi.baseUrl;
  const columns = { routes: 5, universities: 3, areas: 3, times: 3 };
  let requests = [];
  const createdDate = (value) => {
    if (!value) return null;
    const text = String(value);
    const date = new Date(/[zZ]|[+-]\d\d:\d\d$/.test(text) ? text : `${text}Z`);
    return Number.isNaN(date.getTime()) ? null : date;
  };
  const addRow = (body, values) => {
    const row = body.insertRow();
    values.forEach((value) => {
      const cell = row.insertCell();
      cell.textContent = String(value ?? "");
    });
  };
  const draw = () => {
    Object.values(bodies).forEach((body) => body.replaceChildren());
    const now = new Date();
    const start = new Date(now);
    if (range.value === "this_week") {
      start.setDate(now.getDate() - ((now.getDay() + 6) % 7));
      start.setHours(0, 0, 0, 0);
    } else if (range.value === "this_month") {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
    }
    const visible = requests.filter((item) => {
      const date = createdDate(item.created_at);
      return (
        (range.value === "all_time" || (date && date >= start)) &&
        (universityFilter.value === "all" ||
          String(item.university_id) === universityFilter.value)
      );
    });
    const routes = new Map(),
      universities = new Map(),
      areas = new Map(),
      times = new Map();
    for (const item of visible) {
      const routeKey = `${item.area_id}:${item.university_id}`;
      const route = routes.get(routeKey) || { ...item, count: 0 };
      route.count++;
      routes.set(routeKey, route);
      const university = universities.get(item.university_id) || {
        name: item.university_name,
        count: 0,
        areas: new Set(),
      };
      university.count++;
      if (item.route_exists) university.areas.add(item.area_id);
      universities.set(item.university_id, university);
      const area = areas.get(item.area_id) || {
        name: item.area_name,
        governorate: item.governorate,
        count: 0,
        unmet: 0,
      };
      area.count++;
      if (!item.route_exists) area.unmet++;
      areas.set(item.area_id, area);
      if (item.preferred_time) {
        const time = new Date(item.preferred_time);
        if (!Number.isNaN(time.getTime())) {
          const slot = `${String(time.getHours()).padStart(2, "0")}:00`;
          const key = `${slot}:${item.university_id}`;
          const value = times.get(key) || {
            slot,
            name: item.university_name,
            count: 0,
          };
          value.count++;
          times.set(key, value);
        }
      }
    }
    const routeRows = [...routes.values()].sort((a, b) => b.count - a.count);
    const universityRows = [...universities.values()].sort(
      (a, b) => b.count - a.count,
    );
    const areaRows = [...areas.values()].sort((a, b) => b.count - a.count);
    const timeRows = [...times.values()].sort((a, b) => b.count - a.count);
    routeRows.forEach((item, index) =>
      addRow(bodies.routes, [
        index + 1,
        `${item.area_name} · ${item.governorate}`,
        item.university_name,
        item.count,
        item.route_exists ? "Active route exists" : "No active route",
      ]),
    );
    universityRows.forEach((item) =>
      addRow(bodies.universities, [item.name, item.count, item.areas.size]),
    );
    areaRows.forEach((item) =>
      addRow(bodies.areas, [
        `${item.name} · ${item.governorate}`,
        item.count,
        item.unmet,
      ]),
    );
    timeRows.forEach((item) =>
      addRow(bodies.times, [item.slot, item.name, item.count]),
    );
    const chartSets = [
      [
        "analyticsRoutesChart",
        "analyticsRoutesSummary",
        routeRows.slice(0, 7),
        (item) => `${item.area_name} → ${item.university_name}`,
        (item) => item.count,
        "bar",
        { horizontal: true },
      ],
      [
        "analyticsUniversitiesChart",
        "analyticsUniversitiesSummary",
        universityRows.slice(0, 7),
        (item) => item.name,
        (item) => item.count,
        "bar",
        { horizontal: true },
      ],
      [
        "analyticsAreasChart",
        "analyticsAreasSummary",
        areaRows.filter((item) => item.unmet).slice(0, 7),
        (item) => item.name,
        (item) => item.unmet,
        "bar",
        { horizontal: true },
      ],
      [
        "analyticsTimesChart",
        "analyticsTimesSummary",
        timeRows.slice(0, 12),
        (item) => `${item.slot} · ${item.name}`,
        (item) => item.count,
        "bar",
        { horizontal: true },
      ],
    ];
    chartSets.forEach(([id, summary, items, label, value, type, options]) => {
      const plotted = window.DarbGoCharts?.draw(
        id,
        type,
        items.map(label),
        [{ label: "Requests", data: items.map(value) }],
        options,
      );
      document.getElementById(summary).textContent = items.length
        ? `${visible.length} active demand requests in the selected filters.${plotted ? "" : " Chart unavailable."}`
        : "No matching data for this chart.";
    });
    const unavailableTimes = visible.filter(
      (item) =>
        !item.preferred_time ||
        Number.isNaN(new Date(item.preferred_time).getTime()),
    ).length;
    if (unavailableTimes)
      document.getElementById("analyticsTimesSummary").textContent +=
        ` ${unavailableTimes} request(s) have no usable preferred time.`;
    Object.entries(bodies).forEach(([key, body]) => {
      if (!body.rows.length)
        addRow(body, [
          "No matching requests.",
          ...Array(columns[key] - 1).fill(""),
        ]);
    });
  };
  range.addEventListener("change", draw);
  universityFilter.addEventListener("change", draw);
  form.addEventListener("reset", () => setTimeout(draw, 0));
  window.DarbGoAdminApi.fetchResponse(
    `${apiBase}/admin/route-demand/analytics`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
    .then((response) =>
      response.ok
        ? response.json()
        : Promise.reject(new Error("Could not load data.")),
    )
    .then((data) => {
      requests = data;
      const names = new Map(
        data.map((item) => [item.university_id, item.university_name]),
      );
      [...names]
        .sort((a, b) => a[1].localeCompare(b[1]))
        .forEach(([id, name]) => universityFilter.add(new Option(name, id)));
      draw();
    })
    .catch(() => {
      Object.entries(bodies).forEach(([key, body]) =>
        addRow(body, [
          "Could not load data.",
          ...Array(columns[key] - 1).fill(""),
        ]),
      );
      for (const id of [
        "analyticsRoutesSummary",
        "analyticsUniversitiesSummary",
        "analyticsAreasSummary",
        "analyticsTimesSummary",
      ])
        document.getElementById(id).textContent = "Could not load analytics.";
    });
})();
