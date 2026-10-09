(() => {
  "use strict";
  const pages = [
    ["Overview", [["index.html", "Dashboard Overview", "▦"]]],
    [
      "Management",
      [
        ["adminStudent.html", "Students", "♙"],
        ["adminDriver.html", "Drivers", "◉"],
        ["adminApproval.html", "Driver Approvals", "✓"],
      ],
    ],
    [
      "Transportation",
      [
        ["adminRoute.html", "Routes", "⇄"],
        ["adminRouteDemand.html", "Route Demand", "◎"],
        ["adminDemand.html", "Demand Analytics", "▥"],
      ],
    ],
    ["Safety & Support", [["adminReports.html", "Reports & Complaints", "◇"]]],
    [
      "Administration",
      [
        ["adminUniversities.html", "Universities & Areas", "▤"],
        ["createAdmin.html", "Create Admin", "+"],
        ["setting.html", "Settings", "⚙"],
      ],
    ],
  ];
  const current = location.pathname.split("/").pop() || "index.html";
  document.addEventListener("DOMContentLoaded", () => {
    const shell = document.querySelector(".admin-shell");
    if (!shell) return;
    const sidebar = document.createElement("aside");
    sidebar.className = "admin-sidebar";
    sidebar.id = "adminSidebar";
    sidebar.setAttribute("aria-label", "Admin navigation");
    const brand = document.createElement("a");
    brand.className = "admin-brand";
    brand.href = "../../index.html";
    brand.innerHTML =
      '<img src="../../assets/logo/darbgo-logo.png" alt=""><span>Darb<span>Go</span><small>ADMIN CONSOLE</small></span>';
    sidebar.append(brand);
    for (const [group, links] of pages) {
      const label = document.createElement("p");
      label.className = "admin-nav-label";
      label.textContent = group;
      sidebar.append(label);
      const nav = document.createElement("nav");
      nav.setAttribute("aria-label", group);
      for (const [href, title, icon] of links) {
        const a = document.createElement("a");
        a.href = href;
        a.innerHTML = `<span class="nav-icon" aria-hidden="true">${icon}</span><span>${title}</span>`;
        if (href === current) a.setAttribute("aria-current", "page");
        nav.append(a);
      }
      sidebar.append(nav);
    }
    const logout = document.createElement("button");
    logout.type = "button";
    logout.id = "logoutBtn";
    logout.className = "admin-logout";
    logout.textContent = "Log out";
    sidebar.append(logout);
    const main = shell.querySelector(".admin-main");
    const header = document.createElement("header");
    header.className = "admin-topbar";
    const toggle = document.createElement("button");
    toggle.className = "admin-menu-toggle";
    toggle.type = "button";
    toggle.textContent = "☰ Menu";
    toggle.setAttribute("aria-controls", "adminSidebar");
    toggle.setAttribute("aria-expanded", "false");
    const context = document.createElement("div");
    context.className = "admin-context";
    context.textContent =
      document.querySelector(".page-heading h1")?.textContent || "Admin";
    const account = document.createElement("a");
    account.className = "admin-account";
    account.href = "setting.html";
    const email = sessionStorage.getItem("adminEmail") || "Admin account";
    const initial = document.createElement("span");
    initial.className = "admin-avatar";
    initial.textContent = email.charAt(0).toUpperCase();
    const name = document.createElement("span");
    name.textContent = email;
    account.append(initial, name);
    header.append(toggle, context, account);
    main.prepend(header);
    shell.prepend(sidebar);
    if (
      sessionStorage.getItem("adminPreview") === "1" &&
      ["localhost", "127.0.0.1"].includes(location.hostname)
    ) {
      const notice = document.createElement("p");
      notice.className = "admin-preview-notice";
      notice.textContent =
        "Local preview only — no live records or admin actions.";
      header.after(notice);
      main.querySelectorAll("tbody").forEach((body) => {
        body.replaceChildren();
        const row = body.insertRow();
        const cell = row.insertCell();
        cell.colSpan = body.closest("table")?.tHead?.rows[0]?.cells.length || 1;
        cell.textContent = "Live data is unavailable in local preview.";
      });
      main.querySelectorAll(".chart-summary").forEach((summary) => {
        summary.textContent = "Live analytics are unavailable in local preview.";
      });
    }
    const backdrop = document.createElement("button");
    backdrop.className = "admin-sidebar-backdrop";
    backdrop.type = "button";
    backdrop.hidden = true;
    backdrop.setAttribute("aria-label", "Close navigation");
    document.body.append(backdrop);
    const closeNav = () => {
      document.body.classList.remove("nav-open");
      toggle.setAttribute("aria-expanded", "false");
      backdrop.hidden = true;
      toggle.focus();
    };
    toggle.addEventListener("click", () => {
      const open = !document.body.classList.contains("nav-open");
      document.body.classList.toggle("nav-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      backdrop.hidden = !open;
      if (open) sidebar.querySelector("a")?.focus();
    });
    backdrop.addEventListener("click", closeNav);
    document.addEventListener("keydown", (event) => {
      if (
        event.key === "Escape" &&
        document.body.classList.contains("nav-open")
      )
        closeNav();
    });
    // Keep existing modal open and close handlers. Add focus return and Escape behavior.
    document.querySelectorAll(".admin-modal").forEach((modal) => {
      let invoker = null;
      new MutationObserver(() => {
        if (!modal.hidden) {
          invoker = document.activeElement;
          modal.querySelector("button")?.focus();
        } else if (invoker instanceof HTMLElement) invoker.focus();
      }).observe(modal, { attributes: true, attributeFilter: ["hidden"] });
      modal.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          modal.hidden = true;
          event.stopPropagation();
        }
      });
    });
  });
})();
