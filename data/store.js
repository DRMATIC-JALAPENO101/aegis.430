/**
 * data/store.js
 * -----------------------------------------------------------------------
 * Single in-memory data store for the entire Smart Campus ERP platform.
 * No external database is used — everything lives in plain JS objects/
 * arrays for the lifetime of the Node.js process. This satisfies the
 * "zero external dependency / zero DB setup" hackathon constraint while
 * still behaving like a real persistence layer (CRUD, IDs, timestamps).
 * -----------------------------------------------------------------------
 */

function nowISO() {
  return new Date().toISOString();
}

// ------------------------- ID counters ---------------------------------
let studentIdCounter = 1;
let incidentIdCounter = 1;
let sosIdCounter = 1;
let visitorIdCounter = 1;
let examIdCounter = 1;

// ------------------------- Hostel Blocks --------------------------------
const hostels = [
  { id: "H1", name: "Aravali Block (Boys)", capacity: 120, occupied: 98, type: "Boys", warden: "Mr. R. Sharma" },
  { id: "H2", name: "Nilgiri Block (Girls)", capacity: 100, occupied: 92, type: "Girls", warden: "Mrs. S. Iyer" },
  { id: "H3", name: "Vindhya Block (Boys)", capacity: 80, occupied: 55, type: "Boys", warden: "Mr. A. Khan" },
  { id: "H4", name: "Satpura Block (Girls)", capacity: 90, occupied: 81, type: "Girls", warden: "Ms. P. Nair" }
];

// ------------------------- Transport Routes ------------------------------
const transportRoutes = [
  { id: "T1", routeName: "Route 1 - City Center", vehicleNo: "TN-09-AB-1234", driver: "Mr. K. Raman", capacity: 45, occupied: 40, timing: "07:30 AM / 04:30 PM" },
  { id: "T2", routeName: "Route 2 - North Campus", vehicleNo: "TN-09-AB-5678", driver: "Mr. V. Das", capacity: 45, occupied: 38, timing: "07:45 AM / 04:45 PM" },
  { id: "T3", routeName: "Route 3 - Riverside", vehicleNo: "TN-09-AB-9012", driver: "Mr. S. Ali", capacity: 40, occupied: 25, timing: "08:00 AM / 05:00 PM" },
  { id: "T4", routeName: "Route 4 - Tech Park", vehicleNo: "TN-09-AB-3456", driver: "Mrs. L. Fernandes", capacity: 50, occupied: 47, timing: "07:15 AM / 04:15 PM" },
  { id: "T5", routeName: "Route 5 - Old Town", vehicleNo: "TN-09-AB-7890", driver: "Mr. G. Bose", capacity: 35, occupied: 20, timing: "08:15 AM / 05:15 PM" }
];

