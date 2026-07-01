// services/leadService.js
// ═══════════════════════════════════════════════════════════════
// All database operations for leads
// ═══════════════════════════════════════════════════════════════

const { db, COLLECTIONS } = require("../config/firebase");

// ── Create a new lead ──────────────────────────────────────────
async function createLead(data) {
  const ref = await db.collection(COLLECTIONS.LEADS).add({
    ...data,
    stage:     data.stage || "NEW",
    status:    "ACTIVE",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return { id: ref.id, ...data };
}

// ── Get all leads (with optional filters) ─────────────────────
async function getLeads({ stage, brand, branch, limit = 50, offset = 0 } = {}) {
  let query = db.collection(COLLECTIONS.LEADS).orderBy("createdAt", "desc");
  if (stage)  query = query.where("stage",  "==", stage);
  if (brand)  query = query.where("brand",  "==", brand);
  if (branch) query = query.where("branch", "==", branch);
  query = query.limit(Number(limit));
  const snap = await query.get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ── Get single lead by ID ──────────────────────────────────────
async function getLeadById(id) {
  const doc = await db.collection(COLLECTIONS.LEADS).doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

// ── Update lead fields ─────────────────────────────────────────
async function updateLead(id, data) {
  await db.collection(COLLECTIONS.LEADS).doc(id).update({
    ...data,
    updatedAt: new Date().toISOString(),
  });
  return getLeadById(id);
}

// ── Move lead to next stage ────────────────────────────────────
const STAGE_ORDER = [
  "NEW", "CONTACTED", "VISIT_BOOKED", "SHOWROOM_VISIT",
  "TEST_DRIVE", "NEGOTIATION", "BOOKING", "DELIVERED", "LOST",
];

async function advanceStage(id, newStage) {
  const lead = await getLeadById(id);
  if (!lead) throw new Error("Lead not found");
  const validStages = STAGE_ORDER;
  if (!validStages.includes(newStage)) throw new Error("Invalid stage: " + newStage);
  return updateLead(id, { stage: newStage });
}

// ── Check duplicate by phone (within 24 hrs) ──────────────────
async function checkDuplicate(mobile) {
  if (!mobile) return false;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const snap = await db.collection(COLLECTIONS.LEADS)
    .where("mobile", "==", mobile)
    .where("createdAt", ">=", since)
    .limit(1)
    .get();
  return !snap.empty;
}

// ── Delete / mark lost ────────────────────────────────────────
async function markLost(id, reason = "") {
  return updateLead(id, { stage: "LOST", status: "LOST", lostReason: reason });
}

// ── Stats for dashboard ────────────────────────────────────────
async function getStats() {
  const snap = await db.collection(COLLECTIONS.LEADS).get();
  const counts = {};
  STAGE_ORDER.forEach((s) => (counts[s] = 0));
  snap.docs.forEach((d) => {
    const s = d.data().stage || "NEW";
    counts[s] = (counts[s] || 0) + 1;
  });
  return { total: snap.size, byStage: counts };
}

module.exports = { createLead, getLeads, getLeadById, updateLead, advanceStage, checkDuplicate, markLost, getStats };
