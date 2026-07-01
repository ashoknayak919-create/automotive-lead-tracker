// routes/followups.js
const express = require("express");
const router  = express.Router();
const followupService = require("../services/followupService");
const { db, COLLECTIONS } = require("../config/firebase");

// GET /api/followups — pending follow-up queue
router.get("/", async (req, res) => {
  try {
    const tasks = await followupService.getPendingTasks({ limit: req.query.limit || 50 });
    res.json({ success: true, count: tasks.length, tasks });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/followups/process — manually trigger due task processing
router.post("/process", async (req, res) => {
  try {
    await followupService.processDueTasks();
    res.json({ success: true, message: "Due tasks processed" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/followups/:id/done — mark task done manually
router.patch("/:id/done", async (req, res) => {
  try {
    await db.collection(COLLECTIONS.FOLLOWUPS).doc(req.params.id).update({
      status: "DONE", processedAt: new Date().toISOString(), processedBy: "manual",
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
