// api.js — Express REST API
const express = require("express");
const cors = require("cors");
const { StockReport } = require("./db");

const router = express.Router();

// ── GET /api/reports — list all reports (metadata only) ─────────────────
router.get("/reports", async (req, res) => {
  try {
    const reports = await StockReport.find(
      {},
      { rows: 0 } // exclude rows for listing
    ).sort({ reportDate: -1 });
    res.json({ success: true, data: reports });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/reports/:id — single report with all rows ──────────────────
router.get("/reports/:id", async (req, res) => {
  try {
    const report = await StockReport.findById(req.params.id);
    if (!report) return res.status(404).json({ success: false, error: "Not found" });
    res.json({ success: true, data: report });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/timeseries — customer stock over time ──────────────────────
// Query params: customers (comma-sep), warehouse, from, to
router.get("/timeseries", async (req, res) => {
  try {
    const { customers, warehouse = "grandTotal", from, to } = req.query;

    const match = {};
    if (from || to) {
      match.reportDate = {};
      if (from) match.reportDate.$gte = new Date(from);
      if (to) match.reportDate.$lte = new Date(to);
    }

    const reports = await StockReport.find(match).sort({ reportDate: 1 });

    const customerFilter = customers
      ? customers.split(",").map((c) => c.trim().toLowerCase())
      : null;

    // Build time-series keyed by customer
    const series = {};

    for (const report of reports) {
      for (const row of report.rows) {
        const key = `${row.customerName}__${row.wp}`;
        if (customerFilter && !customerFilter.includes(row.customerName.toLowerCase())) continue;

        if (!series[key]) {
          series[key] = {
            customerName: row.customerName,
            wp: row.wp,
            data: [],
          };
        }
        series[key].data.push({
          date: report.reportDateStr,
          dateISO: report.reportDate,
          value: row[warehouse] ?? row.grandTotal,
        });
      }
    }

    res.json({ success: true, warehouse, data: Object.values(series) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/customers — list unique customers ───────────────────────────
router.get("/customers", async (req, res) => {
  try {
    const result = await StockReport.aggregate([
      { $unwind: "$rows" },
      {
        $group: {
          _id: { name: "$rows.customerName", wp: "$rows.wp" },
          totalStock: { $sum: "$rows.grandTotal" },
          latestDate: { $max: "$reportDate" },
        },
      },
      { $sort: { totalStock: -1 } },
    ]);

    const customers = result.map((r) => ({
      customerName: r._id.name,
      wp: r._id.wp,
      totalStock: r.totalStock,
      latestDate: r.latestDate,
    }));

    res.json({ success: true, data: customers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/warehouse-summary — warehouse totals over time ─────────────
router.get("/warehouse-summary", async (req, res) => {
  try {
    const { from, to } = req.query;
    const match = {};
    if (from || to) {
      match.reportDate = {};
      if (from) match.reportDate.$gte = new Date(from);
      if (to) match.reportDate.$lte = new Date(to);
    }

    const reports = await StockReport.find(match, {
      reportDateStr: 1,
      reportDate: 1,
      grandTotals: 1,
    }).sort({ reportDate: 1 });

    res.json({ success: true, data: reports });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/export/csv?reportId=xxx ────────────────────────────────────
router.get("/export/csv", async (req, res) => {
  try {
    const { reportId } = req.query;
    let reports;

    if (reportId) {
      const r = await StockReport.findById(reportId);
      reports = r ? [r] : [];
    } else {
      reports = await StockReport.find().sort({ reportDate: -1 }).limit(1);
    }

    if (!reports.length) return res.status(404).send("No data");

    const report = reports[0];
    const header = [
      "Sl No", "Customer Name", "WP",
      "Annaram", "Kothur", "Narkhuda",
      "P2", "P4", "P5", "P6", "Prime Pack", "Grand Total",
    ].join(",");

    const lines = report.rows.map((r) =>
      [
        r.slNo, `"${r.customerName}"`, r.wp,
        r.annaramWarehouse, r.kothurWarehouse, r.narkudaWarehouse,
        r.p2Warehouse, r.p4Warehouse, r.p5Warehouse, r.p6Warehouse,
        r.primePackWarehouse, r.grandTotal,
      ].join(",")
    );

    const csv = [header, ...lines].join("\n");
    res.header("Content-Type", "text/csv");
    res.header("Content-Disposition", `attachment; filename="stock_${report.reportDateStr}.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/stats — summary statistics ─────────────────────────────────
router.get("/stats", async (req, res) => {
  try {
    const totalReports = await StockReport.countDocuments();
    const latest = await StockReport.findOne().sort({ reportDate: -1 });
    const oldest = await StockReport.findOne().sort({ reportDate: 1 });

    const customerCount = await StockReport.aggregate([
      { $unwind: "$rows" },
      { $group: { _id: "$rows.customerName" } },
      { $count: "total" },
    ]);

    res.json({
      success: true,
      data: {
        totalReports,
        latestReport: latest?.reportDateStr,
        oldestReport: oldest?.reportDateStr,
        uniqueCustomers: customerCount[0]?.total || 0,
        latestGrandTotal: latest?.grandTotals?.overall || 0,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use("/api", router);
  return app;
}

module.exports = { createApp };
