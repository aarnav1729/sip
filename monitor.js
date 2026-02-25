// monitor.js — Microsoft Graph API email monitor
"use strict";

const { ConfidentialClientApplication } = require("@azure/msal-node");
const axios = require("axios");
const { parseEmailBody, parseReportDate } = require("./parser");
const { connectDB, StockReport } = require("./db");

// ── Credentials ───────────────────────────────────────────────────────────
const GRAPH = {
  tenantId:     process.env.GRAPH_TENANT_ID     || "1c3de7f3-f8d1-41d3-8583-2517cf3ba3b1",
  clientId:     process.env.GRAPH_CLIENT_ID     || "3d310826-2173-44e5-b9a2-b21e940b67f7",
  clientSecret: process.env.GRAPH_CLIENT_SECRET || "2e78Q~yX92LfwTTOg4EYBjNQrXrZ2z5di1Kvebog",
  senderEmail:  process.env.GRAPH_SENDER_EMAIL  || "spot@premierenergies.com",
};

const SUBJECT_FILTER = "Major Customer Stock Report";
const GRAPH_BASE     = "https://graph.microsoft.com/v1.0";

// ── MSAL Client ───────────────────────────────────────────────────────────
const msalClient = new ConfidentialClientApplication({
  auth: {
    clientId:     GRAPH.clientId,
    clientSecret: GRAPH.clientSecret,
    authority:    `https://login.microsoftonline.com/${GRAPH.tenantId}`,
  },
});

let _token       = null;
let _tokenExpiry = 0;

async function getToken() {
  if (_token && Date.now() < _tokenExpiry - 60000) return _token;
  const res    = await msalClient.acquireTokenByClientCredential({ scopes: ["https://graph.microsoft.com/.default"] });
  _token       = res.accessToken;
  _tokenExpiry = res.expiresOn.getTime();
  return _token;
}

function graphGet(path, params = {}) {
  return getToken().then(token =>
    axios.get(`${GRAPH_BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      params,
    })
  );
}

// ── Fetch emails matching subject ─────────────────────────────────────────
async function fetchStockEmails(top = 10) {
  const res    = await graphGet(`/users/${GRAPH.senderEmail}/messages`, {
    $search: `"subject:${SUBJECT_FILTER}"`,
    $top:    top,
    $select: "id,subject,receivedDateTime,body",
  });
  const emails = res.data.value || [];
  emails.sort((a, b) => new Date(b.receivedDateTime) - new Date(a.receivedDateTime));
  return emails.filter(e =>
    e.subject && e.subject.toLowerCase().includes(SUBJECT_FILTER.toLowerCase())
  );
}

// ── Process a single email ────────────────────────────────────────────────
async function processEmail(email, onSaved) {
  const messageId = email.id;

  const existing = await StockReport.findOne({ emailMessageId: messageId });
  if (existing) {
    console.log(`⏭  Already processed: ${email.subject}`);
    return null;
  }

  const body        = email.body?.content     || "";
  const contentType = email.body?.contentType || "html";
  const parsed      = parseEmailBody(body, contentType);

  if (!parsed) {
    console.warn(`⚠️  Could not parse table from: ${email.subject}`);
    return null;
  }

  const { dateStr, rows, grandTotals } = parsed;
  if (!dateStr) {
    console.warn(`⚠️  No date found in: ${email.subject}`);
    return null;
  }

  const dateExists = await StockReport.findOne({ reportDateStr: dateStr });
  if (dateExists) {
    console.log(`⏭  Report for ${dateStr} already in DB`);
    return null;
  }

  const doc = new StockReport({
    reportDate:      parseReportDate(dateStr),
    reportDateStr:   dateStr,
    emailMessageId:  messageId,
    emailSubject:    email.subject,
    emailReceivedAt: new Date(email.receivedDateTime),
    grandTotals,
    rows,
  });

  await doc.save();
  console.log(`✅ Saved report: ${dateStr} (${rows.length} rows)`);

  if (typeof onSaved === "function") {
    onSaved(doc).catch(err => console.error("❌ onSaved callback error:", err.message));
  }

  return doc;
}

// ── Backfill last N emails ────────────────────────────────────────────────
async function backfill(count = 10, onSaved) {
  console.log(`🔄 Backfilling last ${count} emails...`);
  await connectDB();
  const emails = await fetchStockEmails(count);
  console.log(`📧 Found ${emails.length} matching emails`);

  const saved = [];
  for (const email of emails) {
    const doc = await processEmail(email, onSaved);
    if (doc) saved.push(doc);
  }

  console.log(`✅ Backfill complete — ${saved.length} new reports saved`);
  return { saved, total: emails.length };
}

// ── Poll for new emails ───────────────────────────────────────────────────
async function pollOnce(onSaved) {
  try {
    const emails = await fetchStockEmails(5);
    for (const email of emails) {
      await processEmail(email, onSaved);
    }
  } catch (err) {
    console.error("❌ Poll error:", err.message);
  }
}

module.exports = { backfill, pollOnce, getToken, GRAPH };