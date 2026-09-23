const API_BASE_URL = "http://127.0.0.1:8000";

document.addEventListener("DOMContentLoaded", () => {
    // 1. Auth Guard: Verify Admin session token
    const token = localStorage.getItem("adminToken");
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
    const openReportsMetric = document.getElementById("openReportsMetric");

    // Table Elements
    const recentApprovalsTableBody = document.getElementById("recentApprovalsTableBody");
    const recentReportsTableBody = document.getElementById("recentReportsTableBody");
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
                localStorage.removeItem("adminToken");
                window.location.href = "login.html";
                return;
            }

            if (response.ok) {
                const data = await response.json();
                totalStudentsMetric.textContent = data.total_students ?? 0;
                totalDriversMetric.textContent = data.total_drivers ?? 0;
                pendingDriversMetric.textContent = data.pending_drivers ?? 0;
                activeRoutesMetric.textContent = data.active_routes ?? 0;
                openReportsMetric.textContent = data.open_reports ?? 0;
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
                const applications = await response.json();
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

    // 5. Fetch Urgent Complaints & Reports
    async function fetchRecentReports() {
        try {
            const response = await fetch(`${API_BASE_URL}/admin/dashboard/recent-reports`, {
                headers: { "Authorization": `Bearer ${token}` }
            });

            if (response.ok) {
                const reports = await response.json();
                renderRecentReports(reports);
            } else {
                recentReportsTableBody.innerHTML = `<tr><td colspan="6">Failed to load urgent reports.</td></tr>`;
            }
        } catch (error) {
            console.error("Error fetching recent reports:", error);
            recentReportsTableBody.innerHTML = `<tr><td colspan="6">Server connection error.</td></tr>`;
        }
    }

    function renderRecentReports(reports) {
        recentReportsTableBody.innerHTML = "";

        if (reports.length === 0) {
            recentReportsTableBody.innerHTML = `<tr><td colspan="6">No urgent open complaints or reports.</td></tr>`;
            return;
        }

        reports.forEach(report => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>#${report.id}</td>
                <td>${report.reporter_name} (${report.reporter_role || 'User'})</td>
                <td>${report.subject}</td>
                <td>${report.created_at || 'N/A'}</td>
                <td><strong>${(report.status || 'open').toUpperCase()}</strong></td>
                <td>
                    <a href="adminReports.html?id=${report.id}">
                        <button type="button">Investigate</button>
                    </a>
                </td>
            `;
            recentReportsTableBody.appendChild(tr);
        });
    }

    // 6. Logout Functionality
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            localStorage.removeItem("adminToken");
            localStorage.removeItem("adminEmail");
            window.location.href = "login.html";
        });
    }

    // Initialize Page Data
    fetchDashboardMetrics();
    fetchRecentApprovals();
    fetchRecentReports();
});