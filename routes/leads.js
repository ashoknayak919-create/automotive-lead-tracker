// routes/leads.js
const express = require("express");
const router  = express.Router();
const leadService    = require("../services/leadService");
const followupService= require("../services/followupService");

// GET /api/leads — list all leads with optional filters
router.get("/", async (req, res) => {
  try {
    const leads = await leadService.getLeads(req.query);
    res.json({ success: true, count: leads.length, leads });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/leads/stats — dashboard pipeline counts
router.get("/stats", async (req, res) => {
  try {
    const stats = await leadService.getStats();
    res.json({ success: true, ...stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/leads/:id — single lead
router.get("/:id", async (req, res) => {
  try {
    const lead = await leadService.getLeadById(req.params.id);
    if (!lead) return res.status(404).json({ success: false, error: "Lead not found" });
    res.json({ success: true, lead });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/leads — create manual lead
router.post("/", async (req, res) => {
  try {
    const lead = await leadService.createLead({ ...req.body, adSource: "Manual" });
    res.status(201).json({ success: true, lead });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/leads/:id — update lead fields
router.patch("/:id", async (req, res) => {
  try {
    const lead = await leadService.updateLead(req.params.id, req.body);
    res.json({ success: true, lead });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/leads/:id/stage — advance stage
router.patch("/:id/stage", async (req, res) => {
  try {
    const { stage } = req.body;
    if (!stage) return res.status(400).json({ success: false, error: "stage is required" });
    const lead = await leadService.advanceStage(req.params.id, stage);

    // Schedule post-visit follow-ups when stage moves to SHOWROOM_VISIT
    if (stage === "SHOWROOM_VISIT") {
      await followupService.schedulePostVisitFollowups(req.params.id, lead);
    }
    // Schedule post-delivery tasks
    if (stage === "DELIVERED") {
      await followupService.schedulePostDeliveryTasks(req.params.id, lead);
    }

    res.json({ success: true, lead });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/leads/:id/lost — mark as lost
router.patch("/:id/lost", async (req, res) => {
  try {
    const lead = await leadService.markLost(req.params.id, req.body.reason);
    await followupService.cancelLeadTasks(req.params.id);
    res.json({ success: true, lead });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
