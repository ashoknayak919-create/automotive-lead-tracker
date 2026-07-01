// ═══════════════════════════════════════════════════════════════
// AutoTrack CRM — Main Server Entry Point
// Node.js + Express + Firebase
// Trupti Group · Bhubaneswar, Odisha
// ═══════════════════════════════════════════════════════════════

require("dotenv").config();
const express  = require("express");
const cors     = require("cors");
const morgan   = require("morgan");

const app = express();

// ── Middleware ─────────────────────────────────────────────────
app.use(cors());
app.use(morgan("dev"));

// Raw body needed for Meta webhook signature verification
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf.toString();
    },
  })
);
app.use(express.urlencoded({ extended: true }));

// ── Routes ─────────────────────────────────────────────────────
app.use("/webhook",      require("./routes/webhook"));
app.use("/api/leads",    require("./routes/leads"));
app.use("/api/journey",  require("./routes/journey"));
app.use("/api/bookings", require("./routes/bookings"));
app.use("/api/followups",require("./routes/followups"));
app.use("/api/delivery", require("./routes/delivery"));
app.use("/api/settings", require("./routes/settings"));
app.use("/api/analytics",require("./routes/analytics"));

// ── Health check ───────────────────────────────────────────────
app.get("/", (_req, res) => {
  res.json({
    app:     "AutoTrack CRM",
    group:   "Trupti Group",
    version: "1.0.0",
    status:  "running",
    time:    new Date().toISOString(),
  });
});

// ── Global error handler ───────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error("❌ Unhandled error:", err.message);
  res.status(err.status || 500).json({
    success: false,
    error:   err.message || "Internal server error",
  });
});

// ── Start ──────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚗 AutoTrack CRM backend running on port ${PORT}`);
  console.log(`🔗 Webhook URL: http://localhost:${PORT}/webhook/meta`);
  console.log(`📊 API Base:    http://localhost:${PORT}/api\n`);
});

module.exports = app;
