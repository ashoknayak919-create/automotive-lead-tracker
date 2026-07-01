// services/followupService.js
// ═══════════════════════════════════════════════════════════════
// Auto follow-up engine — schedules tasks and processes them
// Rules:
//   Rule 1 → New Meta lead: WhatsApp in 5 min (done in webhook)
//   Rule 2 → No contact in 24 hrs: alert manager
//   Rule 3 → Post-visit no booking: follow-up at 48hr, 5d, 10d
//   Rule 4 → Cold lead 14+ days: re-engage template
//   Rule 5 → Post-delivery 7d: Google review request
// ═══════════════════════════════════════════════════════════════

const { db, COLLECTIONS } = require("../config/firebase");
const whatsappService = require("./whatsappService");

// ── Schedule initial follow-up tasks when lead is created ──────
async function scheduleInitialFollowups(leadId, leadData) {
  const now = Date.now();
  const tasks = [
    {
      leadId,
      type:        "NO_CONTACT_ALERT",
      label:       "No contact in 24 hrs — alert manager",
      rule:        2,
      scheduledFor: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
      status:      "PENDING",
      leadName:    leadData.name,
      mobile:      leadData.mobile,
      branch:      leadData.branch,
      vehicleInterest: leadData.vehicleInterest,
      createdAt:   new Date().toISOString(),
    },
    {
      leadId,
      type:        "COLD_LEAD_REENGAGE",
      label:       "Cold lead 14 days — re-engage",
      rule:        4,
      scheduledFor: new Date(now + 14 * 24 * 60 * 60 * 1000).toISOString(),
      status:      "PENDING",
      leadName:    leadData.name,
      mobile:      leadData.mobile,
      vehicleInterest: leadData.vehicleInterest,
      createdAt:   new Date().toISOString(),
    },
  ];

  const batch = db.batch();
  for (const task of tasks) {
    const ref = db.collection(COLLECTIONS.FOLLOWUPS).doc();
    batch.set(ref, task);
  }
  await batch.commit();
}

// ── Schedule post-visit follow-up tasks ───────────────────────
async function schedulePostVisitFollowups(leadId, leadData) {
  const now = Date.now();
  const tasks = [
    { delay: 2 * 24 * 60 * 60 * 1000,  label: "Post-visit follow-up at 48 hrs",  type: "POST_VISIT_48H" },
    { delay: 5 * 24 * 60 * 60 * 1000,  label: "Post-visit follow-up at 5 days",  type: "POST_VISIT_5D"  },
    { delay: 10 * 24 * 60 * 60 * 1000, label: "Post-visit follow-up at 10 days", type: "POST_VISIT_10D" },
  ];

  const batch = db.batch();
  for (const t of tasks) {
    const ref = db.collection(COLLECTIONS.FOLLOWUPS).doc();
    batch.set(ref, {
      leadId,
      type:        t.type,
      label:       t.label,
      rule:        3,
      scheduledFor: new Date(now + t.delay).toISOString(),
      status:      "PENDING",
      leadName:    leadData.name,
      mobile:      leadData.mobile,
      vehicleInterest: leadData.vehicleInterest,
      createdAt:   new Date().toISOString(),
    });
  }
  await batch.commit();
}

// ── Schedule post-delivery tasks ──────────────────────────────
async function schedulePostDeliveryTasks(leadId, leadData) {
  const now = Date.now();
  const tasks = [
    { delay: 7  * 24 * 60 * 60 * 1000, type: "REVIEW_REQUEST",   label: "Request Google review at 7 days",  rule: 5 },
    { delay: 30 * 24 * 60 * 60 * 1000, type: "SERVICE_REMINDER", label: "Free service reminder at 30 days",  rule: 6 },
  ];

  const batch = db.batch();
  for (const t of tasks) {
    const ref = db.collection(COLLECTIONS.FOLLOWUPS).doc();
    batch.set(ref, {
      leadId,
      type:        t.type,
      label:       t.label,
      rule:        t.rule,
      scheduledFor: new Date(now + t.delay).toISOString(),
      status:      "PENDING",
      leadName:    leadData.name,
      mobile:      leadData.mobile,
      vehicle:     leadData.vehicleInterest,
      branch:      leadData.branch,
      createdAt:   new Date().toISOString(),
    });
  }
  await batch.commit();
}

