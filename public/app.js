/**
 * app.js
 * -----------------------------------------------------------------------
 * Smart & Safe Campus ERP — frontend controller.
 * Native JS + fetch API. No frameworks, no build step.
 * Supports four roles: admin | teacher | student | parent
 * -----------------------------------------------------------------------
 */

// =========================================================================
// API helper
// =========================================================================
const API = {
  async get(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error((await r.json()).error || "Request failed");
    return r.json();
  },
  async post(url, body) {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });
    if (!r.ok) throw new Error((await r.json()).error || "Request failed");
    return r.json();
  },
  async put(url, body) {
    const r = await fetch(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });
    if (!r.ok) throw new Error((await r.json()).error || "Request failed");
    return r.json();
  },
  async del(url) {
    const r = await fetch(url, { method: "DELETE" });
    if (!r.ok) throw new Error((await r.json()).error || "Request failed");
    return r.json();
  }
};

// =========================================================================
// Session (stored in sessionStorage so it clears on tab close)
// =========================================================================
let currentUser = null; // { id, username, role, name, studentId, department, subject }

function saveSession(user) {
  currentUser = user;
  sessionStorage.setItem("campus_user", JSON.stringify(user));
}
function loadSession() {
  const raw = sessionStorage.getItem("campus_user");
  if (raw) { try { currentUser = JSON.parse(raw); } catch (_) {} }
}
function clearSession() {
  currentUser = null;
  sessionStorage.removeItem("campus_user");
}

// =========================================================================
// Global data cache
// =========================================================================
const state = {
  students: [],
  hostels: [],
  transport: [],
  exams: [],
  incidents: [],
  sos: [],
  visitors: [],
  broadcasts: [],
  stats: {}
};

// =========================================================================
// Utilities
// =========================================================================
function money(n) {
  return "₹" + Number(n || 0).toLocaleString("en-IN");
}
function fmtTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}
function showToast(message, kind = "info") {
  const stack = document.getElementById("toastStack");
  const el = document.createElement("div");
  el.className = "toast" + (kind === "danger" ? " toast-danger" : kind === "success" ? " toast-success" : "");
  el.textContent = message;
  stack.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}
function statCard(label, value, sub, cls = "") {
  return `<div class="stat-card ${cls}">
    <div class="stat-card-label">${label}</div>
    <div class="stat-card-value">${value}</div>
    ${sub ? `<div class="stat-card-sub">${sub}</div>` : ""}
  </div>`;
}
function detailRow(label, value) {
  return `<div class="detail-row"><span class="detail-label">${label}</span><span class="detail-value">${escapeHtml(String(value))}</span></div>`;
}

// =========================================================================
// Login Screen
// =========================================================================
function showLoginScreen() {
  document.getElementById("loginOverlay").classList.remove("hidden");
  document.getElementById("appShell").style.display = "none";
}
function hideLoginScreen() {
  document.getElementById("loginOverlay").classList.add("hidden");
  document.getElementById("appShell").style.display = "";
}

function initLogin() {
  document.getElementById("loginForm").addEventListener("submit", async e => {
    e.preventDefault();
    const username = document.getElementById("loginUsername").value.trim();
    const password = document.getElementById("loginPassword").value;
    const errEl = document.getElementById("loginError");
    const btn = document.getElementById("loginBtn");
    errEl.hidden = true;
    btn.disabled = true;
    btn.textContent = "Signing in…";
    try {
      const user = await API.post("/api/login", { username, password });
      saveSession(user);
      hideLoginScreen();
      await bootApp();
    } catch (err) {
      errEl.hidden = false;
      errEl.textContent = err.message || "Login failed. Check your credentials.";
      btn.disabled = false;
      btn.textContent = "Sign In →";
    }
  });

  document.getElementById("forgotPasswordLink").addEventListener("click", e => {
    e.preventDefault();
    document.getElementById("loginForm").hidden = true;
    document.getElementById("loginHintBox").hidden = true;
    document.getElementById("forgotPasswordForm").hidden = false;
    document.getElementById("loginError").hidden = true;
  });

  document.getElementById("backToLoginLink").addEventListener("click", e => {
    e.preventDefault();
    document.getElementById("forgotPasswordForm").hidden = true;
    document.getElementById("loginForm").hidden = false;
    document.getElementById("loginHintBox").hidden = false;
    document.getElementById("loginError").hidden = true;
  });

  document.getElementById("forgotPasswordForm").addEventListener("submit", async e => {
    e.preventDefault();
    const username = document.getElementById("resetUsername").value.trim();
    const desiredPassword = document.getElementById("resetDesiredPassword").value;
    const errEl = document.getElementById("loginError");
    try {
      await API.post("/api/password-requests", { username, desiredPassword });
      errEl.hidden = false;
      errEl.className = "login-error";
      errEl.style.background = "var(--green-100)";
      errEl.style.color = "var(--green-700)";
      errEl.textContent = "Request sent! Please wait for admin approval.";
      document.getElementById("resetUsername").value = "";
      document.getElementById("resetDesiredPassword").value = "";
      setTimeout(() => document.getElementById("backToLoginLink").click(), 2500);
    } catch (err) {
      errEl.hidden = false;
      errEl.className = "login-error";
      errEl.style.background = "";
      errEl.style.color = "";
      errEl.textContent = err.message || "Request failed.";
    }
  });
}

// =========================================================================
// Role-based navigation config
// =========================================================================
const NAV_CONFIG = {
  admin: [
    { group: "Overview",         items: [{ module: "overview",   icon: "⊡", label: "Dashboard" }] },
    { group: "ERP Modules",      items: [
      { module: "students",   icon: "☾", label: "Students" },
      { module: "attendance", icon: "✓", label: "Attendance" },
      { module: "fees",       icon: "₹", label: "Fees & Dues" },
      { module: "hostel",     icon: "⌂", label: "Hostel" },
      { module: "transport",  icon: "✈", label: "Transport" },
      { module: "exams",      icon: "📅", label: "Exams / Timetable" }
    ]},
    { group: "Safety & Security", items: [
      { module: "safety",   icon: "⚠", label: "Safety Center", badge: "navSosBadge" },
      { module: "visitors", icon: "👤", label: "Visitors" }
    ]},
    { group: "Settings",          items: [
      { module: "users",    icon: "🔑", label: "Users & Credentials" }
    ]},
    { group: "Intelligence",      items: [{ module: "copilot", icon: "●", label: "AI Copilot" }] }
  ],
  teacher: [
    { group: "Dashboard",       items: [{ module: "teacher-home", icon: "⊡", label: "My Dashboard" }] },
    { group: "Academics",       items: [
      { module: "exams",    icon: "📅", label: "Exam Timetable" }
    ]},
    { group: "Safety",          items: [
      { module: "safety",   icon: "⚠", label: "Safety Center", badge: "navSosBadge" }
    ]},
    { group: "Intelligence",    items: [{ module: "copilot", icon: "●", label: "AI Copilot" }] }
  ],
  student: [
    { group: "My Portal",       items: [{ module: "student-home", icon: "⊡", label: "My Dashboard" }] },
    { group: "Academics",       items: [
      { module: "exams", icon: "📅", label: "Exam Timetable" }
    ]},
    { group: "Intelligence",    items: [{ module: "copilot", icon: "●", label: "AI Copilot" }] }
  ],
  parent: [
    { group: "My Portal",       items: [{ module: "parent-home", icon: "⊡", label: "Ward Overview" }] },
    { group: "Intelligence",    items: [{ module: "copilot", icon: "●", label: "AI Copilot" }] }
  ]
};

