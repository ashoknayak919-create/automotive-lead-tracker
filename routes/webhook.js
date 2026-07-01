// routes/webhook.js
// ═══════════════════════════════════════════════════════════════
// Meta Ads Webhook — receives lead events from Facebook/Instagram
// Handles: GET (verification) + POST (lead data)
// ═══════════════════════════════════════════════════════════════

const express  = require("express");
const crypto   = require("crypto");
const router   = express.Router();

const { db, COLLECTIONS }    = require("../config/firebase");
const { routeByVehicle, routeByFormId } = require("../utils/brandRouter");
const leadService    = require("../services/leadService");
const whatsappService= require("../services/whatsappService");
const followupService= require("../services/followupService");

// ── 1. GET /webhook/meta — Meta verification handshake ─────────
// Meta calls this once when you register the webhook in the
// Meta Business dashboard. Must respond with hub.challenge.
router.get("/meta", (req, res) => {
  const mode      = req.query["hub.mode"];
  const token     = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    console.log("✅ Meta webhook verified successfully");
    return res.status(200).send(challenge);
  }

  console.warn("❌ Webhook verification failed — token mismatch");
  return res.status(403).json({ error: "Verification failed" });
});

// ── 2. POST /webhook/meta — Incoming lead events ───────────────
router.post("/meta", async (req, res) => {
  // Always respond 200 immediately so Meta doesn't retry
  res.status(200).json({ received: true });

  try {
    // ── Step A: Verify request signature (security) ────────────
    const signature = req.headers["x-hub-signature-256"];
    if (!verifySignature(req.rawBody, signature)) {
      console.warn("⚠️  Invalid Meta signature — request ignored");
      return;
    }

    const body = req.body;

    // Log raw payload for audit trail
    await db.collection(COLLECTIONS.LOGS).add({
      source:    "meta_webhook",
      payload:   body,
      receivedAt: new Date().toISOString(),
    });

    // ── Step B: Parse each entry in the webhook payload ────────
    if (body.object !== "page") return;

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== "leadgen") continue;

        const leadgenId = change.value?.leadgen_id;
        const formId    = change.value?.form_id;
        const pageId    = change.value?.page_id;

        if (!leadgenId) continue;

        console.log(`📥 New Meta lead — leadgen_id: ${leadgenId}`);

        // ── Step C: Fetch full lead data from Meta Graph API ───
        const leadData = await fetchLeadFromMeta(leadgenId);
        if (!leadData) continue;

        // ── Step D: Parse form fields into CRM fields ──────────
        const parsed = parseLeadFields(leadData, formId, pageId);

        // ── Step E: Deduplicate (same phone in last 24 hrs) ────
        const isDuplicate = await leadService.checkDuplicate(parsed.mobile);
        if (isDuplicate) {
          console.log(`⚠️  Duplicate lead skipped — ${parsed.mobile}`);
          continue;
        }

        // ── Step F: Route to correct brand/branch ──────────────
        const routing = routeByVehicle(parsed.vehicleInterest)
                     || routeByFormId(formId);
        parsed.brand       = routing.brand;
        parsed.branch      = routing.branch;
        parsed.segment     = routing.segment;
        parsed.assignedTeam= routing.assignedTeam;

        // ── Step G: Save lead to Firestore ─────────────────────
        const lead = await leadService.createLead(parsed);
        console.log(`✅ Lead saved — ID: ${lead.id} | ${parsed.name} | ${parsed.branch}`);

        // ── Step H: Create journey record ──────────────────────
        await db.collection(COLLECTIONS.JOURNEYS).add({
          leadId:    lead.id,
          steps: [{
            stage:     "LEAD_CAPTURED",
            label:     "Lead captured from Meta Ads",
            detail:    `${parsed.adSource} · ${parsed.vehicleInterest || "Vehicle TBD"}`,
            timestamp: new Date().toISOString(),
            done:      true,
          }],
          currentStage: "LEAD_CAPTURED",
          createdAt:    new Date().toISOString(),
        });

        // ── Step I: Auto WhatsApp within 5 min ─────────────────
        await whatsappService.sendNewLeadMessage({
          name:            parsed.name,
          mobile:          parsed.mobile,
          vehicleInterest: parsed.vehicleInterest,
          branch:          parsed.branch,
          leadId:          lead.id,
        });

        // ── Step J: Schedule follow-up tasks ───────────────────
        await followupService.scheduleInitialFollowups(lead.id, parsed);

        console.log(`🤖 Auto WhatsApp + follow-up tasks created for ${parsed.name}`);
      }
    }
  } catch (err) {
    console.error("❌ Webhook processing error:", err.message);
  }
});

// ── Helper: Verify Meta X-Hub-Signature-256 ───────────────────
function verifySignature(rawBody, signatureHeader) {
  if (!signatureHeader) return false;
  const expected = "sha256=" + crypto
    .createHmac("sha256", process.env.META_APP_SECRET)
    .update(rawBody)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(signatureHeader)
    );
  } catch {
    return false;
  }
}

// ── Helper: Fetch lead details from Meta Graph API ─────────────
async function fetchLeadFromMeta(leadgenId) {
  const axios = require("axios");
  try {
    const url = `https://graph.facebook.com/v19.0/${leadgenId}`;
    const res = await axios.get(url, {
      params: { access_token: process.env.META_PAGE_ACCESS_TOKEN },
    });
    return res.data;
  } catch (err) {
    console.error("❌ Failed to fetch lead from Meta:", err.response?.data || err.message);
    return null;
  }
}

// ── Helper: Parse Meta field_data array → CRM object ──────────
function parseLeadFields(leadData, formId, pageId) {
  const fields = {};
  for (const f of leadData.field_data || []) {
    fields[f.name.toLowerCase().replace(/\s+/g, "_")] = f.values?.[0] || "";
  }

  // Map common Meta form field names → AutoTrack CRM fields
  return {
    // Identity
    name:            fields.full_name || fields.name || fields.first_name || "Unknown",
    mobile:          normalizePhone(fields.phone_number || fields.mobile || fields.phone || ""),
    email:           fields.email || "",
    // Location
    city:            fields.city || fields.location || "Odisha",
    // Vehicle
    vehicleInterest: fields.vehicle_of_interest || fields.vehicle || fields.model || fields.interested_in || "",
    financeNeeded:   fields.finance_needed || fields.finance || fields.loan || "Unknown",
    // Meta metadata
    metaLeadId:      leadData.id,
    metaFormId:      formId || leadData.form_id || "",
    metaPageId:      pageId || leadData.page_id || "",
    adSource:        "Meta Ads",
    adPlatform:      "Facebook/Instagram",
    // Status
    stage:           "NEW",
    status:          "ACTIVE",
    createdAt:       new Date().toISOString(),
    updatedAt:       new Date().toISOString(),
  };
}

// ── Helper: Normalize Indian phone numbers ─────────────────────
function normalizePhone(phone) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return "+91" + digits;
  if (digits.length === 12 && digits.startsWith("91")) return "+" + digits;
  return digits || phone;
}

module.exports = router;
