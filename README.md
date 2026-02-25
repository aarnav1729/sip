# sip
sip: stock intelligence platform is a custom built stock report monitoring system that collects, analyses, visualizes, and offers recommendations to enhance company wide warehouse utilization 

**Premier Energies — Enterprise Email-to-DB Pipeline + Dashboard**

## Architecture
```
Email (Graph API) → parser.js → MongoDB (stock collection) → Express API → Dashboard
```

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Backfill past 10 emails
```bash
node index.js --backfill 10
```

### 3. Start the monitor + API server
```bash
npm start
# Server runs on http://localhost:3001
# Email polling every 15 minutes
```

### 4. Open the dashboard
Open `dashboard.html` in your browser directly, **or** serve it via:
```bash
npx serve . -l 3000
# then visit http://localhost:3000/dashboard.html
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/reports` | All reports (metadata) |
| GET | `/api/reports/:id` | Single report with all rows |
| GET | `/api/timeseries?customers=MEIL,KUSUM&warehouse=kothurWarehouse` | Customer time-series |
| GET | `/api/customers` | All unique customers + totals |
| GET | `/api/warehouse-summary` | Warehouse totals over time |
| GET | `/api/stats` | Summary statistics |
| GET | `/api/export/csv?reportId=xxx` | Download CSV |

---

## Dashboard Features
- **Overview tab** — KPIs, warehouse bar/pie charts, top 10 customers
- **Trends tab** — Total stock trend, warehouse trends, per-customer trend
- **Warehouses tab** — Mini sparkline cards per warehouse with top customers
- **Data Table tab** — Full sortable/searchable/filterable grid with CSV export

### Customer Visibility
- Toggle individual customers on/off in the sidebar (affects all charts)
- Show All / Hide All buttons
- Colour-coded consistently across all visualisations

### Export Options
- CSV — Current Report
- CSV — Filtered View (respects search + hidden customers)
- JSON — Current Report
- JSON — All Reports

---

## Email Parsing Rules
- Subject must contain: `Major Customer Stock Report`
- Body must contain the HTML or tab-separated table
- Date is parsed from: `Major Customer Stock as on - DD.MM.YYYY`
- Duplicate emails (same date or same message ID) are silently skipped

---

## MongoDB Schema (`stock` collection)
```json
{
  "reportDate": "ISODate",
  "reportDateStr": "23.02.2026",
  "emailMessageId": "...",
  "emailSubject": "...",
  "emailReceivedAt": "ISODate",
  "grandTotals": { "annaramWarehouse": 71543, ... "overall": 573323 },
  "rows": [
    {
      "slNo": 1,
      "customerName": "AMARARAJA",
      "wp": 550,
      "annaramWarehouse": 0,
      "kothurWarehouse": 0,
      "narkudaWarehouse": 0,
      "p2Warehouse": 73731,
      "p4Warehouse": 0,
      "p5Warehouse": 0,
      "p6Warehouse": 0,
      "primePackWarehouse": 0,
      "grandTotal": 73731
    }
  ]
}
```

---

## Connecting Dashboard to Live API
In `dashboard.html`, change the API_BASE constant:
```js
const API_BASE = "http://localhost:3001/api";
```

Then uncomment the API fetch calls and remove the sample data block at the top.
The dashboard is pre-wired to call all endpoints — just flip the switch.
