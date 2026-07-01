// routes/settings.js
// ═══════════════════════════════════════════════════════════════
// Settings API — manage all AutoTrack CRM configuration
// Covers: brands, showrooms, follow-up rules, WhatsApp templates,
//         Meta form mappings, notification preferences
// ═══════════════════════════════════════════════════════════════

const express = require("express");
const router  = express.Router();
const { db }  = require("../config/firebase");

const SETTINGS_DOC = "global"; // single document in "settings" collection

// ── Default settings (used on first run) ──────────────────────
const DEFAULT_SETTINGS = {
  // ── Dealership info ────────────────────────────────────────
  dealerGroup: "Trupti Group",
  city:        "Bhubaneswar",
  state:       "Odisha",

  // ── Brands & showrooms ────────────────────────────────────
  brands: [
    {
      id:       "TATA_PV",
      name:     "Trupti Motors",
      segment:  "Passenger",
      maker:    "Tata Motors",
      active:   true,
      showrooms: ["Patrapada", "Baramunda"],
      managerMobile: "",
      googleReviewLink: "https://g.page/r/trupti-motors/review",
    },
    {
      id:       "TATA_CV",
      name:     "Trupti Automotives",
      segment:  "Commercial",
      maker:    "Tata Motors",
      active:   true,
      showrooms: ["Patrapada CV Yard", "Paradeep"],
      managerMobile: "",
      googleReviewLink: "https://g.page/r/trupti-automotives/review",
    },
    {
      id:       "TOYOTA",
      name:     "Trupti Toyota",
      segment:  "Passenger",
      maker:    "Toyota",
      active:   true,
      showrooms: ["Patia", "Patrapada"],
      managerMobile: "",
      googleReviewLink: "https://g.page/r/trupti-toyota/review",
    },
  ],

  // ── Follow-up rules ────────────────────────────────────────
  followupRules: [
    {
      id:          "RULE_1",
      name:        "New Meta lead → Auto WhatsApp",
      description: "Send WhatsApp message within 5 minutes of lead capture",
      trigger:     "LEAD_CREATED",
      delayMinutes: 0,
      action:      "SEND_WHATSAPP",
      template:    "autotrack_new_lead",
      active:      true,
    },
    {
      id:          "RULE_2",
      name:        "No contact in 24 hrs → Alert manager",
      description: "If lead stage is still NEW after 24 hours, alert branch manager",
      trigger:     "NO_CONTACT_24H",
      delayMinutes: 1440,
      action:      "ALERT_MANAGER",
      template:    "autotrack_manager_alert",
      active:      true,
    },
    {
      id:          "RULE_3A",
      name:        "Post-visit no booking → Follow-up at 48 hrs",
      description: "If no booking placed within 48 hrs of showroom visit",
      trigger:     "POST_VISIT_NO_BOOKING",
      delayMinutes: 2880,
      action:      "SEND_WHATSAPP",
      template:    "autotrack_post_visit",
      active:      true,
    },
    {
      id:          "RULE_3B",
      name:        "Post-visit follow-up at 5 days",
      trigger:     "POST_VISIT_NO_BOOKING",
      delayMinutes: 7200,
      action:      "SEND_WHATSAPP",
      template:    "autotrack_post_visit",
      active:      true,
    },
    {
      id:          "RULE_3C",
      name:        "Post-visit follow-up at 10 days",
      trigger:     "POST_VISIT_NO_BOOKING",
      delayMinutes: 14400,
      action:      "SEND_WHATSAPP",
      template:    "autotrack_post_visit",
      active:      true,
    },
    {
      id:          "RULE_4",
      name:        "Cold lead 14+ days → Re-engage",
      description: "Send re-engagement message to leads silent for 14+ days",
      trigger:     "COLD_LEAD_14D",
      delayMinutes: 20160,
      action:      "SEND_WHATSAPP",
      template:    "autotrack_re_engage",
      active:      true,
    },
    {
      id:          "RULE_5",
      name:        "Post-delivery → Google review request at 7 days",
      trigger:     "POST_DELIVERY_7D",
      delayMinutes: 10080,
      action:      "SEND_WHATSAPP",
      template:    "autotrack_review_request",
      active:      true,
    },
    {
      id:          "RULE_6",
      name:        "Free service reminder at 30 days",
      trigger:     "POST_DELIVERY_30D",
      delayMinutes: 43200,
      action:      "SEND_WHATSAPP",
      template:    "autotrack_service_reminder",
      active:      true,
    },
  ],

  // ── WhatsApp templates ────────────────────────────────────
  whatsappTemplates: [
    { name: "autotrack_new_lead",       status: "PENDING_APPROVAL", variables: 4 },
    { name: "autotrack_visit_confirm",  status: "PENDING_APPROVAL", variables: 5 },
    { name: "autotrack_visit_reminder", status: "PENDING_APPROVAL", variables: 3 },
    { name: "autotrack_post_visit",     status: "PENDING_APPROVAL", variables: 3 },
    { name: "autotrack_booking_confirm",status: "PENDING_APPROVAL", variables: 4 },
    { name: "autotrack_delivery_congrats",status:"PENDING_APPROVAL",variables: 3 },
    { name: "autotrack_review_request", status: "PENDING_APPROVAL", variables: 2 },
    { name: "autotrack_re_engage",      status: "PENDING_APPROVAL", variables: 2 },
    { name: "autotrack_service_reminder",status:"PENDING_APPROVAL", variables: 2 },
    { name: "autotrack_manager_alert",  status: "PENDING_APPROVAL", variables: 3 },
  ],

  // ── Meta form field mapping ────────────────────────────────
  metaFieldMapping: {
    name:            ["full_name", "name", "first_name"],
    mobile:          ["phone_number", "mobile", "phone"],
    email:           ["email"],
    vehicleInterest: ["vehicle_of_interest", "vehicle", "model", "interested_in"],
    city:            ["city", "location"],
    financeNeeded:   ["finance_needed", "finance", "loan"],
  },

  // ── Notification preferences ──────────────────────────────
  notifications: {
    newLeadAlert:    true,
    dailySummary:    true,
    dailySummaryTime:"08:00",
    managerMobile:   "",
    alertOnLostLead: true,
  },

  // ── Pipeline stage labels ─────────────────────────────────
  stageLabels: {
    NEW:            "New Lead",
    CONTACTED:      "Contacted",
    VISIT_BOOKED:   "Visit Booked",
    SHOWROOM_VISIT: "Showroom Visit",
    TEST_DRIVE:     "Test Drive",
    NEGOTIATION:    "Negotiation",
    BOOKING:        "Booking",
    DELIVERED:      "Delivered",
    LOST:           "Lost",
  },

  updatedAt: new Date().toISOString(),
};

