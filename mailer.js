// mailer.js — Campaign-grade HTML email notifications via Microsoft Graph sendMail
"use strict";

const axios = require("axios");

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const NOTIFY_TO =
  process.env.NOTIFY_EMAIL || "aarnav.singh@premierenergies.com";

// ── Colour tokens (PE brand) ────────────────────────────────────────────────
const C = {
  bg: "#09090f",
  card: "#111118",
  card2: "#16161f",
  border: "#1e1e2e",
  accent: "#f0c040",
  accent2: "#e05c30",
  teal: "#38b2ac",
  success: "#34d399",
  danger: "#f87171",
  text: "#e8e8f0",
  muted: "#8888a8",
  faint: "#2a2a3e",
};

const fmt = (n) => (n ?? 0).toLocaleString("en-IN");

// ── Graph sendMail helper ───────────────────────────────────────────────────
async function sendViaGraph(getToken, senderEmail, to, subject, htmlBody) {
  const token = await getToken();
  await axios.post(
    `${GRAPH_BASE}/users/${senderEmail}/sendMail`,
    {
      message: {
        subject,
        body: { contentType: "HTML", content: htmlBody },
        toRecipients: [{ emailAddress: { address: to } }],
      },
      saveToSentItems: true,
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );
}

// ── Shared email chrome ─────────────────────────────────────────────────────
function emailWrap(preheader, body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta http-equiv="X-UA-Compatible" content="IE=edge"/>
<title>Premier Energies</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#09090f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#e8e8f0;-webkit-font-smoothing:antialiased;width:100%;min-width:320px}
  a{color:#f0c040;text-decoration:none}
  img{border:0;display:block;max-width:100%}
  .email-wrapper{background:#09090f;padding:40px 20px}
  .email-card{background:#111118;border:1px solid #1e1e2e;border-radius:16px;max-width:620px;margin:0 auto;overflow:hidden}
  .preheader{display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:transparent}
  @media only screen and (max-width:640px){
    .email-wrapper{padding:20px 12px}
    .stat-grid td{display:block;width:100%!important}
    .table-cell{padding:8px 10px!important;font-size:11px!important}
    .hero-title{font-size:28px!important}
  }
</style>
</head>
<body>
<span class="preheader">${preheader}</span>
<div class="email-wrapper">
${body}
</div>
</body>
</html>`;
}

// ── Divider ─────────────────────────────────────────────────────────────────
const divider = () => `
<tr><td style="padding:0 32px"><div style="height:1px;background:#1e1e2e"></div></td></tr>`;

// ── Header ──────────────────────────────────────────────────────────────────
function headerBlock(tagline = "Stock Intelligence Platform") {
  return `
<tr>
  <td style="padding:32px 32px 24px">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td>
          <table cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="background:#f0c040;border-radius:10px;width:40px;height:40px;text-align:center;vertical-align:middle">
                <span style="font-family:monospace;font-weight:700;font-size:14px;color:#000;line-height:40px">PE</span>
              </td>
              <td style="padding-left:12px">
                <div style="font-size:15px;font-weight:700;color:#e8e8f0;letter-spacing:-.02em">Premier Energies</div>
                <div style="font-size:11px;color:#8888a8;font-family:monospace;margin-top:1px">${tagline}</div>
              </td>
            </tr>
          </table>
        </td>
        <td align="right" style="vertical-align:middle">
          <span style="background:#34d39912;border:1px solid #34d39940;border-radius:20px;padding:4px 12px;font-size:11px;color:#34d399;font-family:monospace;white-space:nowrap">● AUTOMATED ALERT</span>
        </td>
      </tr>
    </table>
  </td>
</tr>`;
}

// ── Footer ──────────────────────────────────────────────────────────────────
function footerBlock() {
  return `
<tr>
  <td style="padding:28px 32px;text-align:center">
    <div style="font-size:11px;color:#3a3a50;font-family:monospace;margin-bottom:8px">
      PREMIER ENERGIES LIMITED &nbsp;·&nbsp; HYDERABAD, INDIA
    </div>
    <div style="font-size:11px;color:#3a3a50">
      This is an automated system notification from the Stock Intelligence Platform.<br/>
      Do not reply to this email.
    </div>
    <div style="margin-top:16px;padding-top:16px;border-top:1px solid #16161f">
      <span style="font-size:10px;color:#2a2a3e;font-family:monospace">
        spot@premierenergies.com &nbsp;·&nbsp; SPOT Monitoring System v2.0
      </span>
    </div>
  </td>
</tr>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// EMAIL 1 — New Report Ingested Notification
// ══════════════════════════════════════════════════════════════════════════════
function buildReportEmail(doc, dashboardUrl) {
  const { reportDateStr, grandTotals, rows, emailSubject } = doc;
  const overall = grandTotals?.overall || 0;
  const activeCustomers = rows.filter((r) => r.grandTotal > 0).length;

  // Top 5 customers
  const top5 = [...rows]
    .sort((a, b) => b.grandTotal - a.grandTotal)
    .slice(0, 5);

  // Warehouse rows (non-zero)
  const WAREHOUSES = [
    { key: "annaramWarehouse", label: "Annaram" },
    { key: "kothurWarehouse", label: "Kothur" },
    { key: "narkudaWarehouse", label: "Narkhuda" },
    { key: "p2Warehouse", label: "P2" },
    { key: "p4Warehouse", label: "P4" },
    { key: "p5Warehouse", label: "P5" },
    { key: "p6Warehouse", label: "P6" },
    { key: "primePackWarehouse", label: "Prime Pack" },
  ];
  const activeWH = WAREHOUSES.filter((w) => (grandTotals?.[w.key] || 0) > 0);

  const whRows = activeWH
    .map((w) => {
      const v = grandTotals?.[w.key] || 0;
      const pct = overall > 0 ? Math.round((v / overall) * 100) : 0;
      const barW = Math.max(4, Math.round((v / overall) * 160));
      return `
    <tr>
      <td style="padding:9px 20px;font-size:13px;color:#b0b0c8;border-bottom:1px solid #1e1e2e">${
        w.label
      }</td>
      <td style="padding:9px 20px;border-bottom:1px solid #1e1e2e">
        <table cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="background:#f0c04022;border-radius:3px;width:160px;height:6px;vertical-align:middle">
            <div style="background:#f0c040;border-radius:3px;width:${barW}px;height:6px"></div>
          </td>
        </tr></table>
      </td>
      <td style="padding:9px 20px;text-align:right;font-size:13px;font-weight:700;color:#e8e8f0;font-family:monospace;border-bottom:1px solid #1e1e2e">${fmt(
        v
      )}</td>
      <td style="padding:9px 20px;text-align:right;font-size:11px;color:#8888a8;font-family:monospace;border-bottom:1px solid #1e1e2e">${pct}%</td>
    </tr>`;
    })
    .join("");

  const topCustRows = top5
    .map((r, i) => {
      const colors = ["#f0c040", "#e05c30", "#38b2ac", "#a78bfa", "#34d399"];
      const barW = Math.max(
        4,
        Math.round((r.grandTotal / top5[0].grandTotal) * 120)
      );
      return `
    <tr>
      <td style="padding:8px 20px;font-size:12px;color:#8888a8;font-family:monospace;border-bottom:1px solid #1e1e2e">${
        i + 1
      }</td>
      <td style="padding:8px 20px;border-bottom:1px solid #1e1e2e">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${
            colors[i]
          };flex-shrink:0"></span>
          <span style="font-size:13px;color:#e8e8f0">${r.customerName}</span>
        </div>
      </td>
      <td style="padding:8px 20px;border-bottom:1px solid #1e1e2e">
        <div style="background:${
          colors[i]
        }22;border-radius:3px;height:6px;width:${barW}px"></div>
      </td>
      <td style="padding:8px 20px;text-align:right;font-size:13px;font-weight:700;color:${
        colors[i]
      };font-family:monospace;border-bottom:1px solid #1e1e2e">${fmt(
        r.grandTotal
      )}</td>
    </tr>`;
    })
    .join("");

  const card = `
<div class="email-card">
<table width="100%" cellpadding="0" cellspacing="0" border="0">
  ${headerBlock()}
  ${divider()}

  <!-- Hero -->
  <tr>
    <td style="padding:40px 32px 32px;text-align:center">
      <div style="background:#f0c04010;border:1px solid #f0c04030;display:inline-block;border-radius:8px;padding:6px 16px;margin-bottom:20px">
        <span style="font-family:monospace;font-size:11px;color:#f0c040;letter-spacing:.08em">NEW REPORT INGESTED</span>
      </div>
      <div class="hero-title" style="font-size:36px;font-weight:800;letter-spacing:-.04em;color:#e8e8f0;margin-bottom:8px">
        Stock Report
      </div>
      <div style="font-size:18px;color:#f0c040;font-family:monospace;font-weight:700;margin-bottom:24px">
        ${reportDateStr}
      </div>

      <!-- Big stat trio -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:32px">
        <tr>
          <td style="text-align:center;padding:20px 12px;background:#16161f;border:1px solid #1e1e2e;border-radius:12px 0 0 12px;width:33%">
            <div style="font-size:11px;font-family:monospace;color:#8888a8;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">Total Units</div>
            <div style="font-size:28px;font-weight:800;color:#f0c040;letter-spacing:-.03em;font-family:monospace">${fmt(
              overall
            )}</div>
          </td>
          <td style="width:2px;background:#1e1e2e"></td>
          <td style="text-align:center;padding:20px 12px;background:#16161f;border-top:1px solid #1e1e2e;border-bottom:1px solid #1e1e2e;width:33%">
            <div style="font-size:11px;font-family:monospace;color:#8888a8;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">Customers</div>
            <div style="font-size:28px;font-weight:800;color:#38b2ac;letter-spacing:-.03em;font-family:monospace">${activeCustomers}</div>
          </td>
          <td style="width:2px;background:#1e1e2e"></td>
          <td style="text-align:center;padding:20px 12px;background:#16161f;border:1px solid #1e1e2e;border-radius:0 12px 12px 0;width:33%">
            <div style="font-size:11px;font-family:monospace;color:#8888a8;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">Warehouses</div>
            <div style="font-size:28px;font-weight:800;color:#e05c30;letter-spacing:-.03em;font-family:monospace">${
              activeWH.length
            }</div>
          </td>
        </tr>
      </table>

      <!-- CTA -->
      <a href="${dashboardUrl}" style="display:inline-block;background:#f0c040;color:#000;font-weight:700;font-size:14px;padding:14px 32px;border-radius:10px;letter-spacing:-.01em;text-decoration:none">
        Open Dashboard &nbsp;→
      </a>
    </td>
  </tr>

  ${divider()}

  <!-- Warehouse table -->
  <tr>
    <td style="padding:24px 0 0">
      <div style="padding:0 32px 16px">
        <span style="font-size:14px;font-weight:700;color:#e8e8f0">Warehouse Breakdown</span>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <thead>
          <tr style="background:#16161f">
            <th style="padding:8px 20px;text-align:left;font-size:10px;font-family:monospace;color:#8888a8;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #1e1e2e">Warehouse</th>
            <th style="padding:8px 20px;font-size:10px;color:transparent">bar</th>
            <th style="padding:8px 20px;text-align:right;font-size:10px;font-family:monospace;color:#8888a8;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #1e1e2e">Units</th>
            <th style="padding:8px 20px;text-align:right;font-size:10px;font-family:monospace;color:#8888a8;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #1e1e2e">Share</th>
          </tr>
        </thead>
        <tbody>${whRows}</tbody>
        <tfoot>
          <tr style="background:#16161f">
            <td style="padding:10px 20px;font-size:12px;font-family:monospace;color:#8888a8;border-top:2px solid #2a2a3e" colspan="2">GRAND TOTAL</td>
            <td style="padding:10px 20px;text-align:right;font-size:14px;font-weight:800;color:#f0c040;font-family:monospace;border-top:2px solid #2a2a3e">${fmt(
              overall
            )}</td>
            <td style="padding:10px 20px;text-align:right;font-size:11px;color:#8888a8;font-family:monospace;border-top:2px solid #2a2a3e">100%</td>
          </tr>
        </tfoot>
      </table>
    </td>
  </tr>

  ${divider()}

  <!-- Top customers -->
  <tr>
    <td style="padding:24px 0 0">
      <div style="padding:0 32px 16px;display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:14px;font-weight:700;color:#e8e8f0">Top 5 Customers</span>
        <span style="font-size:11px;color:#8888a8;font-family:monospace">by total stock</span>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <thead>
          <tr style="background:#16161f">
            <th style="padding:8px 20px;text-align:left;font-size:10px;font-family:monospace;color:#8888a8;text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid #1e1e2e">#</th>
            <th style="padding:8px 20px;text-align:left;font-size:10px;font-family:monospace;color:#8888a8;text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid #1e1e2e">Customer</th>
            <th style="padding:8px 20px;border-bottom:1px solid #1e1e2e"></th>
            <th style="padding:8px 20px;text-align:right;font-size:10px;font-family:monospace;color:#8888a8;text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid #1e1e2e">Stock</th>
          </tr>
        </thead>
        <tbody>${topCustRows}</tbody>
      </table>
    </td>
  </tr>

  ${divider()}

  <!-- Source email ref -->
  <tr>
    <td style="padding:20px 32px">
      <div style="background:#16161f;border:1px solid #1e1e2e;border-left:3px solid #f0c040;border-radius:8px;padding:14px 16px">
        <div style="font-size:11px;font-family:monospace;color:#8888a8;margin-bottom:4px">SOURCE EMAIL</div>
        <div style="font-size:13px;color:#e8e8f0">${
          emailSubject || "Major Customer Stock Report"
        }</div>
      </div>
    </td>
  </tr>

  ${footerBlock()}
</table>
</div>`;

  return emailWrap(
    `New stock report ingested: ${fmt(
      overall
    )} total units across ${activeCustomers} customers — ${reportDateStr}`,
    card
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// EMAIL 2 — Backfill Complete Summary
// ══════════════════════════════════════════════════════════════════════════════
function buildBackfillEmail(savedCount, totalScanned, reports, dashboardUrl) {
  const latestReport = reports[reports.length - 1];
  const overall = latestReport?.grandTotals?.overall || 0;

  const reportRows = reports
    .slice(-5)
    .reverse()
    .map(
      (r) => `
    <tr>
      <td style="padding:9px 20px;font-size:13px;color:#e8e8f0;font-family:monospace;border-bottom:1px solid #1e1e2e">${
        r.reportDateStr
      }</td>
      <td style="padding:9px 20px;text-align:right;font-size:13px;font-weight:700;color:#f0c040;font-family:monospace;border-bottom:1px solid #1e1e2e">${fmt(
        r.grandTotals?.overall
      )}</td>
      <td style="padding:9px 20px;text-align:right;font-size:12px;color:#8888a8;font-family:monospace;border-bottom:1px solid #1e1e2e">${
        r.rows?.length || 0
      } rows</td>
    </tr>`
    )
    .join("");

  const card = `
<div class="email-card">
<table width="100%" cellpadding="0" cellspacing="0" border="0">
  ${headerBlock()}
  ${divider()}

  <!-- Hero -->
  <tr>
    <td style="padding:40px 32px 32px;text-align:center">
      <div style="background:#34d39910;border:1px solid #34d39930;display:inline-block;border-radius:8px;padding:6px 16px;margin-bottom:20px">
        <span style="font-family:monospace;font-size:11px;color:#34d399;letter-spacing:.08em">BACKFILL COMPLETE</span>
      </div>
      <div style="font-size:36px;font-weight:800;letter-spacing:-.04em;color:#e8e8f0;margin-bottom:8px">
        Database Seeded
      </div>
      <div style="font-size:15px;color:#8888a8;margin-bottom:32px">
        Historical stock data successfully loaded into the monitoring system.
      </div>

      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:32px">
        <tr>
          <td style="text-align:center;padding:20px 12px;background:#16161f;border:1px solid #1e1e2e;border-radius:12px 0 0 12px;width:33%">
            <div style="font-size:11px;font-family:monospace;color:#8888a8;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">Emails Scanned</div>
            <div style="font-size:28px;font-weight:800;color:#38b2ac;letter-spacing:-.03em;font-family:monospace">${totalScanned}</div>
          </td>
          <td style="width:2px;background:#1e1e2e"></td>
          <td style="text-align:center;padding:20px 12px;background:#16161f;border-top:1px solid #1e1e2e;border-bottom:1px solid #1e1e2e;width:33%">
            <div style="font-size:11px;font-family:monospace;color:#8888a8;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">Reports Saved</div>
            <div style="font-size:28px;font-weight:800;color:#34d399;letter-spacing:-.03em;font-family:monospace">${savedCount}</div>
          </td>
          <td style="width:2px;background:#1e1e2e"></td>
          <td style="text-align:center;padding:20px 12px;background:#16161f;border:1px solid #1e1e2e;border-radius:0 12px 12px 0;width:33%">
            <div style="font-size:11px;font-family:monospace;color:#8888a8;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">Latest Stock</div>
            <div style="font-size:22px;font-weight:800;color:#f0c040;letter-spacing:-.03em;font-family:monospace">${fmt(
              overall
            )}</div>
          </td>
        </tr>
      </table>

      <a href="${dashboardUrl}" style="display:inline-block;background:#f0c040;color:#000;font-weight:700;font-size:14px;padding:14px 32px;border-radius:10px;text-decoration:none">
        View Dashboard &nbsp;→
      </a>
    </td>
  </tr>

  ${divider()}

  <!-- Recent reports loaded -->
  <tr>
    <td style="padding:24px 0 0">
      <div style="padding:0 32px 16px">
        <span style="font-size:14px;font-weight:700;color:#e8e8f0">Recent Reports Loaded</span>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <thead><tr style="background:#16161f">
          <th style="padding:8px 20px;text-align:left;font-size:10px;font-family:monospace;color:#8888a8;text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid #1e1e2e">Date</th>
          <th style="padding:8px 20px;text-align:right;font-size:10px;font-family:monospace;color:#8888a8;text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid #1e1e2e">Total Stock</th>
          <th style="padding:8px 20px;text-align:right;font-size:10px;font-family:monospace;color:#8888a8;text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid #1e1e2e">Rows</th>
        </tr></thead>
        <tbody>${reportRows}</tbody>
      </table>
    </td>
  </tr>

  ${footerBlock()}
</table>
</div>`;

  return emailWrap(
    `Backfill complete — ${savedCount} of ${totalScanned} emails loaded into the Stock Intelligence Platform`,
    card
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ══════════════════════════════════════════════════════════════════════════════
async function sendNewReportNotification(
  doc,
  getToken,
  senderEmail,
  dashboardUrl
) {
  try {
    const subject = `📊 New Stock Report Ingested — ${doc.reportDateStr}`;
    const html = buildReportEmail(doc, dashboardUrl);
    await sendViaGraph(getToken, senderEmail, NOTIFY_TO, subject, html);
    console.log(
      `✉️  Notification sent to ${NOTIFY_TO} for report ${doc.reportDateStr}`
    );
  } catch (err) {
    console.error("❌ Failed to send new-report notification:", err.message);
  }
}

async function sendBackfillNotification(
  savedCount,
  totalScanned,
  reports,
  getToken,
  senderEmail,
  dashboardUrl
) {
  try {
    const subject = `✅ Backfill Complete — ${savedCount} reports loaded`;
    const html = buildBackfillEmail(
      savedCount,
      totalScanned,
      reports,
      dashboardUrl
    );
    await sendViaGraph(getToken, senderEmail, NOTIFY_TO, subject, html);
    console.log(`✉️  Backfill summary sent to ${NOTIFY_TO}`);
  } catch (err) {
    console.error("❌ Failed to send backfill notification:", err.message);
  }
}

module.exports = { sendNewReportNotification, sendBackfillNotification };
