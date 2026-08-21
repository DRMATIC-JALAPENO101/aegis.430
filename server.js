/**
 * server.js
 * -----------------------------------------------------------------------
 * Smart & Safe Campus ERP — unified backend.
 * Pure Node.js + Express, in-memory data store, zero external services.
 * Run with: npm start   (then open http://localhost:4000)
 * -----------------------------------------------------------------------
 */

const express = require("express");
const path = require("path");
const store = require("./data/store");
const ai = require("./utils/ai");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------
function studentView(s) {
  return {
    ...s,
    attendancePct: ai.attendancePercent(s),
    duesAmount: ai.dues(s)
  };
}

function notFound(res, what) {
  return res.status(404).json({ error: `${what} not found` });
}

// -------------------------------------------------------------------------
// AUTH — Login / Logout / Passwords
// -------------------------------------------------------------------------
app.post("/api/login", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "username and password are required" });
  }
  const user = store.users.find(
    u => u.username === username.trim() && u.password === password
  );
  if (!user) {
    return res.status(401).json({ error: "Invalid username or password" });
  }
  // Return a safe user object (no password)
  const { password: _pw, ...safeUser } = user;
  res.json(safeUser);
});

// Admin gets all users (including passwords for demo purposes so admin can see/change them)
app.get("/api/users", (req, res) => {
  res.json(store.users);
});

// User changes their own password
app.put("/api/users/:id/password", (req, res) => {
  const user = store.users.find(u => u.id === req.params.id);
  if (!user) return notFound(res, "User");
  
  const { oldPassword, newPassword } = req.body;
  if (user.password !== oldPassword) {
    return res.status(400).json({ error: "Incorrect current password" });
  }
  user.password = newPassword;
  res.json({ success: true });
});

// Admin changes a user's password directly
app.put("/api/users/:id/admin-password", (req, res) => {
  const user = store.users.find(u => u.id === req.params.id);
  if (!user) return notFound(res, "User");
  
  const { newPassword } = req.body;
  if (!newPassword) return res.status(400).json({ error: "New password required" });
  user.password = newPassword;
  res.json({ success: true });
});

// Request a password reset (from login screen)
app.post("/api/password-requests", (req, res) => {
  const { username, desiredPassword } = req.body;
  const user = store.users.find(u => u.username === username.trim());
  if (!user) return res.status(404).json({ error: "Username not found" });

  const reqObj = {
    id: store.counters.nextPasswordRequestId(),
    userId: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    desiredPassword,
    status: "pending",
    timestamp: store.nowISO()
  };
  store.passwordRequests.push(reqObj);
  res.json(reqObj);
});

// Admin gets all password requests
app.get("/api/password-requests", (req, res) => {
  res.json(store.passwordRequests);
});

// Admin approves a password request
app.put("/api/password-requests/:id/approve", (req, res) => {
  const reqObj = store.passwordRequests.find(r => r.id === Number(req.params.id));
  if (!reqObj) return notFound(res, "Request");
  
  const user = store.users.find(u => u.id === reqObj.userId);
  if (user) {
    user.password = reqObj.desiredPassword;
  }
  reqObj.status = "approved";
  res.json(reqObj);
});

// Admin rejects/deletes a request
app.delete("/api/password-requests/:id", (req, res) => {
  const idx = store.passwordRequests.findIndex(r => r.id === Number(req.params.id));
  if (idx === -1) return notFound(res, "Request");
  store.passwordRequests.splice(idx, 1);
  res.json({ success: true });
});


