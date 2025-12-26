# Dashboard Analytics Implementation Summary

## Overview

This document describes the complete implementation of the **Business Analytics Dashboard** for the E-commerce Management System. The dashboard provides real-time analytics, KPI tracking, multi-dimension charts, and buyer-specific filtering capabilities.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                         │
│  Dashboard.tsx → Uses URL params as source of truth             │
│    ↓                                                            │
│  API Calls: /stats, /invoices/summary, /dashboard/analytics     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                       BACKEND (NestJS)                          │
│  Controllers: StatsController, DashboardController              │
│  Services: StatsService, DashboardService                       │
│  Database: Prisma ORM → PostgreSQL                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📁 File Structure

### Backend Files

```
backend/src/
├── dashboard/
│   ├── dashboard.module.ts      # Module registration
│   ├── dashboard.controller.ts  # GET /api/dashboard/analytics
│   └── dashboard.service.ts     # Analytics aggregation logic
├── stats/
│   ├── stats.module.ts
│   ├── stats.controller.ts      # GET /api/stats
│   └── stats.service.ts         # Stats + Revenue metrics
└── invoices/
    ├── invoices.controller.ts   # GET /api/invoices/summary
    └── invoices.service.ts      # Invoice summary logic
```

### Frontend Files

```
frontend/src/
└── pages/
    └── Dashboard.tsx            # Main dashboard component (~1280 lines)
```

---

## 🔌 Backend API Endpoints

### 1. GET /api/stats

**Purpose:** Provides core statistics for KPI cards and revenue trend chart.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `period` | string | Yes | week, month, lastMonth, quarter, year |
| `from` | string | No | Custom start date (YYYY-MM-DD) |
| `to` | string | No | Custom end date (YYYY-MM-DD) |
| `buyerId` | number | No | Filter by specific buyer |

**Response:**
```typescript
{
  totals: { suppliers, buyers, products, users },
  invoices: { draft, paidInvoicesCount, pendingCount },
  revenueByMonth: [{ label: string, total: number }],
  totalRevenue: number,
  receivedAmount: number,
  balanceAmount: number,
  paidInvoicesCount: number
}
```

---

### 2. GET /api/dashboard/analytics

**Purpose:** Provides aggregated analytics data for charts and tables.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `period` | string | No | week, month, lastMonth, quarter, year (default: month) |
| `from` | string | No | Custom start date (YYYY-MM-DD) |
| `to` | string | No | Custom end date (YYYY-MM-DD) |
| `buyerId` | number | No | Filter by specific buyer |

**Response:**
```typescript
{
  buyerWiseSales: [{
    id: number,
    name: string,
    total: number,
    count: number,
    percentage: number
  }],
  productWiseSales: [{
    id: number,
    name: string,
    total: number,
    quantity: number,
    percentage: number
  }],
  topBuyersTable: [{
    id: number,
    buyerName: string,
    totalInvoices: number,
    totalSales: number,
    totalReceived: number,
    pendingBalance: number
  }],
  collectionSummary: {
    totalSales: number,
    totalReceived: number,
    pendingAmount: number,
    collectionPercentage: number,
    invoiceCount: number
  },
  period: string,
  dateRange: { from: string, to: string },
  buyerFilter: { id: number, name: string } | null
}
```

---

### 3. GET /api/invoices/summary

**Purpose:** Real-time invoice totals for KPI cards.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `dateFrom` | string | Start date filter |
| `dateTo` | string | End date filter |
| `buyerId` | string | Filter by buyer ID |
| `status` | string | Filter by invoice status |

**Response:**
```typescript
{
  totalSales: number,
  totalReceived: number,
  totalBalance: number,
  count: number
}
```

---

## 🎨 Frontend Dashboard Features

### 1. KPI Cards (4 cards)

