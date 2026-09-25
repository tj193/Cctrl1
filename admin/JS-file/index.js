const API_BASE_URL = ["localhost", "127.0.0.1"].includes(window.location.hostname)
    ? `http://${window.location.hostname}:8000` : window.location.origin;

const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[character]);
const safeRecord = value => Array.isArray(value) ? value.map(safeRecord)
    : value && typeof value === "object"
        ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, safeRecord(item)]))
        : typeof value === "string" ? escapeHtml(value) : value;

document.addEventListener("DOMContentLoaded", () => {
    const localHost = ["127.0.0.1", "localhost"].includes(window.location.hostname);
    if (localHost && new URLSearchParams(window.location.search).get("preview") === "1") {
        sessionStorage.setItem("adminPreview", "1");
    }
    const preview = localHost && sessionStorage.getItem("adminPreview") === "1";
    if (preview) {
        const notice = document.createElement("div");
        notice.textContent = "Local preview only — live data and admin actions are unavailable.";
        notice.style.cssText = "padding:12px 20px;background:#fff3cd;color:#664d03;font-weight:600;text-align:center";
        document.body.prepend(notice);
        document.getElementById("logoutBtn")?.addEventListener("click", () => {
            sessionStorage.removeItem("adminPreview");
            window.location.href = "login.html";
        });
        return;
    }
    // 1. Auth Guard: Verify Admin session token
    const token = sessionStorage.getItem("adminToken");
    if (!token) {
        window.location.href = "login.html";
        return;
    }

    // 2. DOM Elements Selection
    // KPI Metric Elements
    const totalStudentsMetric = document.getElementById("totalStudentsMetric");
    const totalDriversMetric = document.getElementById("totalDriversMetric");
    const pendingDriversMetric = document.getElementById("pendingDriversMetric");
    const activeRoutesMetric = document.getElementById("activeRoutesMetric");

    // Table Elements
    const recentApprovalsTableBody = document.getElementById("recentApprovalsTableBody");
    const logoutBtn = document.getElementById("logoutBtn");

    // 3. Fetch Dashboard Summary KPIs
    async function fetchDashboardMetrics() {
        try {
            const response = await fetch(`${API_BASE_URL}/admin/dashboard/metrics`, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                }
            });

            if (response.status === 401 || response.status === 403) {
                sessionStorage.removeItem("adminToken");
                window.location.href = "login.html";
                return;
            }

            if (response.ok) {
                const data = await response.json();
                totalStudentsMetric.textContent = data.total_students ?? 0;
                totalDriversMetric.textContent = data.total_drivers ?? 0;
                pendingDriversMetric.textContent = data.pending_drivers ?? 0;
                activeRoutesMetric.textContent = data.active_routes ?? 0;
            }
        } catch (error) {
            console.error("Error loading dashboard metrics:", error);
        }
    }

    // 4. Fetch Recent Pending Driver Applications
    async function fetchRecentApprovals() {
        try {
            const response = await fetch(`${API_BASE_URL}/admin/dashboard/recent-approvals`, {
                headers: { "Authorization": `Bearer ${token}` }
            });

            if (response.ok) {
                const applications = safeRecord(await response.json());
                renderRecentApprovals(applications);
            } else {
                recentApprovalsTableBody.innerHTML = `<tr><td colspan="6">Failed to load recent applications.</td></tr>`;
            }
        } catch (error) {
            console.error("Error fetching recent approvals:", error);
            recentApprovalsTableBody.innerHTML = `<tr><td colspan="6">Server connection error.</td></tr>`;
        }
    }

    function renderRecentApprovals(applications) {
        recentApprovalsTableBody.innerHTML = "";

        if (applications.length === 0) {
            recentApprovalsTableBody.innerHTML = `<tr><td colspan="6">No pending driver applications.</td></tr>`;
            return;
        }

        applications.forEach(app => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>#${app.id}</td>
                <td>${app.applicant_name}</td>
                <td>${app.vehicle_type || 'N/A'}</td>
                <td>${app.submission_date || 'N/A'}</td>
                <td><strong>${(app.status || 'pending').toUpperCase()}</strong></td>
                <td>
                    <a href="adminApproval.html?id=${app.id}">
                        <button type="button">Review</button>
                    </a>
                </td>
            `;
            recentApprovalsTableBody.appendChild(tr);
        });
    }

    // 6. Logout Functionality
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            sessionStorage.removeItem("adminToken");
            sessionStorage.removeItem("adminEmail");
            window.location.href = "login.html";
        });
    }

    // Initialize Page Data
    fetchDashboardMetrics();
    fetchRecentApprovals();
});