// -------------------------------------------------------------------------
// KPI / DASHBOARD STATS
// -------------------------------------------------------------------------
app.get("/api/stats", (req, res) => {
  const totalStudents = store.students.length;
  const totalPresentSum = store.students.reduce((s, st) => s + st.attendanceHistory.present, 0);
  const totalClassesSum = store.students.reduce((s, st) => s + st.attendanceHistory.total, 0);
  const attendanceRate = totalClassesSum ? Math.round((totalPresentSum / totalClassesSum) * 1000) / 10 : 0;
  const outstandingDues = store.students.reduce((s, st) => s + ai.dues(st), 0);
  const activeSOS = store.sosAlerts.filter(a => a.status === "active").length;
  const activeIncidents = store.incidents.filter(i => i.status === "active").length;
  const presentToday = store.students.filter(s => s.present).length;
  const visitorsOnCampus = store.visitors.filter(v => v.status === "checked-in").length;

  res.json({
    totalStudents,
    attendanceRate,
    presentToday,
    absentToday: totalStudents - presentToday,
    outstandingDues,
    activeSOS,
    activeIncidents,
    visitorsOnCampus,
    hostelOccupancy: store.hostels.reduce((s, h) => s + h.occupied, 0),
    hostelCapacity: store.hostels.reduce((s, h) => s + h.capacity, 0),
    transportOccupancy: store.transportRoutes.reduce((s, t) => s + t.occupied, 0),
    transportCapacity: store.transportRoutes.reduce((s, t) => s + t.capacity, 0)
  });
});

// -------------------------------------------------------------------------
// STUDENTS — full CRUD
// -------------------------------------------------------------------------
app.get("/api/students", (req, res) => {
  res.json(store.students.map(studentView));
});

app.get("/api/students/:id", (req, res) => {
  const s = store.students.find(x => x.id === Number(req.params.id));
  if (!s) return notFound(res, "Student");
  res.json(studentView(s));
});

app.post("/api/students", (req, res) => {
  const b = req.body || {};
  if (!b.name || !b.roll) {
    return res.status(400).json({ error: "name and roll are required" });
  }
  const newStudent = {
    id: store.counters.nextStudentId(),
    name: b.name,
    roll: b.roll,
    course: b.course || "B.Tech CSE",
    year: b.year || 1,
    gender: b.gender || "Other",
    present: b.present !== undefined ? !!b.present : true,
    attendanceHistory: b.attendanceHistory || { present: 0, total: 0 },
    feesTotal: b.feesTotal || 100000,
    feesPaid: b.feesPaid || 0,
    hostelId: b.hostelId || null,
    transportId: b.transportId || null,
    contact: b.contact || ""
  };
  store.students.push(newStudent);
  res.status(201).json(studentView(newStudent));
});

app.put("/api/students/:id", (req, res) => {
  const s = store.students.find(x => x.id === Number(req.params.id));
  if (!s) return notFound(res, "Student");
  Object.assign(s, req.body, { id: s.id });
  res.json(studentView(s));
});

app.delete("/api/students/:id", (req, res) => {
  const idx = store.students.findIndex(x => x.id === Number(req.params.id));
  if (idx === -1) return notFound(res, "Student");
  const [removed] = store.students.splice(idx, 1);
  res.json({ deleted: true, student: removed });
});

// -------------------------------------------------------------------------
// ATTENDANCE — toggle present/absent, updates history counters
// -------------------------------------------------------------------------
app.post("/api/attendance/:id/toggle", (req, res) => {
  const s = store.students.find(x => x.id === Number(req.params.id));
  if (!s) return notFound(res, "Student");

  s.attendanceHistory.total += 1;
  if (!s.present) {
    // was absent, marking present today
    s.present = true;
    s.attendanceHistory.present += 1;
  } else {
    // was present, marking absent today
    s.present = false;
    // total already incremented, present count unchanged since absent
  }
  res.json(studentView(s));
});

// Simple explicit set (present=true/false) without mutating history — used for corrections
app.put("/api/attendance/:id", (req, res) => {
  const s = store.students.find(x => x.id === Number(req.params.id));
  if (!s) return notFound(res, "Student");
  if (typeof req.body.present === "boolean") {
    s.present = req.body.present;
  }
  res.json(studentView(s));
});

// -------------------------------------------------------------------------
// FEES
// -------------------------------------------------------------------------
app.post("/api/fees/:id/pay", (req, res) => {
  const s = store.students.find(x => x.id === Number(req.params.id));
  if (!s) return notFound(res, "Student");
  const amount = Number(req.body.amount) || 0;
  s.feesPaid = Math.min(s.feesTotal, s.feesPaid + amount);
  res.json(studentView(s));
});