| Card | Icon | Value | Color | On Click |
|------|------|-------|-------|----------|
| Total Invoices | FileText | Invoice count | Blue | Navigate to /invoices |
| Total Sales | TrendingUp | Total revenue | Green | Navigate to /invoices |
| Received | Wallet | Received amount | Emerald | Navigate to /invoices?status=paid |
| Pending | IndianRupee | Balance amount | Amber | Navigate to /invoices?status=unpaid |

**Each card shows:**
- Value in INR format
- Period context (e.g., "This Month")
- Percentage indicator (e.g., "99.8% collected")

---

### 2. Revenue Trend Chart

**Type:** AreaChart (Recharts)

**Features:**
- Displays sales over time
- X-axis: Time period (days/weeks/months based on period)
- Y-axis: Revenue in INR
- Tooltip with formatted values
- Responsive container

**Data Source:** `stats.revenueByMonth`

---

### 3. Invoice Status Distribution

**Type:** PieChart (Recharts)

**Segments:**
- Paid (Green)
- Partial (Yellow)
- Unpaid (Blue)
- Draft (Gray)

**Features:**
- Donut chart style (innerRadius: 50)
- Color-coded segments
- Legend with counts
- No text labels (clean look)

---

### 4. Top Buyers Pie Chart

**Type:** PieChart (Recharts)

**Features:**
- Top 5 buyers by sales
- Clickable legend to filter dashboard
- Color-coded segments
- Tooltip with INR values

---

### 5. Top Products Pie Chart

**Type:** PieChart (Recharts)

**Features:**
- Top 5 products by sales
- Color-coded segments
- Legend with percentage and value
- Uses invoice item amounts

---

### 6. Top Buyers Analytics Table

**Columns:**
| # | Buyer Name | Invoices | Total Sales | Pending Balance |
|---|------------|----------|-------------|-----------------|

**Features:**
- Clickable buyer names (filter dashboard)
- Badge style for invoice count
- Color-coded pending balance
- Footer with totals
- "View All" link to buyers page

---

### 7. Entity Distribution Cards

Shows counts for:
- Products
- Suppliers
- Buyers
- Users

---

### 8. Collection Progress

**Features:**
- Progress bar showing collection percentage
- Total Sales, Received, Pending breakdown
- Uses accurate percentage (1 decimal place)

---

### 9. Today's Summary

**Clean white card design showing:**
- Today's invoice count
- Today's revenue
- "View Daybook" button

---

## 🔍 Buyer-Specific Filtering

### How It Works

1. **URL-Driven State:** Dashboard reads `buyerId` from URL query parameter
2. **Click to Filter:** Clicking buyer name in table or chart legend updates URL
3. **All Widgets Update:** Every widget filters to show only that buyer's data
4. **Clear Filter:** Purple banner with "Clear Filter" button appears

### URL Examples

```
/dashboard                      → Global dashboard (all buyers)
/dashboard?buyerId=123          → Filtered to buyer ID 123
/dashboard?buyerId=123&period=year → Buyer 123, year period
```

### Features

- ✅ Refresh keeps filter (URL is source of truth)
- ✅ Shareable URLs
- ✅ Filter indicator banner
- ✅ One-click clear filter
- ✅ Works with period/date filters

---

## 📅 Period Filtering

### Available Periods

| Period | Description | Date Range |
|--------|-------------|------------|
| `week` | Last 7 days | Now - 7 days |
| `month` | Current month | 1st of month - Now |
| `lastMonth` | Previous month | Full previous month |
| `quarter` | Last 3 months | Now - 90 days |
| `year` | Current year | Jan 1 - Now |
| `custom` | User-defined | From date - To date |

### Date Picker

- From/To date pickers
- "Apply" button to update
- Clears individual dates with X button

---

## 🔄 Real-Time Updates

### Auto-Refresh

```typescript
useEffect(() => {
  const interval = setInterval(() => {
    loadInvoiceSummary()
  }, 30000) // Every 30 seconds
  return () => clearInterval(interval)
}, [])
```

### Manual Refresh

- Refresh button in header
- Reloads all data

---

