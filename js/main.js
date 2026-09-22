"use strict";

const siteHeader = document.querySelector("#site-header");
function updateHeaderScrollState() {
  if (!siteHeader) return;
  siteHeader.classList.toggle("nav-scrolled", window.scrollY > 12);
}
updateHeaderScrollState();
window.addEventListener("scroll", updateHeaderScrollState, { passive: true });

const navigation = document.querySelector("#navigation");
const menuButton = document.querySelector(".menu");

function setMenuOpen(open) {
  navigation.classList.toggle("open", open);
  menuButton.setAttribute("aria-expanded", String(open));
}

menuButton.addEventListener("click", () => {
  setMenuOpen(menuButton.getAttribute("aria-expanded") !== "true");
});
menuButton.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setMenuOpen(false);
});
navigation.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => setMenuOpen(false));
});

document.addEventListener("click", (event) => {
  if (!navigation.classList.contains("open")) return;
  if (navigation.contains(event.target) || menuButton.contains(event.target)) return;
  setMenuOpen(false);
});

const tabs = document.querySelectorAll('[role="tab"]');

function selectRole(role) {
  tabs.forEach((tab) => {
    const selected = tab.id === `${role}-tab`;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });
  const template = document.getElementById(`${role}-steps`);
  document.querySelector("#steps").replaceWith(template.content.cloneNode(true));
}

tabs.forEach((tab) => {
  const role = tab.id.replace("-tab", "");
  tab.addEventListener("click", () => {
    if (tab.getAttribute("aria-selected") !== "true") selectRole(role);
  });
  tab.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? "student"
      : event.key === "End" ? "driver"
      : role === "student" ? "driver" : "student";
    selectRole(next);
    document.getElementById(`${next}-tab`).focus();
  });
});

const motionButton = document.querySelector(".motion-toggle");
motionButton.addEventListener("click", () => {
  const paused = motionButton.getAttribute("aria-pressed") !== "true";
  motionButton.setAttribute("aria-pressed", String(paused));
  motionButton.textContent = paused ? "Resume motion" : "Pause motion";
  motionButton.closest(".map-shell").classList.toggle("motion-paused", paused);
});

const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");

document.querySelectorAll("details").forEach((details) => {
  let animation = null;
  const summary = details.querySelector("summary");
  summary.addEventListener("click", (event) => {
    if (motionPreference.matches || !details.animate) return;
    event.preventDefault();
    if (animation) return;
    const start = details.getBoundingClientRect().height;
    const opening = !details.open;
    if (opening) details.open = true;
    const end = opening ? details.getBoundingClientRect().height
      : summary.getBoundingClientRect().height + 2;
    animation = details.animate(
      { height: [`${start}px`, `${end}px`] },
      { duration: 240, easing: "ease-in-out" },
    );
    animation.onfinish = () => {
      details.open = opening;
      animation = null;
    };
  });
});

document.querySelectorAll(".counter-value").forEach((counter) => {
  if (motionPreference.matches || !("IntersectionObserver" in window)) return;
  const target = Number(counter.parentElement.getAttribute("aria-label").replaceAll(",", ""));
  let frame;
  const observer = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    const start = performance.now();
    function tick(now) {
      const progress = Math.min((now - start) / 1200, 1);
      counter.textContent = Math.round(target * (1 - (1 - progress) ** 3)).toLocaleString("en-US");
      if (progress < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    observer.disconnect();
  }, { threshold: 0.6 });
  observer.observe(counter.parentElement);
  motionPreference.addEventListener("change", () => {
    if (!motionPreference.matches) return;
    cancelAnimationFrame(frame);
    observer.disconnect();
    counter.textContent = target.toLocaleString("en-US");
  });
});