app.get("/api/fees/defaulters", (req, res) => {
  const defaulters = store.students
    .map(studentView)
    .filter(s => s.duesAmount > 0)
    .sort((a, b) => b.duesAmount - a.duesAmount);
  res.json(defaulters);
});

// -------------------------------------------------------------------------
// HOSTELS
// -------------------------------------------------------------------------
app.get("/api/hostels", (req, res) => res.json(store.hostels));

app.put("/api/hostels/:id", (req, res) => {
  const h = store.hostels.find(x => x.id === req.params.id);
  if (!h) return notFound(res, "Hostel block");
  Object.assign(h, req.body, { id: h.id });
  res.json(h);
});

app.post("/api/hostels/:id/allocate/:studentId", (req, res) => {
  const h = store.hostels.find(x => x.id === req.params.id);
  const s = store.students.find(x => x.id === Number(req.params.studentId));
  if (!h) return notFound(res, "Hostel block");
  if (!s) return notFound(res, "Student");
  if (h.occupied >= h.capacity) {
    return res.status(400).json({ error: "Hostel block is at full capacity" });
  }
  if (s.hostelId) {
    const prev = store.hostels.find(x => x.id === s.hostelId);
    if (prev) prev.occupied = Math.max(0, prev.occupied - 1);
  }
  s.hostelId = h.id;
  h.occupied += 1;
  res.json({ student: studentView(s), hostel: h });
});

// -------------------------------------------------------------------------
// TRANSPORT
// -------------------------------------------------------------------------
app.get("/api/transport", (req, res) => res.json(store.transportRoutes));

app.put("/api/transport/:id", (req, res) => {
  const t = store.transportRoutes.find(x => x.id === req.params.id);
  if (!t) return notFound(res, "Transport route");
  Object.assign(t, req.body, { id: t.id });
  res.json(t);
});

app.post("/api/transport/:id/allocate/:studentId", (req, res) => {
  const t = store.transportRoutes.find(x => x.id === req.params.id);
  const s = store.students.find(x => x.id === Number(req.params.studentId));
  if (!t) return notFound(res, "Transport route");
  if (!s) return notFound(res, "Student");
  if (t.occupied >= t.capacity) {
    return res.status(400).json({ error: "Route is at full capacity" });
  }
  if (s.transportId) {
    const prev = store.transportRoutes.find(x => x.id === s.transportId);
    if (prev) prev.occupied = Math.max(0, prev.occupied - 1);
  }
  s.transportId = t.id;
  t.occupied += 1;
  res.json({ student: studentView(s), route: t });
});

// -------------------------------------------------------------------------
// EXAMS / TIMETABLE
// -------------------------------------------------------------------------
app.get("/api/exams", (req, res) => res.json(store.exams));

app.post("/api/exams", (req, res) => {
  const b = req.body || {};
  if (!b.course || !b.subject || !b.date) {
    return res.status(400).json({ error: "course, subject and date are required" });
  }
  const exam = {
    id: store.counters.nextExamId(),
    course: b.course,
    subject: b.subject,
    date: b.date,
    time: b.time || "TBD",
    room: b.room || "TBD",
    semester: b.semester || 1
  };
  store.exams.push(exam);
  res.status(201).json(exam);
});

app.delete("/api/exams/:id", (req, res) => {
  const idx = store.exams.findIndex(x => x.id === Number(req.params.id));
  if (idx === -1) return notFound(res, "Exam");
  const [removed] = store.exams.splice(idx, 1);
  res.json({ deleted: true, exam: removed });
});

// -------------------------------------------------------------------------
// SAFETY: SOS PANIC ALERTS
// -------------------------------------------------------------------------
app.get("/api/sos", (req, res) => res.json(store.sosAlerts));

app.post("/api/sos", (req, res) => {
  const b = req.body || {};
  const alert = {
    id: store.counters.nextSosId(),
    triggeredBy: b.triggeredBy || "Anonymous User",
    location: b.location || "Unknown location (device GPS unavailable)",
    message: b.message || "Panic SOS triggered — immediate assistance required.",
    status: "active",
    timestamp: store.nowISO(),
    resolvedAt: null
  };
  store.sosAlerts.unshift(alert);
  res.status(201).json(alert);
});