// =========================================================================
// Navigation
// =========================================================================
function buildNav(role) {
  const nav = document.getElementById("navGroups");
  const config = NAV_CONFIG[role] || NAV_CONFIG.admin;
  nav.innerHTML = config.map(group => `
    <div class="nav-group">
      <div class="nav-group-label">${escapeHtml(group.group)}</div>
      ${group.items.map(item => `
        <button class="nav-item" data-module="${item.module}">
          <span class="nav-icon">${item.icon}</span> ${escapeHtml(item.label)}
          ${item.badge ? `<span class="nav-badge" id="${item.badge}" hidden>0</span>` : ""}
        </button>`).join("")}
    </div>`).join("");

  // Activate first item by default
  const first = nav.querySelector(".nav-item");
  if (first) first.classList.add("active");

  // Bind click events
  nav.querySelectorAll(".nav-item").forEach(btn => {
    btn.addEventListener("click", () => {
      nav.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".module").forEach(m => m.classList.remove("active"));
      const mod = document.getElementById("module-" + btn.dataset.module);
      if (mod) mod.classList.add("active");
    });
  });
}

function activateFirstModule() {
  const first = document.getElementById("navGroups").querySelector(".nav-item");
  if (!first) return;
  document.querySelectorAll(".module").forEach(m => m.classList.remove("active"));
  const mod = document.getElementById("module-" + first.dataset.module);
  if (mod) mod.classList.add("active");
}

// =========================================================================
// Clock
// =========================================================================
function tickClock() {
  const el = document.getElementById("clockDisplay");
  if (el) el.textContent = new Date().toLocaleTimeString("en-IN", { hour12: false });
}

// =========================================================================
// Modal helper
// =========================================================================
function openModal(title, bodyHtml, onMount) {
  document.getElementById("modalTitle").textContent = title;
  document.getElementById("modalBody").innerHTML = bodyHtml;
  document.getElementById("modalOverlay").hidden = false;
  if (onMount) onMount(document.getElementById("modalBody"));
}
function closeModal() {
  document.getElementById("modalOverlay").hidden = true;
}
document.getElementById("modalClose").addEventListener("click", closeModal);
document.getElementById("modalOverlay").addEventListener("click", e => {
  if (e.target.id === "modalOverlay") closeModal();
});

// =========================================================================
// KPI + Stats
// =========================================================================
async function refreshStats() {
  state.stats = await API.get("/api/stats");
  const s = state.stats;
  document.getElementById("kpiTotalStudents").textContent = s.totalStudents;
  document.getElementById("kpiAttendance").textContent = s.attendanceRate + "%";
  document.getElementById("kpiDues").textContent = money(s.outstandingDues);
  document.getElementById("kpiSos").textContent = s.activeSOS;

  const navBadge = document.getElementById("navSosBadge");
  if (navBadge) {
    if (s.activeSOS > 0) { navBadge.hidden = false; navBadge.textContent = s.activeSOS; }
    else { navBadge.hidden = true; }
  }

  const hostelPct = s.hostelCapacity ? Math.round((s.hostelOccupancy / s.hostelCapacity) * 100) : 0;
  const transportPct = s.transportCapacity ? Math.round((s.transportOccupancy / s.transportCapacity) * 100) : 0;
  const presentPct = s.totalStudents ? Math.round((s.presentToday / s.totalStudents) * 100) : 0;

  const bh = document.getElementById("barHostel"); if (bh) bh.style.width = hostelPct + "%";
  const bhv = document.getElementById("barHostelValue"); if (bhv) bhv.textContent = `${s.hostelOccupancy}/${s.hostelCapacity}`;
  const bt = document.getElementById("barTransport"); if (bt) bt.style.width = transportPct + "%";
  const btv = document.getElementById("barTransportValue"); if (btv) btv.textContent = `${s.transportOccupancy}/${s.transportCapacity}`;
  const bp = document.getElementById("barPresent"); if (bp) bp.style.width = presentPct + "%";
  const bpv = document.getElementById("barPresentValue"); if (bpv) bpv.textContent = `${s.presentToday}/${s.totalStudents}`;
}

// =========================================================================
// ADMIN MODULES
// =========================================================================

// ---- Overview ----
async function renderOverview() {
  await refreshStats();
  const feed = document.getElementById("overviewFeed");
  if (!feed) return;
  const events = [
    ...state.sos.map(a => ({ kind: "SOS", label: `Panic SOS — ${a.triggeredBy}`, meta: `${a.location} · ${fmtTime(a.timestamp)}`, status: a.status })),
    ...state.incidents.map(i => ({ kind: "Incident", label: `${i.type} — ${i.location}`, meta: fmtTime(i.timestamp), status: i.status }))
  ].slice(0, 8);

  feed.innerHTML = events.length
    ? events.map(e => `
      <div class="feed-item severity-${e.status}">
        <div class="feed-item-top"><span>[${e.kind}] ${escapeHtml(e.label)}</span><span class="pill ${e.status === 'active' ? 'pill-red' : 'pill-green'}">${e.status}</span></div>
        <div class="feed-item-meta">${escapeHtml(e.meta)}</div>
      </div>`).join("")
    : `<div class="empty-state">No recent events.</div>`;

  const defaulters = state.students.filter(s => s.duesAmount > 0).sort((a, b) => b.duesAmount - a.duesAmount).slice(0, 5);
  const tbody = document.querySelector("#overviewDefaultersTable tbody");
  if (tbody) tbody.innerHTML = defaulters.length
    ? defaulters.map(s => `<tr><td>${escapeHtml(s.name)}</td><td class="mono">${escapeHtml(s.roll)}</td><td>${escapeHtml(s.course)}</td><td class="mono">${money(s.duesAmount)}</td></tr>`).join("")
    : `<tr><td colspan="4" class="empty-state">No outstanding dues 🎉</td></tr>`;
}