// ------------------------- Students --------------------------------------
const students = [
  { id: 1, name: "Ananya Rajan",     roll: "CSE21001", course: "B.Tech CSE",   year: 2, gender: "Female", present: true,  attendanceHistory: { present: 78, total: 90 }, feesTotal: 120000, feesPaid: 120000, hostelId: "H2", transportId: "T1", contact: "9876500001" },
  { id: 2, name: "Rohit Verma",      roll: "CSE21002", course: "B.Tech CSE",   year: 2, gender: "Male",   present: true,  attendanceHistory: { present: 60, total: 90 }, feesTotal: 120000, feesPaid: 60000,  hostelId: "H1", transportId: "T2", contact: "9876500002" },
  { id: 3, name: "Sneha Patil",      roll: "ECE21015", course: "B.Tech ECE",   year: 2, gender: "Female", present: false, attendanceHistory: { present: 55, total: 90 }, feesTotal: 115000, feesPaid: 115000, hostelId: "H4", transportId: "T3", contact: "9876500003" },
  { id: 4, name: "Arjun Mehta",      roll: "MECH20044", course: "B.Tech Mech", year: 3, gender: "Male",   present: true,  attendanceHistory: { present: 82, total: 90 }, feesTotal: 110000, feesPaid: 40000,  hostelId: "H3", transportId: "T1", contact: "9876500004" },
  { id: 5, name: "Priya Nair",       roll: "CSE22030", course: "B.Tech CSE",   year: 1, gender: "Female", present: true,  attendanceHistory: { present: 40, total: 45 }, feesTotal: 125000, feesPaid: 125000, hostelId: "H2", transportId: "T4", contact: "9876500005" },
  { id: 6, name: "Karthik Subramanian", roll: "EEE21008", course: "B.Tech EEE", year: 2, gender: "Male", present: false, attendanceHistory: { present: 48, total: 90 }, feesTotal: 118000, feesPaid: 0,      hostelId: "H1", transportId: "T5", contact: "9876500006" },
  { id: 7, name: "Divya Krishnan",   roll: "IT21019",  course: "B.Tech IT",    year: 2, gender: "Female", present: true,  attendanceHistory: { present: 85, total: 90 }, feesTotal: 118000, feesPaid: 118000, hostelId: "H4", transportId: "T2", contact: "9876500007" },
  { id: 8, name: "Vikram Singh",     roll: "CSE20077", course: "B.Tech CSE",   year: 4, gender: "Male",   present: true,  attendanceHistory: { present: 88, total: 90 }, feesTotal: 130000, feesPaid: 65000,  hostelId: "H3", transportId: "T3", contact: "9876500008" },
  { id: 9, name: "Meera Iyer",       roll: "ECE22011", course: "B.Tech ECE",   year: 1, gender: "Female", present: false, attendanceHistory: { present: 30, total: 45 }, feesTotal: 122000, feesPaid: 122000, hostelId: "H2", transportId: "T4", contact: "9876500009" },
  { id: 10, name: "Aditya Kulkarni", roll: "MECH21033", course: "B.Tech Mech", year: 2, gender: "Male",  present: true,  attendanceHistory: { present: 70, total: 90 }, feesTotal: 115000, feesPaid: 30000,  hostelId: "H1", transportId: "T5", contact: "9876500010" }
];
studentIdCounter = students.length + 1;

// ------------------------- Exam / Timetable -------------------------------
const exams = [
  { id: examIdCounter++, course: "B.Tech CSE", subject: "Data Structures & Algorithms", date: "2026-09-02", time: "09:30 AM - 12:30 PM", room: "Block A - 101", semester: 3 },
  { id: examIdCounter++, course: "B.Tech CSE", subject: "Database Management Systems", date: "2026-09-04", time: "09:30 AM - 12:30 PM", room: "Block A - 102", semester: 3 },
  { id: examIdCounter++, course: "B.Tech ECE", subject: "Digital Signal Processing", date: "2026-09-03", time: "02:00 PM - 05:00 PM", room: "Block B - 201", semester: 3 },
  { id: examIdCounter++, course: "B.Tech Mech", subject: "Thermodynamics",            date: "2026-09-05", time: "09:30 AM - 12:30 PM", room: "Block C - 105", semester: 5 },
  { id: examIdCounter++, course: "B.Tech EEE", subject: "Power Systems",              date: "2026-09-06", time: "02:00 PM - 05:00 PM", room: "Block B - 203", semester: 3 },
  { id: examIdCounter++, course: "B.Tech IT",  subject: "Computer Networks",          date: "2026-09-07", time: "09:30 AM - 12:30 PM", room: "Block A - 104", semester: 3 }
];

// ------------------------- Security Incidents -----------------------------
const incidents = [
  { id: incidentIdCounter++, type: "Ragging Complaint", description: "Senior student reportedly intimidating juniors near Block A hostel entrance.", location: "Aravali Block (H1)", reportedBy: "Anonymous", status: "resolved", severity: "High", timestamp: "2026-08-10T18:22:00.000Z", resolvedAt: "2026-08-11T09:00:00.000Z" },
  { id: incidentIdCounter++, type: "Suspicious Activity", description: "Unidentified person loitering near the girls' hostel gate after visiting hours.", location: "Nilgiri Block (H2) Gate", reportedBy: "Security Guard - Post 3", status: "active", severity: "High", timestamp: "2026-08-19T21:40:00.000Z", resolvedAt: null },
  { id: incidentIdCounter++, type: "Theft", description: "Laptop reported missing from the central library reading hall.", location: "Central Library", reportedBy: "Rohit Verma", status: "active", severity: "Medium", timestamp: "2026-08-20T14:05:00.000Z", resolvedAt: null }
];

// ------------------------- SOS Alerts (seed empty, live feature) ----------
const sosAlerts = [];

