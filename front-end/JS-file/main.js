const API_BASE_URL = "http://127.0.0.1:8000";

document.addEventListener("DOMContentLoaded", () => {
    // 1. Global Auth Guard: Check Admin Session Token
    const token = localStorage.getItem("adminToken");
    if (!token) {
        window.location.href = "login.html";
        return;
    }

    // 2. Global Logout Handler
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            localStorage.removeItem("adminToken");
            localStorage.removeItem("adminEmail");
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
        let allApplications = [];

        async function fetchApplications() {
            try {
                const response = await fetch(`${API_BASE_URL}/admin/driver-applications`, {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                if (response.ok) {
                    allApplications = await response.json();
                    renderApplications(allApplications);
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
                approvalTableBody.innerHTML = `<tr><td colspan="7">No pending applications.</td></tr>`;
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
            adminNotes.value = "";
            applicantDetailsSection.innerHTML = `
                <p><strong>Name:</strong> ${app.full_name}</p>
                <p><strong>Phone:</strong> ${app.phone}</p>
                <p><strong>Vehicle:</strong> ${app.vehicle_type} - ${app.vehicle_model} (${app.vehicle_year})</p>
                <p><strong>Plate Number:</strong> ${app.plate_number}</p>
                <p><strong>Capacity:</strong> ${app.capacity} passengers</p>
            `;
            documentsSection.innerHTML = `
                <p><strong>License:</strong> <a href="${app.license_url}" target="_blank">View Document</a></p>
                <p><strong>Identity Card:</strong> <a href="${app.id_card_url}" target="_blank">View Document</a></p>
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
                    alert(`Application #${id} ${status} successfully.`);
                    approvalModal.setAttribute("hidden", "true");
                    fetchApplications();
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
            demands.forEach(d => {
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
                    driverSelect.innerHTML += `<option value="${drv.id}">${drv.name} (Cap: ${drv.capacity})</option>`;
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
        const closeModalBtn = document.getElementById("closeModalBtn");
        const driverDetailsSection = document.getElementById("driverDetailsSection");
        const modalDriverId = document.getElementById("modalDriverId");
        const adminNotes = document.getElementById("adminNotes");
        const suspendDriverBtn = document.getElementById("suspendDriverBtn");
        const activateDriverBtn = document.getElementById("activateDriverBtn");
        let allDrivers = [];

        async function fetchDrivers() {
            try {
                const res = await fetch(`${API_BASE_URL}/admin/drivers`, {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                if (res.ok) {
                    allDrivers = await res.json();
                    renderDrivers(allDrivers);
                }
            } catch (err) {
                driversTableBody.innerHTML = `<tr><td colspan="8">Server error.</td></tr>`;
            }
        }

        function renderDrivers(drivers) {
            driversTableBody.innerHTML = "";
            drivers.forEach(drv => {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td>#${drv.id}</td>
                    <td>${drv.full_name}<br><small>${drv.phone}</small></td>
                    <td>${drv.vehicle_type} (${drv.plate_number})</td>
                    <td>${drv.assigned_route || 'Unassigned'}</td>
                    <td>${drv.rating ? drv.rating + ' ★' : 'No ratings'}</td>
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
                <p><strong>Rating:</strong> ${drv.rating || 'N/A'}</p>
                <p><strong>Status:</strong> ${drv.status || 'Active'}</p>
            `;
            driverModal.removeAttribute("hidden");
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
                    allReports = await res.json();
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
                    allRoutes = await res.json();
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
                    allStudents = await res.json();
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

        async function fetchAll() {
            try {
                const uRes = await fetch(`${API_BASE_URL}/admin/universities`, { headers: { "Authorization": `Bearer ${token}` } });
                if (uRes.ok) {
                    const univs = await uRes.json();
                    universitiesTableBody.innerHTML = "";
                    univs.forEach(u => {
                        universitiesTableBody.innerHTML += `
                            <tr>
                                <td>#${u.id}</td>
                                <td>${u.name}</td>
                                <td><strong>${(u.status || 'active').toUpperCase()}</strong></td>
                                <td>--</td>
                            </tr>`;
                    });
                }

                const aRes = await fetch(`${API_BASE_URL}/admin/areas`, { headers: { "Authorization": `Bearer ${token}` } });
                if (aRes.ok) {
                    const areas = await aRes.json();
                    areasTableBody.innerHTML = "";
                    areas.forEach(a => {
                        areasTableBody.innerHTML += `
                            <tr>
                                <td>#${a.id}</td>
                                <td>${a.name}</td>
                                <td>${a.city || 'N/A'}</td>
                                <td><strong>${(a.status || 'active').toUpperCase()}</strong></td>
                                <td>--</td>
                            </tr>`;
                    });
                }
            } catch (err) {
                console.error(err);
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

        adminProfileForm.addEventListener("submit", (e) => {
            e.preventDefault();
            alert("Profile updated.");
        });

        changePasswordForm.addEventListener("submit", (e) => {
            e.preventDefault();
            alert("Password changed successfully.");
        });
    }
});