// ---- Students ----
function studentRowHtml(s) {
  return `
    <tr data-id="${s.id}">
      <td>${escapeHtml(s.name)}</td>
      <td class="mono">${escapeHtml(s.roll)}</td>
      <td>${escapeHtml(s.course)}</td>
      <td>${s.year}</td>
      <td class="mono">${s.attendancePct}%</td>
      <td class="mono">${s.duesAmount > 0 ? `<span class="pill pill-amber">${money(s.duesAmount)}</span>` : `<span class="pill pill-green">Cleared</span>`}</td>
      <td>${escapeHtml(s.hostelId || "—")}</td>
      <td>${escapeHtml(s.transportId || "—")}</td>
      <td>
        <button class="btn btn-ghost btn-sm" data-action="edit-student" data-id="${s.id}">Edit</button>
        <button class="btn btn-ghost btn-sm" data-action="delete-student" data-id="${s.id}">Delete</button>
      </td>
    </tr>`;
}
function renderStudents(filterText = "") {
  const tbody = document.querySelector("#studentsTable tbody");
  if (!tbody) return;
  const f = filterText.trim().toLowerCase();
  const rows = state.students.filter(s =>
    !f || s.name.toLowerCase().includes(f) || s.roll.toLowerCase().includes(f) || s.course.toLowerCase().includes(f)
  );
  tbody.innerHTML = rows.length ? rows.map(studentRowHtml).join("") : `<tr><td colspan="9" class="empty-state">No matching students.</td></tr>`;
}
function studentFormHtml(s) {
  const isEdit = !!s;
  return `
    <form id="studentForm" class="stacked-form">
      <div class="form-grid">
        <div class="field"><label>Full Name</label><input class="input" name="name" required value="${isEdit ? escapeHtml(s.name) : ""}"/></div>
        <div class="field"><label>Roll Number</label><input class="input" name="roll" required value="${isEdit ? escapeHtml(s.roll) : ""}"/></div>
        <div class="field"><label>Course</label><input class="input" name="course" required value="${isEdit ? escapeHtml(s.course) : "B.Tech CSE"}"/></div>
        <div class="field"><label>Year</label><input class="input" type="number" min="1" max="5" name="year" required value="${isEdit ? s.year : 1}"/></div>
        <div class="field"><label>Total Fees (₹)</label><input class="input" type="number" min="0" name="feesTotal" required value="${isEdit ? s.feesTotal : 100000}"/></div>
        <div class="field"><label>Fees Paid (₹)</label><input class="input" type="number" min="0" name="feesPaid" required value="${isEdit ? s.feesPaid : 0}"/></div>
        <div class="field"><label>Contact</label><input class="input" name="contact" value="${isEdit ? escapeHtml(s.contact || "") : ""}"/></div>
        <div class="field"><label>Gender</label>
          <select class="input" name="gender">
            <option ${isEdit && s.gender === "Male" ? "selected" : ""}>Male</option>
            <option ${isEdit && s.gender === "Female" ? "selected" : ""}>Female</option>
            <option ${isEdit && s.gender === "Other" ? "selected" : ""}>Other</option>
          </select>
        </div>
      </div>
      <button type="submit" class="btn btn-primary" style="margin-top:6px;">${isEdit ? "Save Changes" : "Add Student"}</button>
    </form>`;
}
function bindStudentForm(container, existingId) {
  container.querySelector("#studentForm").addEventListener("submit", async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = {
      name: fd.get("name"), roll: fd.get("roll"), course: fd.get("course"),
      year: Number(fd.get("year")), feesTotal: Number(fd.get("feesTotal")),
      feesPaid: Number(fd.get("feesPaid")), contact: fd.get("contact"), gender: fd.get("gender")
    };
    try {
      if (existingId) await API.put(`/api/students/${existingId}`, payload);
      else await API.post("/api/students", payload);
      closeModal();
      showToast(existingId ? "Student updated." : "Student added.", "success");
      await loadAll();
    } catch (err) { showToast(err.message, "danger"); }
  });
}
function initStudentsModule() {
  const btn = document.getElementById("btnAddStudent");
  if (btn) btn.addEventListener("click", () => openModal("Add Student", studentFormHtml(null), c => bindStudentForm(c, null)));
  const search = document.getElementById("studentSearch");
  if (search) search.addEventListener("input", e => renderStudents(e.target.value));
  const tbody = document.querySelector("#studentsTable tbody");
  if (tbody) tbody.addEventListener("click", async e => {
    const b = e.target.closest("button");
    if (!b) return;
    const id = Number(b.dataset.id);
    if (b.dataset.action === "edit-student") {
      const s = state.students.find(x => x.id === id);
      openModal("Edit Student", studentFormHtml(s), c => bindStudentForm(c, id));
    } else if (b.dataset.action === "delete-student") {
      if (!confirm("Remove this student record?")) return;
      try { await API.del(`/api/students/${id}`); showToast("Student removed.", "success"); await loadAll(); }
      catch (err) { showToast(err.message, "danger"); }
    }
  });
}

// ---- Attendance (admin) ----
function renderAttendance() {
  const tbody = document.querySelector("#attendanceTable tbody");
  if (!tbody) return;
  tbody.innerHTML = state.students.map(s => `
    <tr data-id="${s.id}">
      <td>${escapeHtml(s.name)}</td>
      <td class="mono">${escapeHtml(s.roll)}</td>
      <td><span class="pill ${s.present ? "pill-green" : "pill-red"}">${s.present ? "Present" : "Absent"}</span></td>
      <td class="mono">${s.attendancePct}%</td>
      <td class="mono">${s.attendanceHistory.present}/${s.attendanceHistory.total}</td>
      <td><button class="toggle-btn ${s.present ? "on" : ""}" data-action="toggle-attendance" data-id="${s.id}"></button></td>
    </tr>`).join("");
}
function initAttendanceModule() {
  const tbody = document.querySelector("#attendanceTable tbody");
  if (!tbody) return;
  tbody.addEventListener("click", async e => {
    const btn = e.target.closest("button[data-action='toggle-attendance']");
    if (!btn) return;
    try { await API.post(`/api/attendance/${btn.dataset.id}/toggle`); await loadAll(); showToast("Attendance updated.", "success"); }
    catch (err) { showToast(err.message, "danger"); }
  });
}

// ---- Fees ----
function renderFees() {
  const tbody = document.querySelector("#feesTable tbody");
  if (!tbody) return;
  tbody.innerHTML = state.students.map(s => `
    <tr data-id="${s.id}">
      <td>${escapeHtml(s.name)}</td>
      <td class="mono">${escapeHtml(s.roll)}</td>
      <td class="mono">${money(s.feesTotal)}</td>
      <td class="mono">${money(s.feesPaid)}</td>
      <td class="mono">${money(s.duesAmount)}</td>
      <td>${s.duesAmount > 0 ? `<span class="pill pill-amber">Pending</span>` : `<span class="pill pill-green">Cleared</span>`}</td>
      <td>${s.duesAmount > 0 ? `<button class="btn btn-sm btn-outline" data-action="pay-fee" data-id="${s.id}">Record Payment</button>` : "—"}</td>
    </tr>`).join("");
}
function initFeesModule() {
  const tbody = document.querySelector("#feesTable tbody");
  if (!tbody) return;
  tbody.addEventListener("click", e => {
    const btn = e.target.closest("button[data-action='pay-fee']");
    if (!btn) return;
    const id = Number(btn.dataset.id);
    const s = state.students.find(x => x.id === id);
    openModal("Record Fee Payment", `
      <form id="payForm" class="stacked-form">
        <div class="field"><label>Student</label><input class="input" value="${escapeHtml(s.name)} (${escapeHtml(s.roll)})" disabled/></div>
        <div class="field"><label>Outstanding: ${money(s.duesAmount)}</label>
          <input class="input" type="number" name="amount" min="1" max="${s.duesAmount}" required placeholder="Amount to record" />
        </div>
        <button type="submit" class="btn btn-primary">Record Payment</button>
      </form>`, container => {
      container.querySelector("#payForm").addEventListener("submit", async ev => {
        ev.preventDefault();
        const amount = Number(new FormData(ev.target).get("amount"));
        try { await API.post(`/api/fees/${id}/pay`, { amount }); closeModal(); showToast("Payment recorded.", "success"); await loadAll(); }
        catch (err) { showToast(err.message, "danger"); }
      });
    });
  });
}

// ---- Hostel ----
function renderHostel() {
  const grid = document.getElementById("hostelGrid");
  if (!grid) return;
  grid.innerHTML = state.hostels.map(h => {
    const pct = Math.round((h.occupied / h.capacity) * 100);
    return `
      <div class="occupancy-card">
        <h3>${escapeHtml(h.name)}</h3>
        <div class="sub">${escapeHtml(h.type)} · Warden: ${escapeHtml(h.warden)}</div>
        <div class="bar-track"><div class="bar-fill ${pct > 90 ? "fill-amber" : "fill-teal"}" style="width:${pct}%"></div></div>
        <div class="stat-row"><span>${h.occupied}/${h.capacity} beds</span><span>${pct}% full</span></div>
      </div>`;
  }).join("");
}

// ---- Transport ----
function renderTransport() {
  const grid = document.getElementById("transportGrid");
  if (!grid) return;
  grid.innerHTML = state.transport.map(t => {
    const pct = Math.round((t.occupied / t.capacity) * 100);
    return `
      <div class="occupancy-card">
        <h3>${escapeHtml(t.routeName)}</h3>
        <div class="sub">${escapeHtml(t.vehicleNo)} · Driver: ${escapeHtml(t.driver)}</div>
        <div class="bar-track"><div class="bar-fill ${pct > 90 ? "fill-amber" : "fill-teal"}" style="width:${pct}%"></div></div>
        <div class="stat-row"><span>${t.occupied}/${t.capacity} seats</span><span>${escapeHtml(t.timing)}</span></div>
      </div>`;
  }).join("");
}

