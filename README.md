# Campus Ops — Smart & Safe Campus ERP

A single, unified, fully offline ERP + Campus Safety platform.
No cloud database, no paid APIs, no API keys. Everything runs locally on
Node.js with an in-memory data store, and a rule-based local "AI Copilot".

---

## 1. Architecture Overview

```
C:\SmartCampusERP
│
├── package.json          → dependency manifest (Express only)
├── server.js              → Express app: all REST API routes
├── data/
│   └── store.js           → in-memory data store + realistic seed data
├── utils/
│   └── ai.js               → rule-based / local NLP Copilot engine
├── public/                 → the frontend SPA (served as static files)
│   ├── index.html           → dashboard markup (sidebar + 10 modules)
│   ├── style.css             → design system + component styles
│   └── app.js                 → fetch-based frontend controller
└── README.md
```

**Stack**
- Backend: Node.js + Express (single process, in-memory store — no DB setup)
- Frontend: Vanilla HTML5 + CSS Grid/Flexbox + native `fetch` (no framework, no build step)
- AI Copilot: 100% local keyword/intent pattern-matcher that reads live data from
  the in-memory store — **no external LLM/API call is ever made**.
- Persistence: In-memory JS arrays, pre-loaded with seed data on boot.
  Restarting the server resets to the seed dataset (by design, for demo repeatability).

**Why this satisfies the constraints**
- Zero external services: only dependency is `express` (installed once from npm, runs
  fully offline afterward).
- Zero DB setup: no SQLite file, no ODBC driver, no cloud connection string — just
  process memory.
- Single unified dashboard: one SPA, one sidebar, ERP + Safety + AI Copilot all
  in the same window, backed by one Express server.

---

## 2. Setup Instructions (Windows 11, PowerShell or CMD)

```powershell
# 1. Create the project folder (skip if you already extracted the provided zip there)
mkdir C:\SmartCampusERP
cd C:\SmartCampusERP

# 2. Place all provided files/folders here so the structure matches section 1 above.

# 3. Install the one dependency (Express). Requires internet access ONLY for this
#    one-time install step; the app itself runs fully offline afterward.
npm install

# 4. Launch the server
npm start

# 5. Open your browser at:
#    http://localhost:4000
```

That's it — no database migrations, no environment variables, no API keys.

To stop the server, press `Ctrl + C` in the terminal.

To reset all data back to the seed dataset, simply stop and restart (`npm start`).

---

## 3. Seed Data Included

- **10 students** across CSE, ECE, EEE, Mech, and IT, with realistic attendance
  history, fee balances (some fully paid, some defaulters), hostel and transport
  allocations.
- **4 hostel blocks** (2 boys, 2 girls) with capacity/occupancy and wardens.
- **5 transport routes** with vehicle numbers, drivers, timings, and seat occupancy.
- **6 upcoming exams** across departments (Exam/Timetable module).
- **3 security incidents** (2 active, 1 resolved) to demonstrate incident tracking.
- **3 visitor log entries** (2 checked-in, 1 checked-out).
- SOS alerts start empty — trigger the panic button live during your demo.

---

## 4. REST API Reference

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/stats` | Dashboard KPI aggregates |
| GET/POST | `/api/students` | List / create students |
| GET/PUT/DELETE | `/api/students/:id` | Read / update / delete a student |
| POST | `/api/attendance/:id/toggle` | Toggle today's attendance (updates history) |
| PUT | `/api/attendance/:id` | Explicitly set present/absent |
| POST | `/api/fees/:id/pay` | Record a fee payment |
| GET | `/api/fees/defaulters` | List students with outstanding dues |
| GET/PUT | `/api/hostels`, `/api/hostels/:id` | Hostel block data |
| POST | `/api/hostels/:id/allocate/:studentId` | Allocate a student to a block |
| GET/PUT | `/api/transport`, `/api/transport/:id` | Transport route data |
| POST | `/api/transport/:id/allocate/:studentId` | Allocate a student to a route |
| GET/POST/DELETE | `/api/exams` | Exam/timetable CRUD |
| GET/POST | `/api/sos` | List / trigger a panic SOS alert |
| PUT | `/api/sos/:id/resolve` | Resolve an SOS alert |
| GET/POST/DELETE | `/api/incidents` | Incident reporting CRUD |
| PUT | `/api/incidents/:id/resolve` | Resolve an incident |
| GET/POST | `/api/broadcasts` | Emergency broadcast feed |
| GET/POST | `/api/visitors` | Visitor log / check-in |
| PUT | `/api/visitors/:id/checkout` | Visitor check-out |
| POST | `/api/ai/query` | AI Copilot — body: `{ "query": "..." }` |

---

## 5. AI Copilot — example queries

- "Who are the fee defaulters?"
- "Show students with low attendance"
- "Any active emergency or SOS alerts?"
- "Hostel occupancy status"
- "Transport route status"
- "Tell me about Ananya Rajan"
- "Active incidents"
- "Exam schedule"

The engine matches intent keywords (fees/dues, attendance, SOS/incident, hostel,
transport, exam, visitor, or a student's name) against the live in-memory store
and returns a computed, structured answer — not a canned string.

---

## 6. Notes for Judges / Demo Tips

- The red hexagonal **SOS button** in the top bar is live: clicking it POSTs a
  real panic alert that instantly appears in the Safety Center and increments
  the "Active SOS Alerts" KPI campus-wide.
- Toggling attendance in the **Attendance** module instantly recalculates the
  campus-wide Attendance Rate KPI — demonstrating real-time state propagation
  without a page reload.
- All data is intentionally in-memory for a hackathon demo; swapping in SQLite
  (via `better-sqlite3` or Python's built-in `sqlite3`) would be a drop-in
  replacement for `data/store.js` without changing any API contracts or frontend
  code, if persistence across restarts is later required.