// ── GET /api/settings — get all settings ──────────────────────
router.get("/", async (req, res) => {
  try {
    const doc = await db.collection("settings").doc(SETTINGS_DOC).get();
    if (!doc.exists) {
      // First run — seed defaults
      await db.collection("settings").doc(SETTINGS_DOC).set(DEFAULT_SETTINGS);
      return res.json({ success: true, settings: DEFAULT_SETTINGS, seeded: true });
    }
    res.json({ success: true, settings: doc.data() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── PATCH /api/settings — update any settings fields ──────────
router.patch("/", async (req, res) => {
  try {
    const updates = { ...req.body, updatedAt: new Date().toISOString() };
    await db.collection("settings").doc(SETTINGS_DOC).set(updates, { merge: true });
    res.json({ success: true, message: "Settings updated" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── PATCH /api/settings/rule/:ruleId — toggle or update one rule
router.patch("/rule/:ruleId", async (req, res) => {
  try {
    const doc  = await db.collection("settings").doc(SETTINGS_DOC).get();
    const data = doc.data() || DEFAULT_SETTINGS;
    const rules = data.followupRules.map((r) =>
      r.id === req.params.ruleId ? { ...r, ...req.body } : r
    );
    await db.collection("settings").doc(SETTINGS_DOC).update({
      followupRules: rules, updatedAt: new Date().toISOString(),
    });
    res.json({ success: true, message: `Rule ${req.params.ruleId} updated` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── PATCH /api/settings/brand/:brandId — update brand config ──
router.patch("/brand/:brandId", async (req, res) => {
  try {
    const doc   = await db.collection("settings").doc(SETTINGS_DOC).get();
    const data  = doc.data() || DEFAULT_SETTINGS;
    const brands = data.brands.map((b) =>
      b.id === req.params.brandId ? { ...b, ...req.body } : b
    );
    await db.collection("settings").doc(SETTINGS_DOC).update({
      brands, updatedAt: new Date().toISOString(),
    });
    res.json({ success: true, message: `Brand ${req.params.brandId} updated` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/settings/reset — reset to defaults ──────────────
router.post("/reset", async (req, res) => {
  try {
    await db.collection("settings").doc(SETTINGS_DOC).set(DEFAULT_SETTINGS);
    res.json({ success: true, message: "Settings reset to defaults" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