// ---- Exams ----
function renderExams() {
  const tbody = document.querySelector("#examsTable tbody");
  if (!tbody) return;
  const sorted = [...state.exams].sort((a, b) => a.date.localeCompare(b.date));
  tbody.innerHTML = sorted.length ? sorted.map(x => `
    <tr data-id="${x.id}">
      <td>${escapeHtml(x.course)}</td>
      <td>${escapeHtml(x.subject)}</td>
      <td class="mono">${escapeHtml(x.date)}</td>
      <td>${escapeHtml(x.time)}</td>
      <td>${escapeHtml(x.room)}</td>
      <td>${x.semester}</td>
      <td><button class="btn btn-ghost btn-sm" data-action="delete-exam" data-id="${x.id}">Delete</button></td>
    </tr>`).join("") : `<tr><td colspan="7" class="empty-state">No exams scheduled.</td></tr>`;
}
function initExamsModule() {
  const btn = document.getElementById("btnAddExam");
  if (btn) btn.addEventListener("click", () => {
    openModal("Schedule Exam", `
      <form id="examForm" class="stacked-form">
        <div class="form-grid">
          <div class="field"><label>Course</label><input class="input" name="course" required value="B.Tech CSE"/></div>
          <div class="field"><label>Subject</label><input class="input" name="subject" required/></div>
          <div class="field"><label>Date</label><input class="input" type="date" name="date" required/></div>
          <div class="field"><label>Time</label><input class="input" name="time" placeholder="09:30 AM - 12:30 PM" required/></div>
          <div class="field"><label>Room</label><input class="input" name="room" required/></div>
          <div class="field"><label>Semester</label><input class="input" type="number" min="1" max="8" name="semester" value="1" required/></div>
        </div>
        <button type="submit" class="btn btn-primary" style="margin-top:6px;">Schedule Exam</button>
      </form>`, container => {
      container.querySelector("#examForm").addEventListener("submit", async e => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const payload = Object.fromEntries(fd.entries());
        payload.semester = Number(payload.semester);
        try { await API.post("/api/exams", payload); closeModal(); showToast("Exam scheduled.", "success"); await loadAll(); }
        catch (err) { showToast(err.message, "danger"); }
      });
    });
  });

  const tbody = document.querySelector("#examsTable tbody");
  if (tbody) tbody.addEventListener("click", async e => {
    const btn = e.target.closest("button[data-action='delete-exam']");
    if (!btn) return;
    try { await API.del(`/api/exams/${btn.dataset.id}`); showToast("Exam removed.", "success"); await loadAll(); }
    catch (err) { showToast(err.message, "danger"); }
  });
}

// ---- Safety Center ----
function renderSafety() {
  const sosList = document.getElementById("sosList");
  if (sosList) {
    const active = state.sos.filter(a => a.status === "active");
    sosList.innerHTML = active.length ? active.map(a => `
      <div class="feed-item severity-active">
        <div class="feed-item-top"><span>${escapeHtml(a.triggeredBy)}</span><span class="pill pill-red">ACTIVE</span></div>
        <div class="feed-item-meta">${escapeHtml(a.location)} · ${fmtTime(a.timestamp)}</div>
        <div style="margin-top:6px;">${escapeHtml(a.message)}</div>
        <button class="btn btn-sm btn-outline" style="margin-top:8px;" data-action="resolve-sos" data-id="${a.id}">Mark Resolved</button>
      </div>`).join("") : `<div class="empty-state">No active alerts. Campus is safe.</div>`;
  }

  const broadcastList = document.getElementById("broadcastList");
  if (broadcastList) {
    broadcastList.innerHTML = state.broadcasts.slice(0, 6).map(b => `
      <div class="feed-item level-${b.level}">
        <div class="feed-item-top"><span>${escapeHtml(b.issuedBy)}</span><span class="pill ${b.level === "critical" ? "pill-red" : b.level === "warning" ? "pill-amber" : "pill-green"}">${b.level}</span></div>
        <div class="feed-item-meta">${fmtTime(b.timestamp)}</div>
        <div style="margin-top:6px;">${escapeHtml(b.message)}</div>
      </div>`).join("") || `<div class="empty-state">No broadcasts sent yet.</div>`;
  }

  const tbody = document.querySelector("#incidentsTable tbody");
  if (tbody) {
    tbody.innerHTML = state.incidents.length ? state.incidents.map(i => `
      <tr data-id="${i.id}">
        <td>${escapeHtml(i.type)}</td>
        <td style="max-width:260px;">${escapeHtml(i.description)}</td>
        <td>${escapeHtml(i.location)}</td>
        <td><span class="pill ${i.severity === "High" ? "pill-red" : i.severity === "Medium" ? "pill-amber" : "pill-gray"}">${i.severity}</span></td>
        <td><span class="pill ${i.status === "active" ? "pill-red" : "pill-green"}">${i.status}</span></td>
        <td class="mono">${fmtTime(i.timestamp)}</td>
        <td>${i.status === "active" ? `<button class="btn btn-sm btn-outline" data-action="resolve-incident" data-id="${i.id}">Resolve</button>` : "—"}</td>
      </tr>`).join("") : `<tr><td colspan="7" class="empty-state">No incidents logged.</td></tr>`;
  }
}

function updateBroadcastBanner() {
  const banner = document.getElementById("broadcastBanner");
  const latest = state.broadcasts[0];
  if (!latest) { banner.hidden = true; return; }
  banner.hidden = false;
  banner.className = "broadcast-banner " + latest.level;
  banner.textContent = `📢 ${latest.issuedBy}: ${latest.message}`;
}

function initSafetyModule() {
  document.getElementById("sosButton").addEventListener("click", async () => {
    const btn = document.getElementById("sosButton");
    btn.classList.add("firing");
    setTimeout(() => btn.classList.remove("firing"), 400);
    const triggeredBy = currentUser ? `${currentUser.name} (${currentUser.role})` : "Panic Button (Dashboard)";
    try {
      await API.post("/api/sos", { triggeredBy, location: "Campus Portal — User Device", message: "Panic SOS triggered from campus portal. Immediate security response requested." });
      showToast("🚨 SOS alert sent to campus security!", "danger");
      await loadAll();
    } catch (err) { showToast(err.message, "danger"); }
  });

  const sosList = document.getElementById("sosList");
  if (sosList) sosList.addEventListener("click", async e => {
    const btn = e.target.closest("button[data-action='resolve-sos']");
    if (!btn) return;
    try { await API.put(`/api/sos/${btn.dataset.id}/resolve`); showToast("SOS alert resolved.", "success"); await loadAll(); }
    catch (err) { showToast(err.message, "danger"); }
  });

  const btnReport = document.getElementById("btnReportIncident");
  if (btnReport) btnReport.addEventListener("click", () => {
    openModal("Report Incident", `
      <form id="incidentForm" class="stacked-form">
        <div class="field"><label>Type</label><input class="input" name="type" required placeholder="e.g. Suspicious Activity"/></div>
        <div class="field"><label>Description</label><textarea class="input" name="description" rows="3" required></textarea></div>
        <div class="field"><label>Location</label><input class="input" name="location" required/></div>
        <div class="field"><label>Severity</label>
          <select class="input" name="severity"><option>Low</option><option selected>Medium</option><option>High</option></select>
        </div>
        <div class="field"><label>Reported By</label><input class="input" name="reportedBy" value="${currentUser ? escapeHtml(currentUser.name) : ""}"/></div>
        <button type="submit" class="btn btn-primary" style="margin-top:6px;">Submit Report</button>
      </form>`, container => {
      container.querySelector("#incidentForm").addEventListener("submit", async e => {
        e.preventDefault();
        const payload = Object.fromEntries(new FormData(e.target).entries());
        try { await API.post("/api/incidents", payload); closeModal(); showToast("Incident reported.", "success"); await loadAll(); }
        catch (err) { showToast(err.message, "danger"); }
      });
    });
  });

  const incidentsTbody = document.querySelector("#incidentsTable tbody");
  if (incidentsTbody) incidentsTbody.addEventListener("click", async e => {
    const btn = e.target.closest("button[data-action='resolve-incident']");
    if (!btn) return;
    try { await API.put(`/api/incidents/${btn.dataset.id}/resolve`); showToast("Incident marked resolved.", "success"); await loadAll(); }
    catch (err) { showToast(err.message, "danger"); }
  });

  const broadcastForm = document.getElementById("broadcastForm");
  if (broadcastForm) broadcastForm.addEventListener("submit", async e => {
    e.preventDefault();
    const message = document.getElementById("broadcastMessage").value.trim();
    const level = document.getElementById("broadcastLevel").value;
    if (!message) return;
    try {
      await API.post("/api/broadcasts", { message, level, issuedBy: "Campus Security Office" });
      document.getElementById("broadcastMessage").value = "";
      showToast("Broadcast sent to campus.", "success");
      await loadAll();
    } catch (err) { showToast(err.message, "danger"); }
  });
}

