const API_BASE_URL = ["localhost", "127.0.0.1"].includes(window.location.hostname)
    ? `http://${window.location.hostname}:8000` : window.location.origin;

const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[character]);
const safeRecord = value => Array.isArray(value) ? value.map(safeRecord)
    : value && typeof value === "object"
        ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, key.endsWith("_url") ? item : safeRecord(item)]))
        : typeof value === "string" ? escapeHtml(value) : value;
const documentLink = url => {
    if (!url) return "Not uploaded";
    try {
        const parsed = new URL(url, window.location.origin);
        if (!["http:", "https:"].includes(parsed.protocol)) return "Unavailable";
        return `<a href="${escapeHtml(parsed.href)}" target="_blank" rel="noopener noreferrer">View Document</a>`;
    } catch { return "Unavailable"; }
};

document.addEventListener("DOMContentLoaded", () => {
    const localHost = ["127.0.0.1", "localhost"].includes(window.location.hostname);
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
    // 1. Global Auth Guard: Check Admin Session Token
    const token = sessionStorage.getItem("adminToken");
    if (!token) {
        window.location.href = "login.html";
        return;
    }

    // 2. Global Logout Handler
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            sessionStorage.removeItem("adminToken");
            sessionStorage.removeItem("adminEmail");
            window.location.href = "login.html";
        });
    }

    // Identify current page by unique table or body elements
    if (document.getElementById("approvalTableBody")) initDriverApprovals();
    if (document.getElementById("demandTableBody")) initRouteDemand();
    if (document.getElementById("driversTableBody")) initDriversManagement();
    if (document.getElementById("reportsTableBody")) initReportsManagement();
    if (document.getElementById("routesTableBody")) initRoutesManagement();
    if (document.getElementById("studentsTableBody")) initStudentsManagement();
    if (document.getElementById("universitiesTableBody")) initUniversitiesAndAreas();
    if (document.getElementById("adminProfileForm")) initSettings();

    // ==========================================
    // 1. DRIVER APPROVALS MODULE
    // ==========================================
    function initDriverApprovals() {
        const approvalTableBody = document.getElementById("approvalTableBody");
        const approvalModal = document.getElementById("approvalModal");
        const closeModalBtn = document.getElementById("closeModalBtn");
        const applicantDetailsSection = document.getElementById("applicantDetailsSection");
        const documentsSection = document.getElementById("documentsSection");
        const modalApplicationId = document.getElementById("modalApplicationId");
        const adminNotes = document.getElementById("adminNotes");
        const approveBtn = document.getElementById("approveBtn");
        const rejectBtn = document.getElementById("rejectBtn");
        const searchInput = document.getElementById("searchApplicantInput");
        const statusFilter = document.getElementById("approvalStatusFilter");
        const filterForm = document.getElementById("approvalsFilterForm");
        const decisionForm = document.getElementById("approvalDecisionForm");
        const decisionPanel = document.getElementById("decisionMessagePanel");
        const decisionTitle = document.getElementById("decisionMessageTitle");
        const decisionPhone = document.getElementById("decisionMessagePhone");
        const decisionPreview = document.getElementById("decisionMessagePreview");
        const whatsAppLink = document.getElementById("whatsAppDecisionLink");
        let allApplications = [];

        function whatsAppNumber(value) {
            const digits = String(value || "")
                .replace(/[٠-٩]/g, digit => "٠١٢٣٤٥٦٧٨٩".indexOf(digit))
                .replace(/[^\d+]/g, "")
                .replace(/^\+|^00/, "")
                .replace(/^0(?=7)/, "964");
            return /^9647\d{9}$/.test(digits) ? digits : "";
        }

        function showDecisionMessage(app) {
            const status = String(app.status || "").toLowerCase();
            const decided = status === "approved" || status === "rejected";
            decisionForm.hidden = decided;
            decisionPanel.hidden = !decided;
            if (!decided) return;
            decisionTitle.textContent = status === "approved" ? "Approval saved" : "Rejection saved";
            decisionPhone.textContent = `Driver number: ${app.phone || "Not provided"}`;
            decisionPreview.value = status === "approved"
                ? `Your DarbGo driver application #${app.id} has been approved. You can now sign in with your email or mobile number and password.`
                : `Your DarbGo driver application #${app.id} was not approved. Reason: ${app.rejection_reason || "Please contact the admin for details."}`;
            const phone = whatsAppNumber(app.phone);
            whatsAppLink.hidden = !phone;
            if (phone) whatsAppLink.href = `https://wa.me/${phone}?text=${encodeURIComponent(decisionPreview.value)}`;
            else whatsAppLink.removeAttribute("href");
        }
        document.getElementById("copyDecisionMessageBtn").addEventListener("click", () =>
            navigator.clipboard.writeText(decisionPreview.value));

        function applyFilters() {
            const query = searchInput.value.trim().toLowerCase();
            const status = statusFilter.value;
            renderApplications(allApplications.filter(app =>
                (status === "all" || app.status.toLowerCase() === status) &&
                [app.full_name, app.phone, app.vehicle_type, app.vehicle_model, app.plate_number]
                    .some(value => String(value || "").toLowerCase().includes(query))));
        }
        searchInput.addEventListener("input", applyFilters);
        statusFilter.addEventListener("change", applyFilters);
        filterForm.addEventListener("reset", () => setTimeout(applyFilters, 0));

        async function fetchApplications() {
            try {
                const response = await fetch(`${API_BASE_URL}/admin/driver-applications`, {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                if (response.ok) {
                    allApplications = safeRecord(await response.json());
                    applyFilters();
                } else {
                    approvalTableBody.innerHTML = `<tr><td colspan="7">Failed to load applications.</td></tr>`;
                }
            } catch (err) {
                approvalTableBody.innerHTML = `<tr><td colspan="7">Server connection error.</td></tr>`;
            }
        }

        function renderApplications(apps) {
            approvalTableBody.innerHTML = "";
            if (apps.length === 0) {
                approvalTableBody.innerHTML = `<tr><td colspan="7">No matching applications.</td></tr>`;
                return;
            }
            apps.forEach(app => {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td>#${app.id}</td>
                    <td>${app.full_name}<br><small>${app.phone || ''}</small></td>
                    <td>${app.vehicle_type} (${app.vehicle_model})</td>
                    <td>${app.plate_number}</td>
                    <td>${app.submission_date}</td>
                    <td><strong>${(app.status || 'pending').toUpperCase()}</strong></td>
                    <td><button type="button" class="review-btn" data-id="${app.id}">Review</button></td>
                `;
                approvalTableBody.appendChild(tr);
            });

            document.querySelectorAll(".review-btn").forEach(btn => {
                btn.addEventListener("click", (e) => openModal(e.target.getAttribute("data-id")));
            });
        }

        function openModal(id) {
            const app = allApplications.find(a => a.id == id);
            if (!app) return;

            modalApplicationId.value = app.id;
            adminNotes.value = app.rejection_reason || "";
            showDecisionMessage(app);
            applicantDetailsSection.innerHTML = `
                <p><strong>Name:</strong> ${app.full_name}</p>
                <p><strong>Phone:</strong> ${app.phone}</p>
                <p><strong>Vehicle:</strong> ${app.vehicle_type} - ${app.vehicle_model}</p>
                <p><strong>Plate Number:</strong> ${app.plate_number}</p>
                <p><strong>License Number:</strong> ${app.license_number || 'Not recorded'}</p>
                <p><strong>National ID Number:</strong> ${app.national_id || 'Not recorded'}</p>
                <p><strong>Capacity:</strong> ${app.capacity ?? 'Not recorded'}</p>
            `;
            documentsSection.innerHTML = `
                <p><strong>License:</strong> ${documentLink(app.license_url)}</p>
                <p><strong>Identity Card:</strong> ${documentLink(app.id_card_url)}</p>
            `;
            approvalModal.removeAttribute("hidden");
        }

        closeModalBtn.addEventListener("click", () => approvalModal.setAttribute("hidden", "true"));
        approveBtn.addEventListener("click", () => updateStatus("approve"));
        rejectBtn.addEventListener("click", () => updateStatus("reject"));

        async function updateStatus(action) {
            const id = modalApplicationId.value;
            const notes = adminNotes.value.trim();
            if (action === "reject" && !notes) {
                alert("Please enter a reason for rejection.");
                return;
            }
            const status = action === "approve" ? "approved" : "rejected";
            try {
                const response = await fetch(`${API_BASE_URL}/admin/driver-applications/${id}/status`, {
                    method: "PATCH",
                    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
                    body: JSON.stringify({ status, notes })
                });
                if (response.ok) {
                    const app = allApplications.find(item => String(item.id) === String(id));
                    if (app) {
                        app.status = status;
                        app.rejection_reason = status === "rejected" ? notes : null;
                        showDecisionMessage(app);
                    }
                    fetchApplications();
                } else {
                    const error = await response.json().catch(() => ({}));
                    alert(error.detail || "The decision could not be saved.");
                }
            } catch (err) {
                alert("Server error.");
            }
        }
        fetchApplications();
    }

    // ==========================================
    // 2. ROUTE DEMAND MODULE
    // ==========================================
    function initRouteDemand() {
        const demandTableBody = document.getElementById("demandTableBody");
        const createRouteModal = document.getElementById("createRouteModal");
        const closeRouteModalBtn = document.getElementById("closeRouteModalBtn");
        const modalAreaName = document.getElementById("modalAreaName");
        const modalUniversityName = document.getElementById("modalUniversityName");
        const modalDemandCount = document.getElementById("modalDemandCount");
        const modalAreaId = document.getElementById("modalAreaId");
        const modalUniversityId = document.getElementById("modalUniversityId");
        const driverSelect = document.getElementById("driverSelect");
        const routeCapacityInput = document.getElementById("routeCapacityInput");
        const confirmCreateRouteForm = document.getElementById("confirmCreateRouteForm");
        let allDemand = [];

        async function fetchDemand() {
            try {
                const response = await fetch(`${API_BASE_URL}/admin/route-demand`, {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                if (response.ok) {
                    allDemand = await response.json();
                    renderDemand(allDemand);
                }
            } catch (err) {
                demandTableBody.innerHTML = `<tr><td colspan="7">Server error.</td></tr>`;
            }
        }

        function renderDemand(demands) {
            demandTableBody.innerHTML = "";
            if (demands.length === 0) {
                demandTableBody.innerHTML = `<tr><td colspan="7">No route demand records found.</td></tr>`;
                return;
            }
            demands.forEach(raw => {
                const d = safeRecord(raw);
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td>#${d.id}</td>
                    <td>${d.area_name}</td>
                    <td>${d.university_name}</td>
                    <td><strong>${d.student_count} Students</strong></td>
                    <td>${d.route_exists ? 'Active Route' : 'Unserviced'}</td>
                    <td>${d.status || 'Active'}</td>
                    <td>
                        <button type="button" class="create-route-btn" data-id="${d.id}">Create Route</button>
                    </td>
                `;
                demandTableBody.appendChild(tr);
            });

            document.querySelectorAll(".create-route-btn").forEach(btn => {
                btn.addEventListener("click", (e) => openModal(e.target.getAttribute("data-id")));
            });
        }

        async function openModal(demandId) {
            const item = allDemand.find(d => d.id == demandId);
            if (!item) return;

            modalAreaName.textContent = item.area_name;
            modalUniversityName.textContent = item.university_name;
            modalDemandCount.textContent = item.student_count;
            modalAreaId.value = item.area_id;
            modalUniversityId.value = item.university_id;

            // Fetch Drivers
            const res = await fetch(`${API_BASE_URL}/admin/available-drivers`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) {
                const drivers = await res.json();
                driverSelect.innerHTML = `<option value="">-- Select Driver --</option>`;
                drivers.forEach(drv => {
                    driverSelect.innerHTML += `<option value="${drv.id}">${escapeHtml(drv.name)} (Cap: ${drv.capacity ?? 'N/A'})</option>`;
                });
            }
            createRouteModal.removeAttribute("hidden");
        }

        closeRouteModalBtn.addEventListener("click", () => createRouteModal.setAttribute("hidden", "true"));

        confirmCreateRouteForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            try {
                const res = await fetch(`${API_BASE_URL}/admin/routes`, {
                    method: "POST",
                    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
                    body: JSON.stringify({
                        area_id: modalAreaId.value,
                        university_id: modalUniversityId.value,
                        driver_id: driverSelect.value,
                        capacity: routeCapacityInput.value
                    })
                });
                if (res.ok) {
                    alert("Route created successfully!");
                    createRouteModal.setAttribute("hidden", "true");
                    fetchDemand();
                }
            } catch (err) {
                alert("Server error.");
            }
        });

        fetchDemand();
    }

    // ==========================================
    // 3. DRIVERS MANAGEMENT MODULE
    // ==========================================
    function initDriversManagement() {
        const driversTableBody = document.getElementById("driversTableBody");
        const driverModal = document.getElementById("driverModal");
        const closeModalBtn = document.getElementById("closeDriverModalBtn");
        const driverDetailsSection = document.getElementById("driverDetailsSection");
        const modalDriverId = document.getElementById("modalDriverId");
        const adminNotes = document.getElementById("driverAdminNotes");
        const suspendDriverBtn = document.getElementById("suspendDriverBtn");
        const activateDriverBtn = document.getElementById("reactivateDriverBtn");
        const searchInput = document.getElementById("searchDriverInput");
        const statusFilter = document.getElementById("statusFilter");
        const verificationFilter = document.getElementById("verificationFilter");
        const filterForm = document.getElementById("driverFilterForm");
        let allDrivers = [];

        function applyFilters() {
            const query = searchInput.value.trim().toLowerCase();
            renderDrivers(allDrivers.filter(driver =>
                (statusFilter.value === "all" || driver.status.toLowerCase() === statusFilter.value) &&
                (verificationFilter.value === "all" || (verificationFilter.value === "verified" ? driver.verification_status === "Approved" : driver.verification_status !== "Approved")) &&
                [driver.full_name, driver.phone, driver.vehicle_type, driver.plate_number]
                    .some(value => String(value || "").toLowerCase().includes(query))));
        }
        searchInput.addEventListener("input", applyFilters);
        statusFilter.addEventListener("change", applyFilters);
        verificationFilter.addEventListener("change", applyFilters);
        filterForm.addEventListener("reset", () => setTimeout(applyFilters, 0));

        async function fetchDrivers() {
            try {
                const res = await fetch(`${API_BASE_URL}/admin/drivers`, {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                if (res.ok) {
                    allDrivers = safeRecord(await res.json());
                    applyFilters();
                }
            } catch (err) {
                driversTableBody.innerHTML = `<tr><td colspan="8">Server error.</td></tr>`;
            }
        }

        function renderDrivers(drivers) {
            driversTableBody.innerHTML = "";
            if (!drivers.length) {
                driversTableBody.innerHTML = `<tr><td colspan="8">No matching approved drivers.</td></tr>`;
                return;
            }
            drivers.forEach(drv => {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td>#${drv.id}</td>
                    <td>${drv.full_name}<br><small>${drv.phone}</small></td>
                    <td>${drv.vehicle_type} (${drv.plate_number})</td>
                    <td>${drv.verification_status}</td>
                    <td>${drv.route_count}</td>
                    <td>${drv.student_count}</td>
                    <td><strong>${(drv.status || 'active').toUpperCase()}</strong></td>
                    <td><button type="button" class="view-btn" data-id="${drv.id}">Manage Profile</button></td>
                `;
                driversTableBody.appendChild(tr);
            });

            document.querySelectorAll(".view-btn").forEach(btn => {
                btn.addEventListener("click", (e) => openModal(e.target.getAttribute("data-id")));
            });
        }

        function openModal(id) {
            const drv = allDrivers.find(d => d.id == id);
            if (!drv) return;

            modalDriverId.value = drv.id;
            driverDetailsSection.innerHTML = `
                <p><strong>Name:</strong> ${drv.full_name}</p>
                <p><strong>Phone:</strong> ${drv.phone}</p>
                <p><strong>Vehicle:</strong> ${drv.vehicle_type} (${drv.plate_number})</p>
                <p><strong>Verification:</strong> ${drv.verification_status}</p>
                <p><strong>Routes:</strong> ${drv.route_count}</p>
                <p><strong>Students:</strong> ${drv.student_count}</p>
                <p><strong>Status:</strong> ${drv.status || 'Active'}</p>
            `;
            driverModal.removeAttribute("hidden");
            suspendDriverBtn.hidden = drv.status.toLowerCase() === "suspended";
            activateDriverBtn.hidden = drv.status.toLowerCase() === "active";
        }

        closeModalBtn.addEventListener("click", () => driverModal.setAttribute("hidden", "true"));
        suspendDriverBtn.addEventListener("click", () => updateStatus("suspend"));
        activateDriverBtn.addEventListener("click", () => updateStatus("activate"));

        async function updateStatus(action) {
            const id = modalDriverId.value;
            const notes = adminNotes.value.trim();
            const status = action === "suspend" ? "suspended" : "active";
            try {
                const res = await fetch(`${API_BASE_URL}/admin/drivers/${id}/status`, {
                    method: "PATCH",
                    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
                    body: JSON.stringify({ status, notes })
                });
                if (res.ok) {
                    alert(`Driver status set to ${status}.`);
                    driverModal.setAttribute("hidden", "true");
                    fetchDrivers();
                }
            } catch (err) {
                alert("Server error.");
            }
        }
        fetchDrivers();
    }

    // ==========================================
    // 4. REPORTS & COMPLAINTS MODULE
    // ==========================================
    function initReportsManagement() {
        const reportsTableBody = document.getElementById("reportsTableBody");
        const reportModal = document.getElementById("reportModal");
        const closeModalBtn = document.getElementById("closeModalBtn");
        const reportDetailsSection = document.getElementById("reportDetailsSection");
        const modalReportId = document.getElementById("modalReportId");
        const resolutionNotes = document.getElementById("resolutionNotes");
        const resolveReportBtn = document.getElementById("resolveReportBtn");
        const dismissReportBtn = document.getElementById("dismissReportBtn");
        let allReports = [];

        async function fetchReports() {
            try {
                const res = await fetch(`${API_BASE_URL}/admin/reports`, {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                if (res.ok) {
                    allReports = safeRecord(await res.json());
                    renderReports(allReports);
                }
            } catch (err) {
                reportsTableBody.innerHTML = `<tr><td colspan="7">Server error.</td></tr>`;
            }
        }

        function renderReports(reports) {
            reportsTableBody.innerHTML = "";
            reports.forEach(rep => {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td>#${rep.id}</td>
                    <td>${rep.reporter_name} (${rep.reporter_role})</td>
                    <td>${rep.reported_target_name || 'N/A'}</td>
                    <td>${rep.subject}</td>
                    <td>${rep.created_at || 'N/A'}</td>
                    <td><strong>${(rep.status || 'open').toUpperCase()}</strong></td>
                    <td><button type="button" class="view-btn" data-id="${rep.id}">Investigate</button></td>
                `;
                reportsTableBody.appendChild(tr);
            });

            document.querySelectorAll(".view-btn").forEach(btn => {
                btn.addEventListener("click", (e) => openModal(e.target.getAttribute("data-id")));
            });
        }

        function openModal(id) {
            const rep = allReports.find(r => r.id == id);
            if (!rep) return;

            modalReportId.value = rep.id;
            reportDetailsSection.innerHTML = `
                <p><strong>Report ID:</strong> #${rep.id}</p>
                <p><strong>Reporter:</strong> ${rep.reporter_name}</p>
                <p><strong>Subject:</strong> ${rep.subject}</p>
                <p><strong>Description:</strong> ${rep.description || 'No detailed description'}</p>
            `;
            reportModal.removeAttribute("hidden");
        }

        closeModalBtn.addEventListener("click", () => reportModal.setAttribute("hidden", "true"));
        resolveReportBtn.addEventListener("click", () => updateReportStatus("resolved"));
        dismissReportBtn.addEventListener("click", () => updateReportStatus("dismissed"));

        async function updateReportStatus(status) {
            const id = modalReportId.value;
            const notes = resolutionNotes.value.trim();
            try {
                const res = await fetch(`${API_BASE_URL}/admin/reports/${id}/status`, {
                    method: "PATCH",
                    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
                    body: JSON.stringify({ status, notes })
                });
                if (res.ok) {
                    alert(`Report #${id} status updated to ${status}.`);
                    reportModal.setAttribute("hidden", "true");
                    fetchReports();
                }
            } catch (err) {
                alert("Server error.");
            }
        }
        fetchReports();
    }

    // ==========================================
    // 5. ROUTES MANAGEMENT MODULE
    // ==========================================
    function initRoutesManagement() {
        const routesTableBody = document.getElementById("routesTableBody");
        const routeModal = document.getElementById("routeModal");
        const closeRouteModalBtn = document.getElementById("closeRouteModalBtn");
        const routeDetailsSection = document.getElementById("routeDetailsSection");
        const modalRouteId = document.getElementById("modalRouteId");
        const routeAdminNotes = document.getElementById("routeAdminNotes");
        const disableRouteBtn = document.getElementById("disableRouteBtn");
        const enableRouteBtn = document.getElementById("enableRouteBtn");
        let allRoutes = [];

        async function fetchRoutes() {
            try {
                const res = await fetch(`${API_BASE_URL}/admin/routes`, {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                if (res.ok) {
                    allRoutes = safeRecord(await res.json());
                    renderRoutes(allRoutes);
                }
            } catch (err) {
                routesTableBody.innerHTML = `<tr><td colspan="9">Server error.</td></tr>`;
            }
        }

        function renderRoutes(routes) {
            routesTableBody.innerHTML = "";
            routes.forEach(r => {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td>#${r.id}</td>
                    <td>${r.driver_name}</td>
                    <td>${r.origin_area}</td>
                    <td>${r.destination_area || 'N/A'}</td>
                    <td>${r.university_name}</td>
                    <td>${r.enrolled_students || 0}</td>
                    <td>${r.max_capacity}</td>
                    <td><strong>${(r.status || 'active').toUpperCase()}</strong></td>
                    <td><button type="button" class="view-btn" data-id="${r.id}">View Details</button></td>
                `;
                routesTableBody.appendChild(tr);
            });

            document.querySelectorAll(".view-btn").forEach(btn => {
                btn.addEventListener("click", (e) => openModal(e.target.getAttribute("data-id")));
            });
        }

        function openModal(id) {
            const r = allRoutes.find(item => item.id == id);
            if (!r) return;

            modalRouteId.value = r.id;
            routeDetailsSection.innerHTML = `
                <p><strong>Route ID:</strong> #${r.id}</p>
                <p><strong>Driver:</strong> ${r.driver_name}</p>
                <p><strong>Capacity:</strong> ${r.enrolled_students || 0} / ${r.max_capacity}</p>
            `;
            routeModal.removeAttribute("hidden");
        }

        closeRouteModalBtn.addEventListener("click", () => routeModal.setAttribute("hidden", "true"));
        disableRouteBtn.addEventListener("click", () => updateStatus("disabled"));
        enableRouteBtn.addEventListener("click", () => updateStatus("active"));

        async function updateStatus(status) {
            const id = modalRouteId.value;
            const notes = routeAdminNotes.value.trim();
            try {
                const res = await fetch(`${API_BASE_URL}/admin/routes/${id}/status`, {
                    method: "PATCH",
                    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
                    body: JSON.stringify({ status, notes })
                });
                if (res.ok) {
                    alert(`Route #${id} status updated.`);
                    routeModal.setAttribute("hidden", "true");
                    fetchRoutes();
                }
            } catch (err) {
                alert("Server error.");
            }
        }
        fetchRoutes();
    }

    // ==========================================
    // 6. STUDENTS MANAGEMENT MODULE
    // ==========================================
    function initStudentsManagement() {
        const studentsTableBody = document.getElementById("studentsTableBody");
        const studentModal = document.getElementById("studentModal");
        const closeModalBtn = document.getElementById("closeModalBtn");
        const studentDetailsSection = document.getElementById("studentDetailsSection");
        const modalStudentId = document.getElementById("modalStudentId");
        const adminNotes = document.getElementById("adminNotes");
        const suspendStudentBtn = document.getElementById("suspendStudentBtn");
        const activateStudentBtn = document.getElementById("activateStudentBtn");
        let allStudents = [];

        async function fetchStudents() {
            try {
                const res = await fetch(`${API_BASE_URL}/admin/students`, {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                if (res.ok) {
                    allStudents = safeRecord(await res.json());
                    renderStudents(allStudents);
                }
            } catch (err) {
                studentsTableBody.innerHTML = `<tr><td colspan="7">Server error.</td></tr>`;
            }
        }

        function renderStudents(students) {
            studentsTableBody.innerHTML = "";
            students.forEach(st => {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td>#${st.id}</td>
                    <td>${st.full_name}</td>
                    <td>${st.university_name || 'N/A'}</td>
                    <td>${st.area_name || 'N/A'}</td>
                    <td>${st.current_route || 'Not Subscribed'}</td>
                    <td><strong>${(st.account_status || 'active').toUpperCase()}</strong></td>
                    <td><button type="button" class="view-btn" data-id="${st.id}">View Profile</button></td>
                `;
                studentsTableBody.appendChild(tr);
            });

            document.querySelectorAll(".view-btn").forEach(btn => {
                btn.addEventListener("click", (e) => openModal(e.target.getAttribute("data-id")));
            });
        }

        function openModal(id) {
            const st = allStudents.find(s => s.id == id);
            if (!st) return;

            modalStudentId.value = st.id;
            studentDetailsSection.innerHTML = `
                <p><strong>Student ID:</strong> #${st.id}</p>
                <p><strong>Name:</strong> ${st.full_name}</p>
                <p><strong>Phone:</strong> ${st.phone || 'N/A'}</p>
                <p><strong>University:</strong> ${st.university_name || 'N/A'}</p>
            `;
            studentModal.removeAttribute("hidden");
        }

        closeModalBtn.addEventListener("click", () => studentModal.setAttribute("hidden", "true"));
        suspendStudentBtn.addEventListener("click", () => updateStatus("suspended"));
        activateStudentBtn.addEventListener("click", () => updateStatus("active"));

        async function updateStatus(status) {
            const id = modalStudentId.value;
            const notes = adminNotes.value.trim();
            try {
                const res = await fetch(`${API_BASE_URL}/admin/students/${id}/status`, {
                    method: "PATCH",
                    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
                    body: JSON.stringify({ status, notes })
                });
                if (res.ok) {
                    alert(`Student status set to ${status}.`);
                    studentModal.setAttribute("hidden", "true");
                    fetchStudents();
                }
            } catch (err) {
                alert("Server error.");
            }
        }
        fetchStudents();
    }

    // ==========================================
    // 7. UNIVERSITIES & AREAS MODULE
    // ==========================================
    function initUniversitiesAndAreas() {
        const universitiesTableBody = document.getElementById("universitiesTableBody");
        const areasTableBody = document.getElementById("areasTableBody");
        const governorateFilter = document.getElementById("catalogueGovernorate");
        const search = document.getElementById("catalogueSearch");
        const pageSize = 20;
        const pages = { universities: 0, areas: 0 };
        let universities = [], areas = [];

        function renderTable(type, items, columns, body) {
            const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
            pages[type] = Math.min(pages[type], pageCount - 1);
            const visible = items.slice(pages[type] * pageSize, (pages[type] + 1) * pageSize);
            body.innerHTML = visible.length
                ? visible.map(item => `<tr>${columns(item).map(value => `<td>${escapeHtml(value)}</td>`).join("")}</tr>`).join("")
                : '<tr><td colspan="4">No matching records.</td></tr>';
            document.getElementById(`${type}Page`).textContent = `Page ${pages[type] + 1} of ${pageCount}`;
            document.getElementById(`${type}Previous`).disabled = pages[type] === 0;
            document.getElementById(`${type}Next`).disabled = pages[type] >= pageCount - 1;
            document.getElementById(type === "universities" ? "universityCount" : "areaCount").textContent = `${items.length} matching ${type}`;
        }

        function render() {
            const governorate = governorateFilter.value;
            const query = search.value.trim().toLocaleLowerCase();
            const filteredUniversities = universities.filter(item =>
                (governorate === "all" || item.governorate === governorate)
                && `${item.name} ${item.governorate || ""}`.toLocaleLowerCase().includes(query))
                .sort((a, b) => a.name.localeCompare(b.name, "ar"));
            const filteredAreas = areas.filter(item =>
                (governorate === "all" || item.city === governorate)
                && `${item.name} ${item.city}`.toLocaleLowerCase().includes(query))
                .sort((a, b) => a.name.localeCompare(b.name, "ar"));
            renderTable("universities", filteredUniversities,
                item => [`#${item.id}`, item.name, item.governorate || "Unknown", item.status], universitiesTableBody);
            renderTable("areas", filteredAreas,
                item => [`#${item.id}`, item.name, item.city, item.status], areasTableBody);
        }

        governorateFilter.addEventListener("change", () => { pages.universities = 0; pages.areas = 0; render(); });
        search.addEventListener("input", () => { pages.universities = 0; pages.areas = 0; render(); });
        for (const type of ["universities", "areas"]) {
            document.getElementById(`${type}Previous`).addEventListener("click", () => { pages[type]--; render(); });
            document.getElementById(`${type}Next`).addEventListener("click", () => { pages[type]++; render(); });
        }

        async function fetchAll() {
            try {
                const headers = { "Authorization": `Bearer ${token}` };
                const [uRes, aRes] = await Promise.all([
                    fetch(`${API_BASE_URL}/admin/universities`, { headers }),
                    fetch(`${API_BASE_URL}/admin/areas`, { headers }),
                ]);
                if (!uRes.ok || !aRes.ok) throw new Error("Catalogue request failed");
                universities = await uRes.json();
                areas = await aRes.json();
                const governorates = new Set([...universities.map(item => item.governorate), ...areas.map(item => item.city)].filter(Boolean));
                [...governorates].sort((a, b) => a.localeCompare(b)).forEach(name => governorateFilter.add(new Option(name, name)));
                render();
            } catch (err) {
                universitiesTableBody.innerHTML = '<tr><td colspan="4">Could not load universities.</td></tr>';
                areasTableBody.innerHTML = '<tr><td colspan="4">Could not load areas.</td></tr>';
            }
        }
        fetchAll();
    }

    // ==========================================
    // 8. SETTINGS MODULE
    // ==========================================
    function initSettings() {
        const adminProfileForm = document.getElementById("adminProfileForm");
        const changePasswordForm = document.getElementById("changePasswordForm");

        fetch(`${API_BASE_URL}/admin/me`, { headers: { "Authorization": `Bearer ${token}` } })
            .then(response => response.ok ? response.json() : Promise.reject(new Error("Could not load profile.")))
            .then(profile => {
                document.getElementById("adminNameInput").value = profile.name;
                document.getElementById("adminEmailInput").value = profile.email;
            })
            .catch(error => alert(error.message));

        adminProfileForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            try {
                const response = await fetch(`${API_BASE_URL}/admin/me`, {
                    method: "PUT",
                    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: document.getElementById("adminNameInput").value.trim(),
                        email: document.getElementById("adminEmailInput").value.trim()
                    })
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.detail || "Could not update profile.");
                sessionStorage.setItem("adminEmail", result.email);
                alert("Profile updated.");
            } catch (error) { alert(error.message); }
        });

        changePasswordForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const newPassword = document.getElementById("newPasswordInput").value;
            if (newPassword !== document.getElementById("confirmPasswordInput").value) {
                alert("New passwords do not match.");
                return;
            }
            try {
                const response = await fetch(`${API_BASE_URL}/admin/me/password`, {
                    method: "POST",
                    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
                    body: JSON.stringify({
                        current_password: document.getElementById("currentPasswordInput").value,
                        new_password: newPassword
                    })
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.detail || "Could not change password.");
                sessionStorage.removeItem("adminToken");
                sessionStorage.removeItem("adminEmail");
                window.location.href = "login.html";
            } catch (error) { alert(error.message); }
        });
    }
});
