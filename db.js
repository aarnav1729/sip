// db.js — MongoDB connection & Stock schema
const mongoose = require("mongoose");

const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb+srv://aarnavsingh836:Cucumber1729@rr.oldse8x.mongodb.net/visa?retryWrites=true&w=majority";

// ── Schema ──────────────────────────────────────────────────────────────────
const stockRowSchema = new mongoose.Schema(
  {
    slNo: { type: Number, required: true },
    customerName: { type: String, required: true, index: true },
    wp: { type: Number, required: true },
    annaramWarehouse: { type: Number, default: 0 },
    kothurWarehouse: { type: Number, default: 0 },
    narkudaWarehouse: { type: Number, default: 0 },
    p2Warehouse: { type: Number, default: 0 },
    p4Warehouse: { type: Number, default: 0 },
    p5Warehouse: { type: Number, default: 0 },
    p6Warehouse: { type: Number, default: 0 },
    primePackWarehouse: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
  },
  { _id: false }
);

const stockReportSchema = new mongoose.Schema(
  {
    reportDate: { type: Date, required: true },
    reportDateStr: { type: String, required: true }, // "23.02.2026"
    emailMessageId: { type: String, unique: true, sparse: true },
    emailSubject: { type: String },
    emailReceivedAt: { type: Date },
    grandTotals: {
      annaramWarehouse: Number,
      kothurWarehouse: Number,
      narkudaWarehouse: Number,
      p2Warehouse: Number,
      p4Warehouse: Number,
      p5Warehouse: Number,
      p6Warehouse: Number,
      primePackWarehouse: Number,
      overall: Number,
    },
    rows: [stockRowSchema],
    insertedAt: { type: Date, default: Date.now },
  },
  { collection: "stock" }
);

// Compound index for efficient date-range queries
stockReportSchema.index({ reportDateStr: 1 }, { unique: true });

const StockReport = mongoose.model("StockReport", stockReportSchema);

async function connectDB() {
  if (mongoose.connection.readyState === 1) return;
  await mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
  });
  console.log("✅ MongoDB connected →", mongoose.connection.db.databaseName);
}

module.exports = { connectDB, StockReport };