// ---- Visitors ----
function renderVisitors() {
  const tbody = document.querySelector("#visitorsTable tbody");
  if (!tbody) return;
  tbody.innerHTML = state.visitors.length ? state.visitors.map(v => `
    <tr data-id="${v.id}">
      <td>${escapeHtml(v.name)}</td>
      <td>${escapeHtml(v.purpose)}</td>
      <td>${v.hostStudentId ? escapeHtml((state.students.find(s => s.id === v.hostStudentId) || {}).name || "—") : "—"}</td>
      <td class="mono">${fmtTime(v.checkIn)}</td>
      <td class="mono">${v.checkOut ? fmtTime(v.checkOut) : "—"}</td>
      <td><span class="pill ${v.status === "checked-in" ? "pill-amber" : "pill-green"}">${v.status}</span></td>
      <td>${v.status === "checked-in" ? `<button class="btn btn-sm btn-outline" data-action="checkout-visitor" data-id="${v.id}">Check-Out</button>` : "—"}</td>
    </tr>`).join("") : `<tr><td colspan="7" class="empty-state">No visitor records.</td></tr>`;
}
function initVisitorsModule() {
  const btn = document.getElementById("btnAddVisitor");
  if (btn) btn.addEventListener("click", () => {
    const studentOptions = state.students.map(s => `<option value="${s.id}">${escapeHtml(s.name)} (${escapeHtml(s.roll)})</option>`).join("");
    openModal("Check-In Visitor", `
      <form id="visitorForm" class="stacked-form">
        <div class="field"><label>Visitor Name</label><input class="input" name="name" required/></div>
        <div class="field"><label>Purpose of Visit</label><input class="input" name="purpose" required/></div>
        <div class="field"><label>Host Student (optional)</label>
          <select class="input" name="hostStudentId"><option value="">— None —</option>${studentOptions}</select>
        </div>
        <div class="field"><label>ID Proof</label><input class="input" name="idProof" placeholder="e.g. Aadhar / Driving License"/></div>
        <button type="submit" class="btn btn-primary" style="margin-top:6px;">Check In</button>
      </form>`, container => {
      container.querySelector("#visitorForm").addEventListener("submit", async e => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const payload = { name: fd.get("name"), purpose: fd.get("purpose"), hostStudentId: fd.get("hostStudentId") ? Number(fd.get("hostStudentId")) : null, idProof: fd.get("idProof") };
        try { await API.post("/api/visitors", payload); closeModal(); showToast("Visitor checked in.", "success"); await loadAll(); }
        catch (err) { showToast(err.message, "danger"); }
      });
    });
  });

  const tbody = document.querySelector("#visitorsTable tbody");
  if (tbody) tbody.addEventListener("click", async e => {
    const btn = e.target.closest("button[data-action='checkout-visitor']");
    if (!btn) return;
    try { await API.put(`/api/visitors/${btn.dataset.id}/checkout`); showToast("Visitor checked out.", "success"); await loadAll(); }
    catch (err) { showToast(err.message, "danger"); }
  });
}

// ---- AI Copilot ----
function appendCopilotLine(role, text, data) {
  const con = document.getElementById("copilotConsole");
  if (!con) return;
  const line = document.createElement("div");
  line.className = "copilot-line copilot-" + role;
  const prompt = role === "user" ? "YOU&gt;" : role === "system" ? "SYS&gt;" : "AI&gt;";
  line.innerHTML = `<span class="copilot-prompt">${prompt}</span>${escapeHtml(text)}`;
  con.appendChild(line);
  if (data !== undefined && data !== null) {
    const arr = Array.isArray(data) ? data : [];
    const summary = arr.slice(0, 6).map(d => d.name || d.type || d.routeName || d.subject || "").filter(Boolean).join(" · ");
    if (summary) {
      const dataBlock = document.createElement("div");
      dataBlock.className = "copilot-data";
      dataBlock.textContent = summary;
      con.appendChild(dataBlock);
    }
  }
  con.scrollTop = con.scrollHeight;
}
async function runCopilotQuery(query) {
  appendCopilotLine("user", query);
  try {
    const result = await API.post("/api/ai/query", { query });
    appendCopilotLine("ai", result.answer, result.data);
  } catch (err) { appendCopilotLine("system", "Error: " + err.message); }
}
function initCopilotModule() {
  const form = document.getElementById("copilotForm");
  if (form) form.addEventListener("submit", e => {
    e.preventDefault();
    const input = document.getElementById("copilotInput");
    const q = input.value.trim();
    if (!q) return;
    input.value = "";
    runCopilotQuery(q);
  });
  document.querySelectorAll(".chip").forEach(chip => {
    chip.addEventListener("click", () => runCopilotQuery(chip.dataset.q));
  });
}