// ------------------------- Visitor Log -------------------------------------
const visitors = [
  { id: visitorIdCounter++, name: "Rakesh Rajan", purpose: "Meeting Ananya Rajan (Parent)", hostStudentId: 1, checkIn: "2026-08-21T09:15:00.000Z", checkOut: null, status: "checked-in", idProof: "Aadhar-XXXX1234" },
  { id: visitorIdCounter++, name: "Courier - BlueDart", purpose: "Package Delivery", hostStudentId: null, checkIn: "2026-08-21T10:05:00.000Z", checkOut: "2026-08-21T10:20:00.000Z", status: "checked-out", idProof: "Company ID" },
  { id: visitorIdCounter++, name: "Dr. Suresh Iyer", purpose: "Guest Lecture - CSE Dept", hostStudentId: null, checkIn: "2026-08-21T11:00:00.000Z", checkOut: null, status: "checked-in", idProof: "Aadhar-XXXX5678" }
];

// ------------------------- Users (Login) --------------------------------
// role: "admin" | "teacher" | "student" | "parent"
// studentId: links teacher (for class) or student/parent to a student record
const users = [
  // ---- Admin ----
  { id: "u-admin",  username: "admin",      password: "admin123",   role: "admin",   name: "Campus Administrator", studentId: null, department: null },

  // ---- Teachers ----
  { id: "u-t1",    username: "prof.kumar",  password: "teach123",   role: "teacher", name: "Prof. Arvind Kumar",  studentId: null, department: "CSE",  subject: "Data Structures & Algorithms" },
  { id: "u-t2",    username: "prof.sheela", password: "teach123",   role: "teacher", name: "Dr. Sheela Menon",    studentId: null, department: "ECE",  subject: "Digital Signal Processing" },

  // ---- Students (one account per seed student) ----
  { id: "u-s1",  username: "ananya.rajan",      password: "student123", role: "student", name: "Ananya Rajan",       studentId: 1,  department: null },
  { id: "u-s2",  username: "rohit.verma",       password: "student123", role: "student", name: "Rohit Verma",        studentId: 2,  department: null },
  { id: "u-s3",  username: "sneha.patil",       password: "student123", role: "student", name: "Sneha Patil",        studentId: 3,  department: null },
  { id: "u-s4",  username: "arjun.mehta",       password: "student123", role: "student", name: "Arjun Mehta",        studentId: 4,  department: null },
  { id: "u-s5",  username: "priya.nair",        password: "student123", role: "student", name: "Priya Nair",         studentId: 5,  department: null },
  { id: "u-s6",  username: "karthik.sub",       password: "student123", role: "student", name: "Karthik Subramanian",studentId: 6,  department: null },
  { id: "u-s7",  username: "divya.krishnan",    password: "student123", role: "student", name: "Divya Krishnan",     studentId: 7,  department: null },
  { id: "u-s8",  username: "vikram.singh",      password: "student123", role: "student", name: "Vikram Singh",       studentId: 8,  department: null },
  { id: "u-s9",  username: "meera.iyer",        password: "student123", role: "student", name: "Meera Iyer",         studentId: 9,  department: null },
  { id: "u-s10", username: "aditya.kulkarni",   password: "student123", role: "student", name: "Aditya Kulkarni",   studentId: 10, department: null },

  // ---- Parents (linked to their ward's student record) ----
  { id: "u-p1",  username: "rakesh.rajan",      password: "parent123",  role: "parent",  name: "Rakesh Rajan",       studentId: 1,  department: null },
  { id: "u-p2",  username: "sunita.verma",      password: "parent123",  role: "parent",  name: "Sunita Verma",       studentId: 2,  department: null },
];

// ------------------------- Password Reset Requests ------------------------
const passwordRequests = [];
let passwordRequestIdCounter = 1;

module.exports = {
  nowISO,
  hostels,
  transportRoutes,
  students,
  exams,
  incidents,
  sosAlerts,
  visitors,
  users,
  passwordRequests,
  counters: {
    nextStudentId: () => studentIdCounter++,
    nextIncidentId: () => incidentIdCounter++,
    nextSosId: () => sosIdCounter++,
    nextVisitorId: () => visitorIdCounter++,
    nextExamId: () => examIdCounter++,
    nextPasswordRequestId: () => passwordRequestIdCounter++
  }
};