## 🛠️ Backend Service Details

### DashboardService.getAnalytics()

```typescript
async getAnalytics(from?: string, to?: string, period: string = 'month', buyerId?: number) {
  // 1. Calculate date range
  // 2. Build Prisma query with optional buyerId filter
  // 3. Aggregate buyer-wise sales (Top 5)
  // 4. Aggregate product-wise sales (Top 5)
  // 5. Build top buyers table (Top 10)
  // 6. Calculate collection summary
  // 7. Return unified response
}
```

### StatsService.getStats()

```typescript
async getStats(period: string = 'month', from?: string, to?: string, buyerId?: number) {
  // 1. Calculate date range
  // 2. Get entity counts
  // 3. Get revenue metrics (filtered by buyerId if present)
  // 4. Generate graph data points
  // 5. Return stats object
}
```

### StatsService.getRevenueMetrics()

```typescript
private async getRevenueMetrics(period: string, startDate: Date, endDate: Date, buyerId?: number) {
  // 1. Query invoices with optional buyerId filter
  // 2. Calculate totals for ALL invoices (not just paid)
  // 3. Count paid/unpaid/partial invoices
  // 4. Return metrics for graph and KPIs
}
```

---

## 📦 Dependencies

### Frontend
- `react-router-dom` - URL routing and params
- `recharts` - Charts (PieChart, AreaChart, Tooltip, Legend)
- `react-datepicker` - Date range selection
- `lucide-react` - Icons
- `react-hot-toast` - Notifications
- `axios` - API client

### Backend
- `@nestjs/common` - NestJS framework
- `prisma` - ORM for PostgreSQL
- `@nestjs/passport` - JWT authentication

---

## 🎯 Key Design Decisions

### 1. URL as Source of Truth
All filters (period, dates, buyerId) are stored in URL, not component state. This enables:
- Shareable URLs
- Browser back/forward navigation
- Refresh persistence

### 2. Single Analytics Endpoint
Created `/dashboard/analytics` to reduce API calls and ensure data consistency across widgets.

### 3. Unified Revenue Calculation
All revenue metrics use the same logic in `getRevenueMetrics()` to ensure consistency between KPI cards and charts.

### 4. Clean Pie Charts
Removed text labels from pie charts in favor of legends to prevent overlapping and maintain clean design.

### 5. Progressive Enhancement
- Works without buyer filter (global mode)
- Adding buyerId filter enhances but doesn't break functionality

---

## 🔐 Authentication

All dashboard endpoints are protected with JWT authentication:

```typescript
@Controller('dashboard')
@UseGuards(AuthGuard('jwt'))
export class DashboardController { ... }
```

---

## 📈 Performance Considerations

1. **Parallel API Calls:** Dashboard loads stats, summary, and analytics in parallel
2. **Top N Results:** Only top 5 buyers/products returned for charts
3. **Date Filtering:** All queries filter by date to limit data
4. **30-second Auto-refresh:** Only refreshes summary data, not full reload

---

## 🐛 Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Revenue Trend shows 0 | No invoices in period | Check date range, ensure invoices exist |
| Buyer filter not working | Backend not restarted | Restart `npm run start:dev` |
| Pie chart empty | No data for period | Adjust period or check invoice items |
| Percentage shows 0% | Math.round too aggressive | Uses toFixed(1) for accuracy |

---

## 📝 Future Enhancements

1. **Export to PDF/Excel** - Dashboard report generation
2. **Email Reports** - Scheduled dashboard summaries
3. **Comparison Mode** - Compare periods (this month vs last month)
4. **Goal Tracking** - Set and track sales targets
5. **Widget Customization** - User-configurable dashboard layout

---

## 📄 Related Documentation

- `USER_WORKFLOW_DOCUMENTATION.md` - User workflows
- `HOW_TO_RUN_SQL.md` - Database queries
- `BACKEND_LOGIC_SUMMARY.md` - Backend architecture

---

*Last Updated: December 26, 2025*
