// services/whatsappService.js
// ═══════════════════════════════════════════════════════════════
// WhatsApp auto-messaging via AiSensy API
// Sends: new lead welcome, visit reminder, booking confirm,
//        delivery congrats, follow-up nudges, review request
// ═══════════════════════════════════════════════════════════════

const axios = require("axios");
require("dotenv").config();

const AISENSY_BASE = "https://backend.aisensy.com/campaign/t1/api/v2";
const API_KEY      = process.env.WHATSAPP_API_KEY;

// ── Core send function ─────────────────────────────────────────
async function sendTemplate({ mobile, templateName, variables = [] }) {
  if (!mobile || !API_KEY) {
    console.warn("⚠️  WhatsApp not sent — missing mobile or API key");
    return null;
  }

  // Strip + and spaces for AiSensy
  const phone = mobile.replace(/\D/g, "");

  try {
    const res = await axios.post(
      AISENSY_BASE,
      {
        apiKey:       API_KEY,
        campaignName: templateName,
        destination:  phone,
        userName:     "AutoTrack CRM",
        templateParams: variables,
        media: {},
      },
      { headers: { "Content-Type": "application/json" } }
    );
    console.log(`✅ WhatsApp sent → ${mobile} | template: ${templateName}`);
    return res.data;
  } catch (err) {
    console.error(`❌ WhatsApp failed → ${mobile}:`, err.response?.data || err.message);
    return null;
  }
}

// ── 1. New lead welcome message (fires within 5 min of Meta lead) ──
async function sendNewLeadMessage({ name, mobile, vehicleInterest, branch, leadId }) {
  const bookingLink = `${process.env.APP_BASE_URL || "https://autotrack.trupti.in"}/book/${leadId}`;
  return sendTemplate({
    mobile,
    templateName: process.env.WHATSAPP_CAMPAIGN_NAME_NEW_LEAD || "autotrack_new_lead",
    variables: [
      name,
      vehicleInterest || "your vehicle of interest",
      branch,
      bookingLink,
    ],
  });
}

// ── 2. Visit booking confirmation ─────────────────────────────
async function sendVisitConfirmation({ name, mobile, date, time, showroom, vehicleInterest }) {
  return sendTemplate({
    mobile,
    templateName: "autotrack_visit_confirm",
    variables: [name, vehicleInterest, showroom, date, time],
  });
}

// ── 3. Visit reminder (1 hour before) ─────────────────────────
async function sendVisitReminder({ name, mobile, time, showroom }) {
  return sendTemplate({
    mobile,
    templateName: "autotrack_visit_reminder",
    variables: [name, showroom, time],
  });
}

// ── 4. Post-visit follow-up (if no booking after 48 hrs) ──────
async function sendPostVisitFollowup({ name, mobile, vehicleInterest, offerText }) {
  return sendTemplate({
    mobile,
    templateName: "autotrack_post_visit",
    variables: [name, vehicleInterest, offerText || "special showroom offer"],
  });
}

// ── 5. Booking confirmation ────────────────────────────────────
async function sendBookingConfirmation({ name, mobile, vehicle, amount, deliveryDate }) {
  return sendTemplate({
    mobile,
    templateName: "autotrack_booking_confirm",
    variables: [name, vehicle, `₹${amount}`, deliveryDate],
  });
}

// ── 6. Delivery congratulations ───────────────────────────────
async function sendDeliveryCongrats({ name, mobile, vehicle, regNumber }) {
  return sendTemplate({
    mobile,
    templateName: "autotrack_delivery_congrats",
    variables: [name, vehicle, regNumber || "registration pending"],
  });
}

// ── 7. Google review request (7 days after delivery) ──────────
async function sendReviewRequest({ name, mobile, branch }) {
  const reviewLink = process.env[`GOOGLE_REVIEW_${branch?.replace(/\s/g, "_").toUpperCase()}`]
    || "https://g.page/r/trupti-motors/review";
  return sendTemplate({
    mobile,
    templateName: "autotrack_review_request",
    variables: [name, reviewLink],
  });
}

// ── 8. Cold lead re-engagement (14+ days silent) ──────────────
async function sendReEngagement({ name, mobile, vehicleInterest }) {
  return sendTemplate({
    mobile,
    templateName: "autotrack_re_engage",
    variables: [name, vehicleInterest || "the vehicle you were interested in"],
  });
}

// ── 9. Free service reminder (at 1,000 km) ────────────────────
async function sendServiceReminder({ name, mobile, vehicle }) {
  return sendTemplate({
    mobile,
    templateName: "autotrack_service_reminder",
    variables: [name, vehicle],
  });
}

module.exports = {
  sendNewLeadMessage,
  sendVisitConfirmation,
  sendVisitReminder,
  sendPostVisitFollowup,
  sendBookingConfirmation,
  sendDeliveryCongrats,
  sendReviewRequest,
  sendReEngagement,
  sendServiceReminder,
};
