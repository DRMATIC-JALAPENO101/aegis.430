/**
 * utils/ai.js
 * -----------------------------------------------------------------------
 * A fully local, rule-based / pattern-matching "AI Copilot" engine.
 * No external LLM API is called — this module inspects the plain-English
 * query with keyword + intent matching, then computes a real answer from
 * the live in-memory data store. This keeps the platform 100% offline.
 * -----------------------------------------------------------------------
 */

function pct(n, d) {
  if (!d) return 0;
  return Math.round((n / d) * 1000) / 10;
}

function attendancePercent(student) {
  return pct(student.attendanceHistory.present, student.attendanceHistory.total);
}

function dues(student) {
  return student.feesTotal - student.feesPaid;
}

function findStudentByName(store, text) {
  const lower = text.toLowerCase();
  return store.students.find(s => lower.includes(s.name.toLowerCase())) || null;
}

/**
 * Main entry point. Takes the raw query string and the data store,
 * returns a structured response: { answer, data, type }
 */
function handleQuery(query, store) {
  const q = query.trim().toLowerCase();

  if (!q) {
    return {
      type: "error",
      answer: "Please type a question — e.g. 'who are the fee defaulters?' or 'show low attendance students'.",
      data: null
    };
  }

  // ---------------- Emergency / SOS / Incident intents ----------------
  if (/\b(sos|panic|emergency|threat)\b/.test(q)) {
    const activeSos = store.sosAlerts.filter(a => a.status === "active");
    if (/how many|count|number of/.test(q) || activeSos.length >= 0) {
      const activeIncidents = store.incidents.filter(i => i.status === "active");
      return {
        type: "emergency",
        answer: `There ${activeSos.length === 1 ? "is" : "are"} currently ${activeSos.length} active SOS alert(s) and ${activeIncidents.length} active security incident(s) on campus. ${activeSos.length > 0 ? "Immediate attention required for SOS alerts." : "No panic alerts are currently active."}`,
        data: { activeSos, activeIncidents }
      };
    }
  }

  if (/\bincident/.test(q)) {
    if (/active|open|unresolved|pending/.test(q)) {
      const list = store.incidents.filter(i => i.status === "active");
      return {
        type: "incidents",
        answer: `There ${list.length === 1 ? "is" : "are"} ${list.length} active/unresolved incident(s): ${list.map(i => `${i.type} at ${i.location}`).join("; ") || "none"}.`,
        data: list
      };
    }
    if (/resolved|closed/.test(q)) {
      const list = store.incidents.filter(i => i.status === "resolved");
      return {
        type: "incidents",
        answer: `There ${list.length === 1 ? "is" : "are"} ${list.length} resolved incident(s).`,
        data: list
      };
    }
    return {
      type: "incidents",
      answer: `Total incidents logged: ${store.incidents.length} (${store.incidents.filter(i => i.status === "active").length} active, ${store.incidents.filter(i => i.status === "resolved").length} resolved).`,
      data: store.incidents
    };
  }

  // ---------------- Fee defaulter intents ----------------
  if (/(fee|dues|due|payment|defaulter|outstanding)/.test(q)) {
    const defaulters = store.students
      .map(s => ({ ...s, outstanding: dues(s) }))
      .filter(s => s.outstanding > 0)
      .sort((a, b) => b.outstanding - a.outstanding);

    const totalOutstanding = defaulters.reduce((sum, s) => sum + s.outstanding, 0);

    if (/how much|total/.test(q)) {
      return {
        type: "fees",
        answer: `Total outstanding dues across the campus: ₹${totalOutstanding.toLocaleString("en-IN")} from ${defaulters.length} student(s).`,
        data: defaulters
      };
    }

    return {
      type: "fees",
      answer: defaulters.length
        ? `${defaulters.length} student(s) have pending dues totaling ₹${totalOutstanding.toLocaleString("en-IN")}. Top defaulter: ${defaulters[0].name} (₹${defaulters[0].outstanding.toLocaleString("en-IN")} due).`
        : "No students currently have outstanding dues. All fees are cleared.",
      data: defaulters
    };
  }

  // ---------------- Attendance intents ----------------
  if (/attendance|absent|present/.test(q)) {
    const specific = findStudentByName(store, q);
    if (specific) {
      return {
        type: "attendance",
        answer: `${specific.name} (${specific.roll}) has an attendance rate of ${attendancePercent(specific)}% (${specific.attendanceHistory.present}/${specific.attendanceHistory.total} classes) and is currently marked ${specific.present ? "PRESENT" : "ABSENT"} today.`,
        data: specific
      };
    }

    if (/low|below|shortage|defaulter|less than 75|<\s*75/.test(q)) {
      const low = store.students
        .map(s => ({ ...s, attendancePct: attendancePercent(s) }))
        .filter(s => s.attendancePct < 75)
        .sort((a, b) => a.attendancePct - b.attendancePct);
      return {
        type: "attendance",
        answer: low.length
          ? `${low.length} student(s) are below the 75% attendance threshold: ${low.map(s => `${s.name} (${s.attendancePct}%)`).join(", ")}.`
          : "All students currently meet the minimum 75% attendance requirement.",
        data: low
      };
    }

    const absentToday = store.students.filter(s => !s.present);
    const avgAttendance = pct(
      store.students.reduce((sum, s) => sum + s.attendanceHistory.present, 0),
      store.students.reduce((sum, s) => sum + s.attendanceHistory.total, 0)
    );

    return {
      type: "attendance",
      answer: `Overall campus attendance rate is ${avgAttendance}%. ${absentToday.length} student(s) are absent today: ${absentToday.map(s => s.name).join(", ") || "none"}.`,
      data: { avgAttendance, absentToday }
    };
  }

  // ---------------- Hostel intents ----------------
  if (/hostel|room|block/.test(q)) {
    const full = store.hostels.filter(h => h.occupied >= h.capacity * 0.9);
    return {
      type: "hostel",
      answer: `Campus has ${store.hostels.length} hostel blocks. ${full.length > 0 ? `Nearing capacity: ${full.map(h => h.name).join(", ")}.` : "All blocks have healthy vacancy."} Total occupancy: ${store.hostels.reduce((s, h) => s + h.occupied, 0)}/${store.hostels.reduce((s, h) => s + h.capacity, 0)}.`,
      data: store.hostels
    };
  }

  // ---------------- Transport intents ----------------
  if (/transport|bus|route/.test(q)) {
    return {
      type: "transport",
      answer: `There are ${store.transportRoutes.length} active transport routes, carrying ${store.transportRoutes.reduce((s, t) => s + t.occupied, 0)} students out of a total capacity of ${store.transportRoutes.reduce((s, t) => s + t.capacity, 0)}.`,
      data: store.transportRoutes
    };
  }

  // ---------------- Exam / Timetable intents ----------------
  if (/exam|timetable|schedule/.test(q)) {
    return {
      type: "exams",
      answer: `There are ${store.exams.length} upcoming exams scheduled. Next up: ${store.exams[0].subject} (${store.exams[0].course}) on ${store.exams[0].date}.`,
      data: store.exams
    };
  }

  // ---------------- Visitor intents ----------------
  if (/visitor|guest/.test(q)) {
    const checkedIn = store.visitors.filter(v => v.status === "checked-in");
    return {
      type: "visitors",
      answer: `${checkedIn.length} visitor(s) currently on campus: ${checkedIn.map(v => v.name).join(", ") || "none"}.`,
      data: store.visitors
    };
  }

  // ---------------- Student lookup fallback ----------------
  const student = findStudentByName(store, q);
  if (student) {
    return {
      type: "student",
      answer: `${student.name} (${student.roll}, ${student.course}) — Attendance: ${attendancePercent(student)}%, Dues: ₹${dues(student).toLocaleString("en-IN")}, Hostel: ${student.hostelId}, Transport: ${student.transportId}.`,
      data: student
    };
  }

  // ---------------- Default ----------------
  return {
    type: "unknown",
    answer: "I can help with: attendance summaries, fee defaulters, active SOS/incidents, hostel occupancy, transport routes, exam schedules, and visitor logs. Try asking something like 'who are the fee defaulters?' or 'show students with low attendance'.",
    data: null
  };
}

module.exports = { handleQuery, attendancePercent, dues };
