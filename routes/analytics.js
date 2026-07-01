// routes/analytics.js
const express = require("express");
const router  = express.Router();
const { db, COLLECTIONS } = require("../config/firebase");
const leadService = require("../services/leadService");

// GET /api/analytics — full dashboard stats
router.get("/", async (req, res) => {
  try {
    const { brand, branch } = req.query;

    // Pipeline counts
    const stats = await leadService.getStats();

    // Leads this month
    const monthStart = new Date();
    monthStart.setDate(1); monthStart.setHours(0,0,0,0);
    const monthSnap = await db.collection(COLLECTIONS.LEADS)
      .where("createdAt", ">=", monthStart.toISOString()).get();

    // Meta Ads leads this month
    const metaSnap = await db.collection(COLLECTIONS.LEADS)
      .where("adSource", "==", "Meta Ads")
      .where("createdAt", ">=", monthStart.toISOString()).get();

    // Deliveries this month
    const deliveredSnap = await db.collection(COLLECTIONS.LEADS)
      .where("stage", "==", "DELIVERED")
      .where("createdAt", ">=", monthStart.toISOString()).get();

    // Pending follow-ups
    const followupSnap = await db.collection(COLLECTIONS.FOLLOWUPS)
      .where("status", "==", "PENDING").get();

    // Conversion rates
    const totalLeads     = stats.total || 1;
    const visitBooked    = (stats.byStage["VISIT_BOOKED"] || 0) + (stats.byStage["SHOWROOM_VISIT"] || 0);
    const delivered      = stats.byStage["DELIVERED"] || 0;

    res.json({
      success: true,
      overview: {
        totalLeads:         stats.total,
        leadsThisMonth:     monthSnap.size,
        metaLeadsThisMonth: metaSnap.size,
        deliveriesThisMonth:deliveredSnap.size,
        pendingFollowups:   followupSnap.size,
      },
      pipeline: stats.byStage,
      conversionRates: {
        leadToVisit:    ((visitBooked / totalLeads) * 100).toFixed(1) + "%",
        visitToDelivery:visitBooked > 0 ? ((delivered / visitBooked) * 100).toFixed(1) + "%" : "0%",
        leadToDelivery: ((delivered / totalLeads) * 100).toFixed(1) + "%",
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
