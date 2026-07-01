// routes/bookings.js
const express = require("express");
const router  = express.Router();
const { db, COLLECTIONS } = require("../config/firebase");
const whatsappService = require("../services/whatsappService");
const leadService     = require("../services/leadService");

// GET /api/bookings — list all bookings
router.get("/", async (req, res) => {
  try {
    let q = db.collection(COLLECTIONS.BOOKINGS).orderBy("createdAt", "desc").limit(50);
    if (req.query.date) q = q.where("date", "==", req.query.date);
    const snap = await q.get();
    res.json({ success: true, bookings: snap.docs.map((d) => ({ id: d.id, ...d.data() })) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/bookings — create showroom visit booking
router.post("/", async (req, res) => {
  try {
    const { leadId, date, time, showroom, vehicleInterest, name, mobile } = req.body;
    if (!leadId || !date || !time) {
      return res.status(400).json({ success: false, error: "leadId, date, and time are required" });
    }

    const booking = {
      leadId, date, time, showroom,
      vehicleInterest, name, mobile,
      status:    "CONFIRMED",
      createdAt: new Date().toISOString(),
    };

    const ref = await db.collection(COLLECTIONS.BOOKINGS).add(booking);

    // Advance lead stage
    await leadService.advanceStage(leadId, "VISIT_BOOKED");

    // Send WhatsApp confirmation
    await whatsappService.sendVisitConfirmation({ name, mobile, date, time, showroom, vehicleInterest });

    res.status(201).json({ success: true, booking: { id: ref.id, ...booking } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/bookings/:id — update booking (reschedule etc)
router.patch("/:id", async (req, res) => {
  try {
    await db.collection(COLLECTIONS.BOOKINGS).doc(req.params.id).update({
      ...req.body, updatedAt: new Date().toISOString(),
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
