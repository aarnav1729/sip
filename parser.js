// parser.js — Parse stock table from email body (plain text or HTML)
const cheerio = require("cheerio");

const WAREHOUSES = [
  "annaramWarehouse",
  "kothurWarehouse",
  "narkudaWarehouse",
  "p2Warehouse",
  "p4Warehouse",
  "p5Warehouse",
  "p6Warehouse",
  "primePackWarehouse",
];

/**
 * Parse date string like "23.02.2026" → Date object
 */
function parseReportDate(dateStr) {
  const [d, m, y] = dateStr.trim().split(".");
  return new Date(`${y}-${m}-${d}T00:00:00.000Z`);
}

/**
 * Extract "Major Customer Stock as on - DD.MM.YYYY" date from text
 */
function extractDateFromText(text) {
  const match = text.match(
    /Major\s+Customer\s+Stock(?:\s+Report)?\s+as\s+on\s*[-–]\s*(\d{2}\.\d{2}\.\d{4})/i
  );
  return match ? match[1] : null;
}

/**
 * Normalise a cell value to a number (strips commas, spaces)
 */
function toNum(val) {
  if (!val || val.trim() === "" || val.trim() === "-") return 0;
  return parseInt(val.replace(/[,\s]/g, ""), 10) || 0;
}

/**
 * Parse plain-text tab/newline table (as pasted in the prompt)
 */
function parsePlainText(text) {
  // Find the header line "Sl No\tCustomer Name\tWp\t..."
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const dateStr = extractDateFromText(text);
  if (!dateStr) return null;

  // Find header row index
  const headerIdx = lines.findIndex((l) => /^Sl\s*No/i.test(l));
  if (headerIdx === -1) return null;

  const rows = [];
  let grandTotals = null;

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^Grand\s*Total/i.test(line)) {
      // Parse grand total row
      const parts = line.split(/\t+/).filter((_, idx) => idx > 0);
      if (parts.length >= 9) {
        grandTotals = {
          annaramWarehouse: toNum(parts[0]),
          kothurWarehouse: toNum(parts[1]),
          narkudaWarehouse: toNum(parts[2]),
          p2Warehouse: toNum(parts[3]),
          p4Warehouse: toNum(parts[4]),
          p5Warehouse: toNum(parts[5]),
          p6Warehouse: toNum(parts[6]),
          primePackWarehouse: toNum(parts[7]),
          overall: toNum(parts[8]),
        };
      }
      continue;
    }

    const parts = line.split(/\t+/);
    // Expect: slNo, customerName, wp, 8 warehouses, grandTotal = 12 columns
    if (parts.length < 12) continue;
    const slNo = parseInt(parts[0], 10);
    if (isNaN(slNo)) continue;

    rows.push({
      slNo,
      customerName: parts[1].trim(),
      wp: toNum(parts[2]),
      annaramWarehouse: toNum(parts[3]),
      kothurWarehouse: toNum(parts[4]),
      narkudaWarehouse: toNum(parts[5]),
      p2Warehouse: toNum(parts[6]),
      p4Warehouse: toNum(parts[7]),
      p5Warehouse: toNum(parts[8]),
      p6Warehouse: toNum(parts[9]),
      primePackWarehouse: toNum(parts[10]),
      grandTotal: toNum(parts[11]),
    });
  }

  return rows.length > 0 ? { dateStr, rows, grandTotals } : null;
}

/**
 * Parse HTML email body containing a <table>
 */
function parseHTML(html) {
  const $ = cheerio.load(html);

  // Find the date
  const fullText = $.text();
  const dateStr = extractDateFromText(fullText);

  // Find the main table (the one with "Sl No" header)
  let targetTable = null;
  $("table").each((_, table) => {
    const text = $(table).text();
    if (/Sl\s*No/i.test(text) && /Customer\s*Name/i.test(text)) {
      targetTable = table;
      return false; // break
    }
  });

  if (!targetTable) return null;

  const rows = [];
  let grandTotals = null;
  let headerFound = false;

  $(targetTable)
    .find("tr")
    .each((_, tr) => {
      const cells = $(tr)
        .find("td, th")
        .map((_, td) => $(td).text().trim())
        .get();

      if (!headerFound) {
        if (/Sl\s*No/i.test(cells[0] || "")) {
          headerFound = true;
        }
        return;
      }

      if (
        /^Grand\s*Total/i.test(cells[0] || "") ||
        /^Grand\s*Total/i.test(cells[1] || "")
      ) {
        const offset = /^Grand\s*Total/i.test(cells[0]) ? 1 : 2;
        grandTotals = {
          annaramWarehouse: toNum(cells[offset] || "0"),
          kothurWarehouse: toNum(cells[offset + 1] || "0"),
          narkudaWarehouse: toNum(cells[offset + 2] || "0"),
          p2Warehouse: toNum(cells[offset + 3] || "0"),
          p4Warehouse: toNum(cells[offset + 4] || "0"),
          p5Warehouse: toNum(cells[offset + 5] || "0"),
          p6Warehouse: toNum(cells[offset + 6] || "0"),
          primePackWarehouse: toNum(cells[offset + 7] || "0"),
          overall: toNum(cells[offset + 8] || "0"),
        };
        return;
      }

      const slNo = parseInt(cells[0], 10);
      if (isNaN(slNo) || cells.length < 11) return;

      rows.push({
        slNo,
        customerName: cells[1],
        wp: toNum(cells[2]),
        annaramWarehouse: toNum(cells[3]),
        kothurWarehouse: toNum(cells[4]),
        narkudaWarehouse: toNum(cells[5]),
        p2Warehouse: toNum(cells[6]),
        p4Warehouse: toNum(cells[7]),
        p5Warehouse: toNum(cells[8]),
        p6Warehouse: toNum(cells[9]),
        primePackWarehouse: toNum(cells[10]),
        grandTotal: toNum(cells[11] || "0"),
      });
    });

  return rows.length > 0 ? { dateStr, rows, grandTotals } : null;
}

/**
 * Master parse function — tries HTML first, then plain text
 */
function parseEmailBody(body, contentType = "html") {
  let result = null;

  if (contentType === "html" || body.includes("<table")) {
    result = parseHTML(body);
  }

  if (!result) {
    result = parsePlainText(body);
  }

  return result;
}

module.exports = { parseEmailBody, parseReportDate, WAREHOUSES };