// =========================================================================
// STUDENT PORTAL
// =========================================================================
function renderStudentPortal() {
  if (!currentUser || currentUser.role !== "student") return;
  const s = state.students.find(x => x.id === currentUser.studentId);
  if (!s) { document.getElementById("studentPortalGreeting").textContent = "Welcome"; return; }

  document.getElementById("studentPortalGreeting").textContent = `Welcome, ${s.name.split(" ")[0]} 👋`;

  // Stat cards
  const attPct = s.attendancePct;
  const attCls = attPct >= 75 ? "good" : attPct >= 60 ? "warn" : "danger";
  const feesCls = s.duesAmount > 0 ? "warn" : "good";
  document.getElementById("studentStatCards").innerHTML =
    statCard("Attendance", attPct + "%", s.attendanceHistory.present + "/" + s.attendanceHistory.total + " classes", attCls) +
    statCard("Fee Status", s.duesAmount > 0 ? money(s.duesAmount) + " due" : "Cleared ✓", money(s.feesPaid) + " paid", feesCls) +
    statCard("Year", "Year " + s.year, s.course, "") +
    statCard("Today", s.present ? "Present ✓" : "Absent ✗", "Today's status", s.present ? "good" : "danger");

  // Attendance detail
  const attEl = document.getElementById("studentAttendanceDetail");
  attEl.innerHTML = `
    <div class="att-display">
      <div class="att-pct ${attCls}">${attPct}%</div>
      <div class="att-meta">
        <strong>${s.attendanceHistory.present}</strong> classes attended<br>
        out of <strong>${s.attendanceHistory.total}</strong> total<br>
        <span class="pill ${s.present ? "pill-green" : "pill-red"}" style="margin-top:6px;display:inline-flex;">${s.present ? "Present Today" : "Absent Today"}</span>
      </div>
    </div>
    ${attPct < 75 ? `<div style="background:var(--amber-100);color:var(--amber-600);padding:10px 12px;border-radius:6px;font-size:12.5px;font-weight:600;">⚠ Your attendance is below 75%. Please attend more classes.</div>` : ""}`;

  // Fees detail
  document.getElementById("studentFeesDetail").innerHTML =
    detailRow("Total Fees", money(s.feesTotal)) +
    detailRow("Fees Paid", money(s.feesPaid)) +
    detailRow("Outstanding", money(s.duesAmount)) +
    (s.duesAmount > 0 ? `<div style="margin-top:10px;"><span class="pill pill-amber">Payment Pending</span></div>` : `<div style="margin-top:10px;"><span class="pill pill-green">Fully Cleared ✓</span></div>`);

  // Hostel + Transport
  const hostel = state.hostels.find(h => h.id === s.hostelId);
  const route = state.transport.find(t => t.id === s.transportId);
  document.getElementById("studentHostelTransport").innerHTML =
    (hostel ? `<div style="margin-bottom:12px;">` + detailRow("🏠 Block", hostel.name) + detailRow("Warden", hostel.warden) + detailRow("Type", hostel.type) + `</div>` : detailRow("Hostel", "Not allocated")) +
    (route ? detailRow("🚌 Route", route.routeName) + detailRow("Timing", route.timing) + detailRow("Driver", route.driver) : detailRow("Transport", "Not allocated"));

  // Exams (filtered to student's course)
  const myExams = state.exams.filter(x => x.course === s.course).sort((a, b) => a.date.localeCompare(b.date));
  document.getElementById("studentExams").innerHTML = myExams.length
    ? myExams.map(x => `
      <div class="exam-item">
        <div class="exam-subject">${escapeHtml(x.subject)}</div>
        <div class="exam-meta">${escapeHtml(x.date)} · ${escapeHtml(x.time)} · ${escapeHtml(x.room)}</div>
      </div>`).join("")
    : `<div class="empty-state">No upcoming exams.</div>`;

  // Safety notices
  const notices = [...state.sos.filter(a => a.status === "active"), ...state.incidents.filter(i => i.status === "active"), ...state.broadcasts.slice(0, 3)];
  document.getElementById("studentSafetyFeed").innerHTML = notices.length
    ? notices.map(n => {
      const isSos = !!n.triggeredBy;
      const isBroadcast = !!n.issuedBy;
      const label = isSos ? `SOS: ${n.triggeredBy}` : isBroadcast ? n.message : `${n.type} at ${n.location}`;
      const cls = isSos ? "severity-active" : isBroadcast ? `level-${n.level || "info"}` : "severity-active";
      return `<div class="feed-item ${cls}"><div class="feed-item-top"><span>${escapeHtml(label)}</span></div><div class="feed-item-meta">${fmtTime(n.timestamp)}</div></div>`;
    }).join("")
    : `<div class="empty-state">No active safety notices.</div>`;
}

// =========================================================================
// TEACHER PORTAL
// =========================================================================
function renderTeacherPortal() {
  if (!currentUser || currentUser.role !== "teacher") return;
  const dept = currentUser.department || "";

  document.getElementById("teacherPortalGreeting").textContent = `Welcome, ${currentUser.name.split(" ").slice(-1)[0]} 👋`;

  const deptBadge = document.getElementById("teacherDeptBadge");
  if (deptBadge) deptBadge.textContent = dept + " Dept";

  // Stats
  const deptStudents = state.students.filter(s => s.course.includes(dept));
  const presentCount = deptStudents.filter(s => s.present).length;
  document.getElementById("teacherStatCards").innerHTML =
    statCard("Dept Students", deptStudents.length, dept + " enrolled", "") +
    statCard("Present Today", presentCount, `${deptStudents.length - presentCount} absent`, presentCount > 0 ? "good" : "warn") +
    statCard("Active Incidents", state.incidents.filter(i => i.status === "active").length, "Campus-wide", state.incidents.filter(i => i.status === "active").length > 0 ? "danger" : "");

  // Attendance table (all students for teacher's dept)
  const tbody = document.querySelector("#teacherAttendanceTable tbody");
  if (tbody) {
    tbody.innerHTML = deptStudents.length ? deptStudents.map(s => `
      <tr data-id="${s.id}">
        <td>${escapeHtml(s.name)}</td>
        <td class="mono">${escapeHtml(s.roll)}</td>
        <td>${escapeHtml(s.course)}</td>
        <td><span class="pill ${s.present ? "pill-green" : "pill-red"}">${s.present ? "Present" : "Absent"}</span></td>
        <td class="mono">${s.attendancePct}%</td>
        <td><button class="toggle-btn ${s.present ? "on" : ""}" data-action="toggle-att-teacher" data-id="${s.id}"></button></td>
      </tr>`).join("")
      : `<tr><td colspan="6" class="empty-state">No students in your department.</td></tr>`;
  }

  // Exams for dept
  const deptExams = state.exams.filter(x => x.course.includes(dept)).sort((a, b) => a.date.localeCompare(b.date));
  document.getElementById("teacherExams").innerHTML = deptExams.length
    ? deptExams.map(x => `
      <div class="exam-item">
        <div class="exam-subject">${escapeHtml(x.subject)}</div>
        <div class="exam-meta">${escapeHtml(x.date)} · ${escapeHtml(x.time)} · ${escapeHtml(x.room)}</div>
      </div>`).join("")
    : `<div class="empty-state">No upcoming exams for your dept.</div>`;
}

function initTeacherPortal() {
  const tbody = document.querySelector("#teacherAttendanceTable tbody");
  if (tbody) tbody.addEventListener("click", async e => {
    const btn = e.target.closest("button[data-action='toggle-att-teacher']");
    if (!btn) return;
    try { await API.post(`/api/attendance/${btn.dataset.id}/toggle`); await loadAll(); showToast("Attendance updated.", "success"); }
    catch (err) { showToast(err.message, "danger"); }
  });

  const form = document.getElementById("teacherIncidentForm");
  if (form) form.addEventListener("submit", async e => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target).entries());
    payload.reportedBy = currentUser ? currentUser.name : "Faculty";
    try { await API.post("/api/incidents", payload); showToast("Incident reported. Thank you.", "success"); e.target.reset(); await loadAll(); }
    catch (err) { showToast(err.message, "danger"); }
  });
}