function openPreview(kind) {
  const template = document.getElementById(`preview-${kind}`);
  if (!template) return;
  const trigger = document.activeElement;
  const dialog = template.content.firstElementChild.cloneNode(true);
  document.querySelector("#root").append(dialog);
  const close = () => dialog.close();
  dialog.addEventListener("close", () => {
    dialog.remove();
    trigger?.focus();
  }, { once: true });
  dialog.querySelector(".close-dialog").addEventListener("click", close);
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right
      || event.clientY < box.top || event.clientY > box.bottom) close();
  });
  dialog.querySelector("form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const status = document.createElement("p");
    status.setAttribute("role", "status");
    status.textContent = "Next in the live product: add your vehicle, set your route and seat count, then submit for administrator approval. This demo ends here; no application was submitted.";
    event.currentTarget.replaceWith(status);
  });
  dialog.showModal();
}

document.querySelectorAll("[data-preview]").forEach((button) => {
  button.addEventListener("click", () => openPreview(button.dataset.preview));
});

const routeSearch = document.querySelector("#route-search");
const matchResult = document.querySelector("#match-result");
const searchButton = routeSearch?.querySelector(".button.primary");

const NO_MATCH_AREAS = new Set(["Al-Jadriya"]);

function renderNoMatch(area, university) {
  matchResult.className = "match-result no-match";
  matchResult.innerHTML = `<strong>No exact match yet</strong><span>No reviewed route currently covers ${area} → ${university}. Join Route Demand so drivers can see students need this line.</span><button type="button" class="text-button demand-button">Join Route Demand ↗</button>`;
}

function renderMatch(area, university, arrival) {
  matchResult.className = "match-result";
  matchResult.innerHTML = `
    <div class="result-card">
      <strong>Best match · 94%</strong>
      <h3>${area} → ${university}</h3>
      <dl class="result-facts">
        <div><dt>Departs</dt><dd>7:30 AM</dd></div>
        <div><dt>Arrives</dt><dd>before ${arrival}</dd></div>
        <div><dt>Price</dt><dd>75,000 IQD / mo</dd></div>
        <div><dt>Seats</dt><dd>3 available</dd></div>
        <div><dt>Driver</dt><dd>Approved </dd></div>
        <div><dt>Match</dt><dd>94%</dd></div>
      </dl>
      <button type="button" class="button primary" data-preview="join">Send join request ↗</button>
    </div>`;
  matchResult.querySelector("[data-preview]")?.addEventListener("click", (event) => {
    openPreview(event.currentTarget.dataset.preview);
  });
}

routeSearch?.addEventListener("submit", (event) => {
  event.preventDefault();
  const areaField = document.querySelector("#pickup-area");
  const universityField = document.querySelector("#university");
  const arrivalField = document.querySelector("#arrival-time");
  const area = areaField.value;
  const university = universityField.value;
  const arrival = arrivalField.value;

  let firstInvalid = null;
  [areaField, universityField, arrivalField].forEach((field) => {
    const invalid = !field.value;
    field.setAttribute("aria-invalid", String(invalid));
    if (invalid && !firstInvalid) firstInvalid = field;
  });
  if (firstInvalid) {
    matchResult.hidden = false;
    matchResult.className = "match-result field-error";
    matchResult.innerHTML = `<strong>Choose an option for every field</strong><span>Select a pickup area, university, and arrival time to search.</span>`;
    firstInvalid.focus();
    return;
  }

  matchResult.hidden = false;
  matchResult.className = "match-result is-loading";
  matchResult.innerHTML = `<strong>Searching routes…</strong><span>Matching ${area} to ${university}.</span>`;
  searchButton?.setAttribute("aria-busy", "true");

  window.setTimeout(() => {
    searchButton?.removeAttribute("aria-busy");
    if (NO_MATCH_AREAS.has(area)) renderNoMatch(area, university);
    else renderMatch(area, university, arrival);
    matchResult.scrollIntoView({ behavior: motionPreference.matches ? "auto" : "smooth", block: "nearest" });
  }, motionPreference.matches ? 0 : 500);
});

document.addEventListener("click", (event) => {
  if (event.target.closest(".demand-button")) openPreview("join");
});