// ── Process all due follow-up tasks (run every hour via cron) ──
// Call this from a scheduled Cloud Function or a cron job
async function processDueTasks() {
  const now = new Date().toISOString();
  const snap = await db.collection(COLLECTIONS.FOLLOWUPS)
    .where("status",      "==",  "PENDING")
    .where("scheduledFor", "<=", now)
    .limit(50)
    .get();

  if (snap.empty) {
    console.log("✅ No follow-up tasks due right now");
    return;
  }

  console.log(`⏰ Processing ${snap.size} due follow-up tasks`);

  for (const doc of snap.docs) {
    const task = { id: doc.id, ...doc.data() };
    try {
      await processTask(task);
      await doc.ref.update({ status: "DONE", processedAt: new Date().toISOString() });
    } catch (err) {
      console.error(`❌ Task ${task.id} failed:`, err.message);
      await doc.ref.update({ status: "FAILED", error: err.message });
    }
  }
}

// ── Execute one task based on its type ────────────────────────
async function processTask(task) {
  console.log(`→ Processing task: ${task.type} for ${task.leadName}`);

  switch (task.type) {
    case "NO_CONTACT_ALERT":
      // Check if lead was contacted — if still NEW, alert
      const leadSnap = await db.collection(COLLECTIONS.LEADS).doc(task.leadId).get();
      if (leadSnap.exists && leadSnap.data().stage === "NEW") {
        // Send alert WhatsApp to manager (not customer)
        await whatsappService.sendTemplate?.({
          mobile:       process.env.MANAGER_MOBILE,
          templateName: "autotrack_manager_alert",
          variables:    [task.leadName, task.mobile, task.vehicleInterest],
        });
        console.log(`🚨 Manager alerted: ${task.leadName} not contacted in 24 hrs`);
      }
      break;

    case "POST_VISIT_48H":
    case "POST_VISIT_5D":
    case "POST_VISIT_10D":
      await whatsappService.sendPostVisitFollowup({
        name:            task.leadName,
        mobile:          task.mobile,
        vehicleInterest: task.vehicleInterest,
      });
      break;

    case "COLD_LEAD_REENGAGE":
      const coldLeadSnap = await db.collection(COLLECTIONS.LEADS).doc(task.leadId).get();
      const coldStage = coldLeadSnap.data()?.stage;
      // Only re-engage if not already booked or delivered
      if (!["BOOKING", "DELIVERED", "LOST"].includes(coldStage)) {
        await whatsappService.sendReEngagement({
          name:            task.leadName,
          mobile:          task.mobile,
          vehicleInterest: task.vehicleInterest,
        });
      }
      break;

    case "REVIEW_REQUEST":
      await whatsappService.sendReviewRequest({
        name:   task.leadName,
        mobile: task.mobile,
        branch: task.branch,
      });
      break;

    case "SERVICE_REMINDER":
      await whatsappService.sendServiceReminder({
        name:    task.leadName,
        mobile:  task.mobile,
        vehicle: task.vehicle,
      });
      break;

    default:
      console.warn(`⚠️  Unknown task type: ${task.type}`);
  }
}

// ── Get pending tasks (for dashboard display) ─────────────────
async function getPendingTasks({ limit = 20 } = {}) {
  const now = new Date().toISOString();
  const snap = await db.collection(COLLECTIONS.FOLLOWUPS)
    .where("status", "==", "PENDING")
    .orderBy("scheduledFor", "asc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ── Cancel all pending tasks for a lead ───────────────────────
async function cancelLeadTasks(leadId) {
  const snap = await db.collection(COLLECTIONS.FOLLOWUPS)
    .where("leadId", "==", leadId)
    .where("status", "==", "PENDING")
    .get();
  const batch = db.batch();
  snap.docs.forEach((d) => batch.update(d.ref, { status: "CANCELLED" }));
  await batch.commit();
}

module.exports = {
  scheduleInitialFollowups,
  schedulePostVisitFollowups,
  schedulePostDeliveryTasks,
  processDueTasks,
  getPendingTasks,
  cancelLeadTasks,
};