// =========================================================================
// PARENT PORTAL
// =========================================================================
function renderParentPortal() {
  if (!currentUser || currentUser.role !== "parent") return;
  const s = state.students.find(x => x.id === currentUser.studentId);
  if (!s) return;

  document.getElementById("parentPortalGreeting").textContent = `Welcome, ${currentUser.name.split(" ")[0]} 👋`;

  // Stat cards (ward summary)
  const attPct = s.attendancePct;
  const attCls = attPct >= 75 ? "good" : attPct >= 60 ? "warn" : "danger";
  document.getElementById("parentStatCards").innerHTML =
    statCard("Ward", s.name, s.roll, "") +
    statCard("Attendance", attPct + "%", s.attendanceHistory.present + "/" + s.attendanceHistory.total + " classes", attCls) +
    statCard("Fee Outstanding", s.duesAmount > 0 ? money(s.duesAmount) : "Cleared ✓", s.course, s.duesAmount > 0 ? "warn" : "good") +
    statCard("Today", s.present ? "Present ✓" : "Absent ✗", "Attendance status", s.present ? "good" : "danger");

  // Attendance
  document.getElementById("parentAttendanceDetail").innerHTML = `
    <div class="att-display">
      <div class="att-pct ${attCls}">${attPct}%</div>
      <div class="att-meta">
        <strong>${s.attendanceHistory.present}</strong> classes attended<br>
        out of <strong>${s.attendanceHistory.total}</strong> total<br>
        <span class="pill ${s.present ? "pill-green" : "pill-red"}" style="margin-top:6px;display:inline-flex;">${s.present ? "Present Today" : "Absent Today"}</span>
      </div>
    </div>
    ${attPct < 75 ? `<div style="background:var(--amber-100);color:var(--amber-600);padding:10px 12px;border-radius:6px;font-size:12.5px;font-weight:600;">⚠ Your ward's attendance is below 75%.</div>` : ""}`;

  // Fees
  document.getElementById("parentFeesDetail").innerHTML =
    detailRow("Total Fees", money(s.feesTotal)) +
    detailRow("Fees Paid", money(s.feesPaid)) +
    detailRow("Outstanding", money(s.duesAmount)) +
    (s.duesAmount > 0 ? `<div style="margin-top:10px;"><span class="pill pill-amber">Payment Pending — please contact the fees office</span></div>` : `<div style="margin-top:10px;"><span class="pill pill-green">Fully Cleared ✓</span></div>`);

  // Hostel + Transport
  const hostel = state.hostels.find(h => h.id === s.hostelId);
  const route = state.transport.find(t => t.id === s.transportId);
  document.getElementById("parentHostelTransport").innerHTML =
    (hostel ? detailRow("🏠 Block", hostel.name) + detailRow("Warden", hostel.warden) + detailRow("Warden Contact", "See warden's office") : detailRow("Hostel", "Not allocated")) +
    (route ? `<div style="margin-top:8px;">` + detailRow("🚌 Route", route.routeName) + detailRow("Timing", route.timing) + detailRow("Driver", route.driver) + `</div>` : detailRow("Transport", "Not allocated"));

  // Exams
  const myExams = state.exams.filter(x => x.course === s.course).sort((a, b) => a.date.localeCompare(b.date));
  document.getElementById("parentExams").innerHTML = myExams.length
    ? myExams.map(x => `
      <div class="exam-item">
        <div class="exam-subject">${escapeHtml(x.subject)}</div>
        <div class="exam-meta">${escapeHtml(x.date)} · ${escapeHtml(x.time)} · ${escapeHtml(x.room)}</div>
      </div>`).join("")
    : `<div class="empty-state">No upcoming exams.</div>`;

  // Visitor log (visits to their ward)
  const myVisits = state.visitors.filter(v => v.hostStudentId === s.id);
  document.getElementById("parentVisitorLog").innerHTML = myVisits.length
    ? `<table class="data-table"><thead><tr><th>Visitor</th><th>Purpose</th><th>Check-In</th><th>Check-Out</th><th>Status</th></tr></thead><tbody>${
        myVisits.map(v => `<tr>
          <td>${escapeHtml(v.name)}</td>
          <td>${escapeHtml(v.purpose)}</td>
          <td class="mono">${fmtTime(v.checkIn)}</td>
          <td class="mono">${v.checkOut ? fmtTime(v.checkOut) : "—"}</td>
          <td><span class="pill ${v.status === "checked-in" ? "pill-amber" : "pill-green"}">${v.status}</span></td>
        </tr>`).join("")
      }</tbody></table>`
    : `<div class="empty-state">No campus visits on record for your ward.</div>`;

  // Safety feed
  const notices = [...state.sos.filter(a => a.status === "active"), ...state.incidents.filter(i => i.status === "active"), ...state.broadcasts.slice(0, 2)];
  document.getElementById("parentSafetyFeed").innerHTML = notices.length
    ? notices.map(n => {
      const isSos = !!n.triggeredBy;
      const isBroadcast = !!n.issuedBy;
      const label = isSos ? `🚨 SOS: ${n.triggeredBy}` : isBroadcast ? `📢 ${n.message}` : `⚠ ${n.type} at ${n.location}`;
      const cls = isSos ? "severity-active" : isBroadcast ? `level-${n.level || "info"}` : "severity-active";
      return `<div class="feed-item ${cls}"><div class="feed-item-top"><span>${escapeHtml(label)}</span></div><div class="feed-item-meta">${fmtTime(n.timestamp)}</div></div>`;
    }).join("")
    : `<div class="empty-state">No active safety notices.</div>`;
}

function initStudentPortal() {
  const form = document.getElementById("studentIncidentForm");
  if (form) form.addEventListener("submit", async e => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target).entries());
    payload.reportedBy = currentUser ? currentUser.name : "Student";
    try { await API.post("/api/incidents", payload); showToast("Incident reported. Thank you.", "success"); e.target.reset(); await loadAll(); }
    catch (err) { showToast(err.message, "danger"); }
  });
}

function initParentPortal() {
  const btn = document.getElementById("btnParentCheckin");
  if (btn) btn.addEventListener("click", () => {
    const s = currentUser ? state.students.find(x => x.id === currentUser.studentId) : null;
    openModal("Request Campus Visit", `
      <form id="parentVisitForm" class="stacked-form">
        <div class="field"><label>Your Name</label><input class="input" name="name" required value="${currentUser ? escapeHtml(currentUser.name) : ""}"/></div>
        <div class="field"><label>Purpose</label><input class="input" name="purpose" required placeholder="e.g. Parent-Teacher Meeting"/></div>
        <div class="field"><label>ID Proof</label><input class="input" name="idProof" placeholder="e.g. Aadhar / Passport"/></div>
        <button type="submit" class="btn btn-primary" style="margin-top:6px;">Check In</button>
      </form>`, container => {
      container.querySelector("#parentVisitForm").addEventListener("submit", async e => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const payload = { name: fd.get("name"), purpose: fd.get("purpose"), idProof: fd.get("idProof"), hostStudentId: s ? s.id : null };
        try { await API.post("/api/visitors", payload); closeModal(); showToast("Visit check-in recorded.", "success"); await loadAll(); }
        catch (err) { showToast(err.message, "danger"); }
      });
    });
  });

  const form = document.getElementById("parentIncidentForm");
  if (form) form.addEventListener("submit", async e => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target).entries());
    payload.reportedBy = currentUser ? currentUser.name : "Parent";
    try { await API.post("/api/incidents", payload); showToast("Incident reported. Thank you.", "success"); e.target.reset(); await loadAll(); }
    catch (err) { showToast(err.message, "danger"); }
  });
}

// =========================================================================
// Role badge in sidebar
// =========================================================================
function updateRoleBadge() {
  if (!currentUser) return;
  const badge = document.getElementById("roleBadge");
  const userEl = document.getElementById("roleUser");
  if (!badge || !userEl) return;
  const labels = { admin: "Admin", teacher: "Teacher", student: "Student", parent: "Parent" };
  badge.textContent = labels[currentUser.role] || currentUser.role;
  badge.className = `role-badge badge-${currentUser.role}`;
  userEl.textContent = currentUser.name;
}

// =========================================================================
// KPI strip visibility per role
// =========================================================================
function updateTopbarForRole() {
  const strip = document.getElementById("kpiStrip");
  const sosBtn = document.getElementById("sosButton");
  if (!strip || !sosBtn) return;

  if (currentUser.role === "admin") {
    strip.style.display = "";
    sosBtn.style.display = "";
  } else if (currentUser.role === "teacher") {
    strip.style.display = "";
    sosBtn.style.display = "";
  } else if (currentUser.role === "student") {
    // Students see only their own attendance + SOS button
    strip.style.display = "none";
    sosBtn.style.display = "";
  } else if (currentUser.role === "parent") {
    strip.style.display = "none";
    sosBtn.style.display = "";
  }
}

