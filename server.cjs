// server.js — Entry point: HTTPS server on :42443 + email monitor + cron
"use strict";

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const https = require("https");
const cron = require("node-cron");

const { connectDB, StockReport } = require("./db");
const { backfill, pollOnce, getToken, GRAPH } = require("./monitor");
const { createApp } = require("./api");
const {
  sendNewReportNotification,
  sendBackfillNotification,
} = require("./mailer");

// ── Config ─────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || "42443", 10);
const HOST = process.env.HOST || "0.0.0.0";
const DASHBOARD_URL =
  process.env.DASHBOARD_URL ||
  `https://${process.env.DOMAIN || "localhost"}:${PORT}`;

// ── TLS certs (./certs/ in project root) ──────────────────────────────────
const httpsOptions = {
  key: fs.readFileSync(path.join(__dirname, "certs", "mydomain.key")),
  cert: fs.readFileSync(path.join(__dirname, "certs", "d466aacf3db3f299.crt")),
  ca: fs.readFileSync(path.join(__dirname, "certs", "gd_bundle-g2-g1.crt")),
};

// ── Notification callback ──────────────────────────────────────────────────
async function onNewReport(doc) {
  await sendNewReportNotification(
    doc,
    getToken,
    GRAPH.senderEmail,
    DASHBOARD_URL
  );
}

// ── CLI: backfill mode ─────────────────────────────────────────────────────
const IS_BACKFILL = process.argv.includes("--backfill");

async function main() {
  console.log("🚀 Premier Energies — Stock Intelligence Platform starting...");
  await connectDB();

  if (IS_BACKFILL) {
    const countArg = process.argv[process.argv.indexOf("--backfill") + 1];
    const count = parseInt(countArg, 10) || 10;
    const { saved, total } = await backfill(count, onNewReport);
    const savedReports = await StockReport.find().sort({ reportDate: 1 });
    await sendBackfillNotification(
      saved.length,
      total,
      savedReports,
      getToken,
      GRAPH.senderEmail,
      DASHBOARD_URL
    );
    process.exit(0);
  }

  // ── Express app ────────────────────────────────────────────────────────
  const app = createApp();

  // Serve dashboard.html at / and /dashboard
  const dashboardPath = path.join(__dirname, "dashboard.html");
  app.get("/", (_req, res) => res.sendFile(dashboardPath));
  app.get("/dashboard", (_req, res) => res.sendFile(dashboardPath));

  // ── HTTPS server ───────────────────────────────────────────────────────
  const server = https.createServer(httpsOptions, app);

  server.listen(PORT, HOST, () => {
    console.log(`\n🔐 HTTPS server  →  https://${HOST}:${PORT}`);
    console.log(`   Dashboard    →  ${DASHBOARD_URL}/`);
    console.log(`   API          →  ${DASHBOARD_URL}/api`);
    console.log(`\n   Routes:`);
    console.log(`   GET  /                       → dashboard`);
    console.log(`   GET  /api/reports            → all reports`);
    console.log(`   GET  /api/reports/:id        → single report`);
    console.log(`   GET  /api/timeseries         → customer time-series`);
    console.log(`   GET  /api/customers          → unique customers`);
    console.log(`   GET  /api/warehouse-summary  → warehouse totals`);
    console.log(`   GET  /api/stats              → summary stats`);
    console.log(`   GET  /api/export/csv         → CSV export\n`);
  });

  server.on("error", (err) => {
    console.error("💥 HTTPS server error:", err);
    process.exit(1);
  });

  // ── Graceful shutdown ──────────────────────────────────────────────────
  const shutdown = (sig) => {
    console.log(`\n⏹  ${sig} — shutting down gracefully...`);
    server.close(() => {
      console.log("   Server closed");
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 10000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // ── Initial poll ───────────────────────────────────────────────────────
  console.log("📧 Initial email poll on startup...");
  await pollOnce(onNewReport);

  // ── Cron: every 15 minutes ─────────────────────────────────────────────
  cron.schedule("*/15 * * * *", async () => {
    console.log(
      `[${new Date().toISOString()}] 📧 Polling for new stock emails...`
    );
    await pollOnce(onNewReport);
  });

  console.log("⏰ Email polling scheduled every 15 minutes");
}

main().catch((err) => {
  console.error("💥 Fatal error:", err);
  process.exit(1);
});