app.put("/api/sos/:id/resolve", (req, res) => {
  const a = store.sosAlerts.find(x => x.id === Number(req.params.id));
  if (!a) return notFound(res, "SOS alert");
  a.status = "resolved";
  a.resolvedAt = store.nowISO();
  res.json(a);
});

// -------------------------------------------------------------------------
// SAFETY: INCIDENT REPORTING & TRACKING
// -------------------------------------------------------------------------
app.get("/api/incidents", (req, res) => res.json(store.incidents));

app.post("/api/incidents", (req, res) => {
  const b = req.body || {};
  if (!b.type || !b.description) {
    return res.status(400).json({ error: "type and description are required" });
  }
  const incident = {
    id: store.counters.nextIncidentId(),
    type: b.type,
    description: b.description,
    location: b.location || "Not specified",
    reportedBy: b.reportedBy || "Anonymous",
    status: "active",
    severity: b.severity || "Medium",
    timestamp: store.nowISO(),
    resolvedAt: null
  };
  store.incidents.unshift(incident);
  res.status(201).json(incident);
});

app.put("/api/incidents/:id/resolve", (req, res) => {
  const i = store.incidents.find(x => x.id === Number(req.params.id));
  if (!i) return notFound(res, "Incident");
  i.status = "resolved";
  i.resolvedAt = store.nowISO();
  res.json(i);
});

app.delete("/api/incidents/:id", (req, res) => {
  const idx = store.incidents.findIndex(x => x.id === Number(req.params.id));
  if (idx === -1) return notFound(res, "Incident");
  const [removed] = store.incidents.splice(idx, 1);
  res.json({ deleted: true, incident: removed });
});

// -------------------------------------------------------------------------
// SAFETY: BROADCAST (Real-Time Emergency Broadcast — in-memory feed)
// -------------------------------------------------------------------------
const broadcasts = [];
let broadcastIdCounter = 1;

app.get("/api/broadcasts", (req, res) => res.json(broadcasts));

app.post("/api/broadcasts", (req, res) => {
  const b = req.body || {};
  if (!b.message) return res.status(400).json({ error: "message is required" });
  const broadcast = {
    id: broadcastIdCounter++,
    message: b.message,
    level: b.level || "info", // info | warning | critical
    issuedBy: b.issuedBy || "Campus Security Office",
    timestamp: store.nowISO()
  };
  broadcasts.unshift(broadcast);
  res.status(201).json(broadcast);
});

// -------------------------------------------------------------------------
// VISITOR MANAGEMENT
// -------------------------------------------------------------------------
app.get("/api/visitors", (req, res) => res.json(store.visitors));

app.post("/api/visitors", (req, res) => {
  const b = req.body || {};
  if (!b.name) return res.status(400).json({ error: "name is required" });
  const visitor = {
    id: store.counters.nextVisitorId(),
    name: b.name,
    purpose: b.purpose || "General Visit",
    hostStudentId: b.hostStudentId || null,
    checkIn: store.nowISO(),
    checkOut: null,
    status: "checked-in",
    idProof: b.idProof || "Not recorded"
  };
  store.visitors.unshift(visitor);
  res.status(201).json(visitor);
});

app.put("/api/visitors/:id/checkout", (req, res) => {
  const v = store.visitors.find(x => x.id === Number(req.params.id));
  if (!v) return notFound(res, "Visitor");
  v.status = "checked-out";
  v.checkOut = store.nowISO();
  res.json(v);
});

// -------------------------------------------------------------------------
// AI COPILOT — rule-based NLP query handler (100% local, no external API)
// -------------------------------------------------------------------------
app.post("/api/ai/query", (req, res) => {
  const query = (req.body && req.body.query) || "";
  const result = ai.handleQuery(query, store);
  res.json(result);
});

// -------------------------------------------------------------------------
// Fallback: serve the SPA for any non-API route
// -------------------------------------------------------------------------
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log("=================================================================");
  console.log("  Smart & Safe Campus ERP — server running");
  console.log(`  Open your browser at: http://localhost:${PORT}`);
  console.log("  All data is in-memory only — restarting resets to seed data.");
  console.log("=================================================================");
});
