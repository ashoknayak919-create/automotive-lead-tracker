// routes/journey.js
const express = require("express");
const router  = express.Router();
const { db, COLLECTIONS } = require("../config/firebase");

// GET /api/journey/:leadId — get full journey for a lead
router.get("/:leadId", async (req, res) => {
  try {
    const snap = await db.collection(COLLECTIONS.JOURNEYS)
      .where("leadId", "==", req.params.leadId)
      .limit(1).get();
    if (snap.empty) return res.status(404).json({ success: false, error: "Journey not found" });
    const journey = { id: snap.docs[0].id, ...snap.docs[0].data() };
    res.json({ success: true, journey });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/journey/:leadId/step — add a step to the journey
router.post("/:leadId/step", async (req, res) => {
  try {
    const { stage, label, detail } = req.body;
    const snap = await db.collection(COLLECTIONS.JOURNEYS)
      .where("leadId", "==", req.params.leadId).limit(1).get();

    const step = { stage, label, detail, timestamp: new Date().toISOString(), done: true };

    if (snap.empty) {
      // Create journey if it doesn't exist
      await db.collection(COLLECTIONS.JOURNEYS).add({
        leadId: req.params.leadId,
        steps: [step],
        currentStage: stage,
        createdAt: new Date().toISOString(),
      });
    } else {
      const ref = snap.docs[0].ref;
      const existing = snap.docs[0].data().steps || [];
      await ref.update({ steps: [...existing, step], currentStage: stage, updatedAt: new Date().toISOString() });
    }
    res.json({ success: true, step });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
