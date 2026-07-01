// config/firebase.js
// ─────────────────────────────────────────────────────────────
// Firebase Admin SDK — initializes once and exports db + auth
// ─────────────────────────────────────────────────────────────

const admin = require("firebase-admin");
require("dotenv").config();

// Prevent re-initialization if already running (hot reload safe)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  });
}

const db   = admin.firestore();
const auth = admin.auth();

// Firestore collection references — single source of truth
const COLLECTIONS = {
  LEADS:    "leads",          // all CRM leads
  JOURNEYS: "journeys",       // per-lead journey steps
  BOOKINGS: "bookings",       // showroom visit bookings
  FOLLOWUPS:"followups",      // scheduled follow-up tasks
  DELIVERIES:"deliveries",    // delivery checklists
  BRANDS:   "brands",         // brand/showroom config
  LOGS:     "webhook_logs",   // raw Meta webhook payloads (audit)
};

module.exports = { admin, db, auth, COLLECTIONS };
