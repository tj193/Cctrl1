(() => {
  "use strict";
  const base = window.DarbGoAdminApi.baseUrl;
  const token = sessionStorage.getItem("adminToken");
  if (
    ["localhost", "127.0.0.1"].includes(location.hostname) &&
    new URLSearchParams(location.search).get("preview") === "1"
  ) {
    sessionStorage.setItem("adminPreview", "1");
  }
  const preview =
    ["localhost", "127.0.0.1"].includes(location.hostname) &&
    sessionStorage.getItem("adminPreview") === "1";
  const $ = (id) => document.getElementById(id);
  async function get(path) {
    const response = await window.DarbGoAdminApi.fetchResponse(
      `${base}${path}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if ([401, 403].includes(response.status)) {
      sessionStorage.removeItem("adminToken");
      location.href = "login.html";
      throw Error("Session expired");
    }
    if (!response.ok) throw Error(`Request failed (${response.status})`);
    return response.json();
  }
  function set(id, text) {
    $(id).textContent = text;
  }
  function attention(id, rows, title, info, url, empty) {
    const list = $(id);
    list.replaceChildren();
    if (!rows.length) {
      const li = document.createElement("li");
      li.textContent = empty;
      list.append(li);
      return;
    }
    for (const row of rows) {
      const li = document.createElement("li"),
        detail = document.createElement("div"),
        name = document.createElement("strong"),
        small = document.createElement("small"),
        link = document.createElement("a");
      name.textContent = title(row);
      small.textContent = info(row);
      link.textContent =
        id === "recentApprovalsList" ? "Review →" : "Investigate →";
      link.href = `${url}?id=${encodeURIComponent(row.id)}`;
      detail.append(name, small);
      li.append(detail, link);
      list.append(li);
    }
  }
  function dated(value) {
    const text = String(value || "");
    const date = new Date(/[zZ]|[+-]\d\d:\d\d$/.test(text) ? text : `${text}Z`);
    return value && !Number.isNaN(date.getTime()) ? date : null;
  }
  function activity(items, days) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const labels = [],
      counts = [];
    for (let offset = days - 1; offset >= 0; offset--) {
      const day = new Date(today);
      day.setDate(today.getDate() - offset);
      const next = new Date(day);
      next.setDate(day.getDate() + 1);
      labels.push(
        day.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      );
      counts.push(
        items.filter((item) => {
          const date = dated(item.created_at);
          return date && date >= day && date < next;
        }).length,
      );
    }
    const count = counts.reduce((a, b) => a + b, 0);
    const chart = window.DarbGoCharts?.draw("activityChart", "line", labels, [
      {
        label: "Requests",
        data: counts,
        backgroundColor: "#eaf2ff",
        borderColor: "#146ff5",
      },
    ]);
    set(
      "activitySummary",
      count
        ? `${count} active demand requests created in this period.${chart ? "" : " Chart unavailable."}`
        : "No dated requests in this period.",
    );
  }
  document.addEventListener("DOMContentLoaded", () => {
    if (!preview && !token) {
      location.href = "login.html";
      return;
    }
    $("logoutBtn")?.addEventListener("click", () => {
      sessionStorage.removeItem("adminPreview");
      sessionStorage.removeItem("adminToken");
      sessionStorage.removeItem("adminEmail");
      location.href = "login.html";
    });
    if (preview) {
      for (const id of ["activitySummary", "routesSummary", "occupancySummary"])
        set(id, "Local preview: live data and admin actions are unavailable.");
      for (const id of ["recentApprovalsList", "recentReportsList"])
        set(id, "Local preview: no live data.");
      return;
    }
    get("/admin/dashboard/metrics")
      .then((data) => {
        for (const [id, key] of [
          ["totalStudentsMetric", "total_students"],
          ["totalDriversMetric", "total_drivers"],
          ["pendingDriversMetric", "pending_drivers"],
          ["activeRoutesMetric", "active_routes"],
          ["openReportsMetric", "open_reports"],
        ])
          set(id, data[key] ?? "—");
      })
      .catch(() => {
        for (const id of [
          "totalStudentsMetric",
          "totalDriversMetric",
          "pendingDriversMetric",
          "activeRoutesMetric",
          "openReportsMetric",
        ])
          set(id, "Unavailable");
      });
    get("/admin/dashboard/recent-approvals")
      .then((rows) =>
        attention(
          "recentApprovalsList",
          rows,
          (x) => x.applicant_name || x.full_name || `Application #${x.id}`,
          (x) =>
            `${x.vehicle_type || "Vehicle unknown"} · ${dated(x.submission_date)?.toLocaleDateString() || "Date unavailable"}`,
          "adminApproval.html",
          "No pending driver applications.",
        ),
      )
      .catch(() => set("recentApprovalsList", "Could not load applications."));
    get("/admin/dashboard/recent-reports")
      .then((rows) =>
        attention(
          "recentReportsList",
          rows,
          (x) => x.subject || `Report #${x.id}`,
          (x) =>
            `${x.reporter_name || "Unknown reporter"} · ${x.status || "Status unavailable"}`,
          "adminReports.html",
          "No open reports.",
        ),
      )
      .catch(() => set("recentReportsList", "Could not load reports."));
    get("/admin/route-demand/analytics")
      .then((rows) => {
        const range = $("activityRange"),
          draw = () => activity(rows, Number(range.value));
        range.addEventListener("change", draw);
        draw();
        const groups = new Map();
        for (const row of rows) {
          const key = `${row.area_id}:${row.university_id}`;
          const group = groups.get(key) || {
            label: `${row.area_name || "Unknown"} → ${row.university_name || "Unknown"}`,
            count: 0,
            serviced: false,
          };
          group.count++;
          group.serviced ||= !!row.route_exists;
          groups.set(key, group);
        }
        const top = [...groups.values()]
          .sort((a, b) => b.count - a.count)
          .slice(0, 6);
        if (!top.length) {
          window.DarbGoCharts?.draw("routesChart", "bar", [], []);
          set("routesSummary", "No active demand requests available.");
          return;
        }
        const chart = window.DarbGoCharts?.draw(
          "routesChart",
          "bar",
          top.map((x) => x.label),
          [
            {
              label: "Requests",
              data: top.map((x) => x.count),
              backgroundColor: top.map((x) =>
                x.serviced ? "#15b7a4" : "#f08a4b",
              ),
            },
          ],
          { horizontal: true },
        );
        set(
          "routesSummary",
          `Top ${top.length} origin and university pairs. Teal: active route exists; orange: no active route.${chart ? "" : " Chart unavailable."}`,
        );
      })
      .catch(() => {
        set("activitySummary", "Could not load request activity.");
        set("routesSummary", "Could not load route demand.");
      });
    get("/admin/routes")
      .then((rows) => {
        const valid = rows
          .filter(
            (x) =>
              Number.isFinite(Number(x.max_capacity)) &&
              Number(x.max_capacity) > 0 &&
              Number.isFinite(Number(x.enrolled_students)) &&
              Number(x.enrolled_students) >= 0,
          )
          .slice(0, 6);
        if (!valid.length) {
          window.DarbGoCharts?.draw("occupancyChart", "bar", [], []);
          set("occupancySummary", "No routes with valid capacity data.");
          return;
        }
        const occupied = valid.map((x) =>
          Math.min(Number(x.enrolled_students), Number(x.max_capacity)),
        );
        const available = valid.map((x, i) =>
          Math.max(0, Number(x.max_capacity) - occupied[i]),
        );
        const chart = window.DarbGoCharts?.draw(
          "occupancyChart",
          "bar",
          valid.map((x) => `Route #${x.id}`),
          [
            { label: "Occupied", data: occupied },
            { label: "Available", data: available },
          ],
          { stacked: true },
        );
        const inconsistent = valid.filter(
          (x) => Number(x.enrolled_students) > Number(x.max_capacity),
        ).length;
        set(
          "occupancySummary",
          `Showing ${valid.length} routes with capacity data.${inconsistent ? ` ${inconsistent} over-capacity record(s) capped in the chart.` : ""}${chart ? "" : " Chart unavailable."}`,
        );
      })
      .catch(() => set("occupancySummary", "Could not load occupancy data."));
  });
})();