// =========================================================================
// USERS & CREDENTIALS MODULE (Admin)
// =========================================================================
function renderUsers() {
  const usersTbody = document.querySelector("#usersTable tbody");
  if (usersTbody) {
    usersTbody.innerHTML = state.users.map(u => `
      <tr data-id="${u.id}">
        <td>${escapeHtml(u.name)}</td>
        <td class="mono">${escapeHtml(u.username)}</td>
        <td><span class="hint-role role-${u.role}">${u.role}</span></td>
        <td class="mono" style="font-size:11px;color:var(--ink-500);">${escapeHtml(u.password)}</td>
        <td><button class="btn btn-ghost btn-sm" data-action="admin-change-password" data-id="${u.id}">Change Password</button></td>
      </tr>`).join("");
  }
  
  const reqTbody = document.querySelector("#passwordRequestsTable tbody");
  if (reqTbody) {
    const pending = state.passwordRequests.filter(r => r.status === "pending");
    reqTbody.innerHTML = pending.length ? pending.map(r => `
      <tr data-id="${r.id}">
        <td class="mono">${escapeHtml(r.username)}</td>
        <td>${escapeHtml(r.name)}</td>
        <td>${r.role}</td>
        <td><span class="pill pill-amber">${r.status}</span></td>
        <td class="mono">${fmtTime(r.timestamp)}</td>
        <td>
          <button class="btn btn-sm btn-outline" data-action="approve-pwd-req" data-id="${r.id}">Approve</button>
          <button class="btn btn-sm btn-ghost" data-action="reject-pwd-req" data-id="${r.id}">Reject</button>
        </td>
      </tr>`).join("") : `<tr><td colspan="6" class="empty-state">No pending password reset requests.</td></tr>`;
  }
}

function initUsersModule() {
  const usersTbody = document.querySelector("#usersTable tbody");
  if (usersTbody) usersTbody.addEventListener("click", e => {
    const btn = e.target.closest("button[data-action='admin-change-password']");
    if (!btn) return;
    const u = state.users.find(x => x.id === btn.dataset.id);
    openModal("Change Password for " + u.name, `
      <form id="adminPwdForm" class="stacked-form">
        <div class="field"><label>New Password</label><input class="input" type="password" name="newPassword" required /></div>
        <button type="submit" class="btn btn-primary" style="margin-top:6px;">Update Password</button>
      </form>`, container => {
      container.querySelector("#adminPwdForm").addEventListener("submit", async ev => {
        ev.preventDefault();
        const newPassword = new FormData(ev.target).get("newPassword");
        try {
          await API.put(`/api/users/${u.id}/admin-password`, { newPassword });
          closeModal();
          showToast("Password updated for " + u.username, "success");
          await loadAll();
        } catch (err) { showToast(err.message, "danger"); }
      });
    });
  });

  const reqTbody = document.querySelector("#passwordRequestsTable tbody");
  if (reqTbody) reqTbody.addEventListener("click", async e => {
    const btnApprove = e.target.closest("button[data-action='approve-pwd-req']");
    const btnReject = e.target.closest("button[data-action='reject-pwd-req']");
    if (btnApprove) {
      try { await API.put(`/api/password-requests/${btnApprove.dataset.id}/approve`); showToast("Password request approved.", "success"); await loadAll(); }
      catch (err) { showToast(err.message, "danger"); }
    } else if (btnReject) {
      try { await API.del(`/api/password-requests/${btnReject.dataset.id}`); showToast("Password request rejected.", "success"); await loadAll(); }
      catch (err) { showToast(err.message, "danger"); }
    }
  });
}

function initChangePassword() {
  const btn = document.getElementById("changePasswordBtn");
  if (!btn) return;
  btn.addEventListener("click", () => {
    openModal("Change My Password", `
      <form id="changeMyPwdForm" class="stacked-form">
        <div class="field"><label>Current Password</label><input class="input" type="password" name="oldPassword" required /></div>
        <div class="field"><label>New Password</label><input class="input" type="password" name="newPassword" required /></div>
        <button type="submit" class="btn btn-primary" style="margin-top:6px;">Update Password</button>
      </form>`, container => {
      container.querySelector("#changeMyPwdForm").addEventListener("submit", async ev => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        try {
          await API.put(`/api/users/${currentUser.id}/password`, { oldPassword: fd.get("oldPassword"), newPassword: fd.get("newPassword") });
          closeModal();
          showToast("Your password was updated.", "success");
          currentUser.password = fd.get("newPassword"); // update local session
          saveSession(currentUser);
        } catch (err) { showToast(err.message, "danger"); }
      });
    });
  });
}

// =========================================================================
// Master data loader
// =========================================================================
async function loadAll() {
  const [students, hostels, transport, exams, incidents, sos, visitors, broadcasts] = await Promise.all([
    API.get("/api/students"),
    API.get("/api/hostels"),
    API.get("/api/transport"),
    API.get("/api/exams"),
    API.get("/api/incidents"),
    API.get("/api/sos"),
    API.get("/api/visitors"),
    API.get("/api/broadcasts")
  ]);
  Object.assign(state, { students, hostels, transport, exams, incidents, sos, visitors, broadcasts });

  if (currentUser && currentUser.role === "admin") {
    const [users, passwordRequests] = await Promise.all([
      API.get("/api/users"),
      API.get("/api/password-requests")
    ]);
    Object.assign(state, { users, passwordRequests });
  }

  if (!currentUser) return;

  if (currentUser.role === "admin") {
    await renderOverview();
    renderStudents(document.getElementById("studentSearch") ? document.getElementById("studentSearch").value : "");
    renderAttendance();
    renderFees();
    renderHostel();
    renderTransport();
    renderExams();
    renderSafety();
    renderVisitors();
    renderUsers();
    updateBroadcastBanner();
  } else if (currentUser.role === "teacher") {
    await refreshStats();
    renderTeacherPortal();
    renderExams();
    renderSafety();
    updateBroadcastBanner();
  } else if (currentUser.role === "student") {
    renderStudentPortal();
    renderExams();
    updateBroadcastBanner();
  } else if (currentUser.role === "parent") {
    renderParentPortal();
    updateBroadcastBanner();
  }
}

// =========================================================================
// Boot after login
// =========================================================================
async function bootApp() {
  if (!currentUser) return;

  updateRoleBadge();
  updateTopbarForRole();
  buildNav(currentUser.role);
  activateFirstModule();

  initSafetyModule();
  initCopilotModule();
  initChangePassword();

  if (currentUser.role === "admin") {
    initStudentsModule();
    initAttendanceModule();
    initFeesModule();
    initExamsModule();
    initVisitorsModule();
    initUsersModule();
  }
  if (currentUser.role === "teacher") {
    initTeacherPortal();
  }
  if (currentUser.role === "student") {
    initStudentPortal();
  }
  if (currentUser.role === "parent") {
    initParentPortal();
  }

  tickClock();
  setInterval(tickClock, 1000);

  await loadAll().catch(err => showToast("Failed to load data: " + err.message, "danger"));

  // Light auto-refresh every 15 s
  setInterval(() => loadAll().catch(() => {}), 15000);
}

// =========================================================================
// Logout
// =========================================================================
function initLogout() {
  document.getElementById("logoutBtn").addEventListener("click", () => {
    clearSession();
    // Reload page cleanly so all module state is reset
    window.location.reload();
  });
}

// =========================================================================
// DOMContentLoaded — entry point
// =========================================================================
document.addEventListener("DOMContentLoaded", () => {
  initLogin();
  initLogout();

  loadSession();
  if (currentUser) {
    // Already logged in from this session
    hideLoginScreen();
    bootApp();
  } else {
    showLoginScreen();
  }
});
