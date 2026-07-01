// routes/delivery.js
const express = require("express");
const router  = express.Router();
const { db, COLLECTIONS } = require("../config/firebase");
const leadService       = require("../services/leadService");
const whatsappService   = require("../services/whatsappService");
const followupService   = require("../services/followupService");

const DEFAULT_CHECKLIST = [
  { key: "pdi",          label: "PDI (Pre-delivery inspection) completed", done: false },
  { key: "insurance",    label: "Insurance policy issued & shared on WhatsApp", done: false },
  { key: "rto",          label: "RTO registration form submitted", done: false },
  { key: "finance",      label: "Finance / loan disbursement confirmed", done: false },
  { key: "accessories",  label: "Accessories fitted as per order", done: false },
  { key: "numberplate",  label: "Number plate ready", done: false },
  { key: "datetime",     label: "Delivery date & time confirmed with customer", done: false },
  { key: "invoice",      label: "Sale invoice generated", done: false },
  { key: "form_signed",  label: "Form 20 / 21 / 22 signed by customer", done: false },
  { key: "warranty",     label: "Warranty card & owner's manual handed over", done: false },
  { key: "rc_filed",     label: "RC book copy filed", done: false },
];

// GET /api/delivery/:leadId — get delivery checklist
router.get("/:leadId", async (req, res) => {
  try {
    const snap = await db.collection(COLLECTIONS.DELIVERIES)
      .where("leadId", "==", req.params.leadId).limit(1).get();

    if (snap.empty) {
      // Auto-create checklist
      const lead = await leadService.getLeadById(req.params.leadId);
      const delivery = {
        leadId:    req.params.leadId,
        leadName:  lead?.name || "",
        mobile:    lead?.mobile || "",
        vehicle:   lead?.vehicleInterest || "",
        branch:    lead?.branch || "",
        checklist: DEFAULT_CHECKLIST,
        status:    "IN_PROGRESS",
        createdAt: new Date().toISOString(),
      };
      const ref = await db.collection(COLLECTIONS.DELIVERIES).add(delivery);
      return res.json({ success: true, delivery: { id: ref.id, ...delivery } });
    }

    res.json({ success: true, delivery: { id: snap.docs[0].id, ...snap.docs[0].data() } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/delivery/:leadId/check — tick a checklist item
router.patch("/:leadId/check", async (req, res) => {
  try {
    const { key, done } = req.body;
    const snap = await db.collection(COLLECTIONS.DELIVERIES)
      .where("leadId", "==", req.params.leadId).limit(1).get();
    if (snap.empty) return res.status(404).json({ success: false, error: "Delivery record not found" });

    const ref  = snap.docs[0].ref;
    const data = snap.docs[0].data();
    const checklist = data.checklist.map((item) =>
      item.key === key ? { ...item, done: !!done, doneAt: done ? new Date().toISOString() : null } : item
    );
    await ref.update({ checklist, updatedAt: new Date().toISOString() });
    res.json({ success: true, checklist });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/delivery/:leadId/complete — mark vehicle as delivered
router.post("/:leadId/complete", async (req, res) => {
  try {
    const { regNumber, deliveryDate } = req.body;
    const snap = await db.collection(COLLECTIONS.DELIVERIES)
      .where("leadId", "==", req.params.leadId).limit(1).get();
    if (snap.empty) return res.status(404).json({ success: false, error: "Delivery not found" });

    const data = snap.docs[0].data();
    await snap.docs[0].ref.update({
      status: "DELIVERED", regNumber, deliveryDate: deliveryDate || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Advance lead stage to DELIVERED
    await leadService.advanceStage(req.params.leadId, "DELIVERED");

    // Send congratulations WhatsApp
    await whatsappService.sendDeliveryCongrats({
      name:    data.leadName,
      mobile:  data.mobile,
      vehicle: data.vehicle,
      regNumber,
    });

    // Schedule review request (7 days) + service reminder (30 days)
    await followupService.schedulePostDeliveryTasks(req.params.leadId, data);

    res.json({ success: true, message: "Vehicle delivered — congratulations WhatsApp sent!" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
