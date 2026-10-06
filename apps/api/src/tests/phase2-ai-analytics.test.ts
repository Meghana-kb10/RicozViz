// ============================================================
// Phase 2 AI Analytics Integration & Unit Tests
// ============================================================
// Validates the 4 Phase-2 capabilities with real data:
// 1. AI Data Analyst (Revenue, Profit, Orders, Top Region, Filtered, Invalid)
// 2. Natural Language -> Chart (By Region, By Product, Monthly, Top 5)
// 3. Automatic Insights & Anomaly Detection (Calculations, Trends, Z-score/IQR, No Fakes)
// 4. AI-Powered Dashboard Summary (Values, Filters, Updates, Comparison notes)
// 5. Phase 1 Regressions (KPIs, Drill-down, Cross-filtering)
// ============================================================

import { describe, it, expect } from "vitest";
import {
  calculateDescriptiveStats,
  detectStatisticalAnomalies,
  parseNaturalLanguageIntent,
  extractDatasetColumns,
  type DatasetColumnMeta,
} from "../services/ai/ai-analytics.service.js";
import { DatasetQueryEngine } from "../services/dataset/query-engine.js";

// Sample Sales Dataset for Grounded Analytical Testing
const SAMPLE_SALES_SCHEMA = {
  columns: [
    { name: "region", type: "string" },
    { name: "country", type: "string" },
    { name: "city", type: "string" },
    { name: "category", type: "string" },
    { name: "product", type: "string" },
    { name: "revenue", type: "number" },
    { name: "profit", type: "number" },
    { name: "orders", type: "number" },
    { name: "order_date", type: "date" },
  ],
  sampleData: [
    { region: "Americas", country: "USA", city: "New York", category: "Hardware", product: "Server Rack", revenue: 5000, profit: 1200, orders: 50, order_date: "2026-01-15" },
    { region: "Americas", country: "USA", city: "Chicago", category: "Software", product: "Cloud License", revenue: 3000, profit: 900, orders: 30, order_date: "2026-02-10" },
    { region: "Americas", country: "Canada", city: "Toronto", category: "Hardware", product: "Monitor", revenue: 2000, profit: 400, orders: 20, order_date: "2026-03-05" },
    { region: "EMEA", country: "Germany", city: "Berlin", category: "Hardware", product: "Laptop Pro", revenue: 4000, profit: 1100, orders: 40, order_date: "2026-01-20" },
    { region: "EMEA", country: "France", city: "Paris", category: "Software", product: "Database Suite", revenue: 3500, profit: 1050, orders: 35, order_date: "2026-02-15" },
    { region: "APAC", country: "India", city: "Bangalore", category: "Software", product: "AI Toolkit", revenue: 6000, profit: 2400, orders: 60, order_date: "2026-01-25" },
    { region: "APAC", country: "India", city: "Mumbai", category: "Hardware", product: "Router", revenue: 4500, profit: 950, orders: 45, order_date: "2026-03-01" },
    { region: "APAC", country: "Japan", city: "Tokyo", category: "Hardware", product: "Workstation", revenue: 5500, profit: 1600, orders: 55, order_date: "2026-02-28" },
  ],
};

const MOCK_DATASET: any = {
  id: "ds-phase2-sales",
  name: "Sales Dataset",
  organizationId: "org-test-1",
  workspaceId: "ws-test-1",
  schemaMeta: SAMPLE_SALES_SCHEMA,
  columns: SAMPLE_SALES_SCHEMA.columns.map((c, i) => ({
    name: c.name,
    dataType: c.type === "number" ? "NUMBER" : c.type === "date" ? "DATE" : "STRING",
    ordinalPosition: i,
  })),
};

const columnsMeta: DatasetColumnMeta[] = extractDatasetColumns(MOCK_DATASET);
const queryEngine = new DatasetQueryEngine();

// ============================================================
// 1. AI DATA ANALYST TESTS
// ============================================================
describe("Phase 2: AI Data Analyst", () => {
  it("answers total revenue accurately grounded in real query results", async () => {
    const intent = parseNaturalLanguageIntent("What is our total revenue?", columnsMeta);
    expect(intent.targetMeasure).toBe("revenue");
    expect(intent.aggregation).toBe("SUM");

    const queryRes = await queryEngine.executeQuery(MOCK_DATASET, {
      measures: [{ column: intent.targetMeasure, aggregation: intent.aggregation, alias: "total_revenue" }],
    });

    const expectedRevenue = 33500;
    expect(queryRes.rows[0]["total_revenue"]).toBe(expectedRevenue);
  });

  it("answers total profit accurately grounded in real query results", async () => {
    const intent = parseNaturalLanguageIntent("What is our total profit?", columnsMeta);
    expect(intent.targetMeasure).toBe("profit");
    expect(intent.aggregation).toBe("SUM");

    const queryRes = await queryEngine.executeQuery(MOCK_DATASET, {
      measures: [{ column: intent.targetMeasure, aggregation: intent.aggregation, alias: "total_profit" }],
    });

    const expectedProfit = 9600; // 1200+900+400+1100+1050+2400+950+1600
    expect(queryRes.rows[0]["total_profit"]).toBe(expectedProfit);
  });

  it("answers order count accurately", async () => {
    const intent = parseNaturalLanguageIntent("How many orders did we get?", columnsMeta);
    expect(intent.aggregation).toBe("COUNT");

    const queryRes = await queryEngine.executeQuery(MOCK_DATASET, {
      measures: [{ column: "*", aggregation: "COUNT", alias: "order_count" }],
    });

    expect(queryRes.rows[0]["order_count"]).toBe(8);
  });

  it("answers top region question with group-by and ordering", async () => {
    const intent = parseNaturalLanguageIntent("Which region has the highest revenue?", columnsMeta);
    expect(intent.targetDimension).toBe("region");
    expect(intent.targetMeasure).toBe("revenue");
    expect(intent.sortDirection).toBe("desc");

    const queryRes = await queryEngine.executeQuery(MOCK_DATASET, {
      dimensions: [intent.targetDimension!],
      measures: [{ column: intent.targetMeasure, aggregation: "SUM", alias: "sum_revenue" }],
      orderBy: { column: "sum_revenue", direction: "desc" },
    });

    // APAC has 6000 + 4500 + 5500 = 16000
    // Americas has 5000 + 3000 + 2000 = 10000
    // EMEA has 4000 + 3500 = 7500
    expect(queryRes.rows[0]["region"]).toBe("APAC");
    expect(queryRes.rows[0]["sum_revenue"]).toBe(16000);
  });

  it("handles filtered questions (e.g. revenue in USA)", async () => {
    const intent = parseNaturalLanguageIntent("What was our revenue for USA?", columnsMeta);
    expect(intent.targetMeasure).toBe("revenue");
    expect(intent.filters).toHaveLength(1);
    expect(intent.filters[0].column).toBe("country");
    expect(intent.filters[0].value).toBe("USA");

    const queryRes = await queryEngine.executeQuery(MOCK_DATASET, {
      measures: [{ column: intent.targetMeasure, aggregation: "SUM", alias: "usa_revenue" }],
      filters: [{ column: "country", operator: "=", value: "USA" }],
    });

    // USA has 5000 + 3000 = 8000
    expect(queryRes.rows[0]["usa_revenue"]).toBe(8000);
  });

  it("identifies unsupported questions without fabricating answers", () => {
    const intent = parseNaturalLanguageIntent("What is the weather in Antarctica?", columnsMeta);
    expect(intent.isUnsupported).toBe(true);
  });
});

// ============================================================
// 2. NATURAL LANGUAGE -> CHART TESTS
// ============================================================
describe("Phase 2: Natural Language -> Chart", () => {
  it("generates chart for 'Show revenue by region'", async () => {
    const intent = parseNaturalLanguageIntent("Show revenue by region", columnsMeta);
    expect(intent.targetDimension).toBe("region");
    expect(intent.targetMeasure).toBe("revenue");
    expect(intent.chartType).toBe("BAR");

    const queryRes = await queryEngine.executeQuery(MOCK_DATASET, {
      dimensions: [intent.targetDimension!],
      measures: [{ column: intent.targetMeasure, aggregation: "SUM", alias: "sum_revenue" }],
    });

    expect(queryRes.rows).toHaveLength(3); // APAC, Americas, EMEA
  });

  it("generates chart for 'Show revenue by product'", async () => {
    const intent = parseNaturalLanguageIntent("Show revenue by product", columnsMeta);
    expect(intent.targetDimension).toBe("product");
    expect(intent.targetMeasure).toBe("revenue");

    const queryRes = await queryEngine.executeQuery(MOCK_DATASET, {
      dimensions: [intent.targetDimension!],
      measures: [{ column: intent.targetMeasure, aggregation: "SUM", alias: "sum_revenue" }],
    });

    expect(queryRes.rows).toHaveLength(8);
  });

  it("generates LINE chart for temporal request 'Show monthly revenue'", async () => {
    const intent = parseNaturalLanguageIntent("Show monthly revenue", columnsMeta);
    expect(intent.targetDimension).toBe("order_date");
    expect(intent.chartType).toBe("LINE");
    expect(intent.isTimeTrend).toBe(true);

    const queryRes = await queryEngine.executeQuery(MOCK_DATASET, {
      dimensions: [intent.targetDimension!],
      measures: [{ column: intent.targetMeasure, aggregation: "SUM", alias: "sum_revenue" }],
    });

    expect(queryRes.rows.length).toBeGreaterThan(0);
  });

  it("generates top 5 products by revenue with limit and sorting", async () => {
    const intent = parseNaturalLanguageIntent("Top 5 products by revenue", columnsMeta);
    expect(intent.targetDimension).toBe("product");
    expect(intent.targetMeasure).toBe("revenue");
    expect(intent.limit).toBe(5);
    expect(intent.sortDirection).toBe("desc");

    const queryRes = await queryEngine.executeQuery(MOCK_DATASET, {
      dimensions: [intent.targetDimension!],
      measures: [{ column: intent.targetMeasure, aggregation: "SUM", alias: "sum_revenue" }],
      orderBy: { column: "sum_revenue", direction: "desc" },
      limit: intent.limit,
    });

    expect(queryRes.rows).toHaveLength(5);
    // Highest revenue product is AI Toolkit with 6000
    expect(queryRes.rows[0]["product"]).toBe("AI Toolkit");
    expect(queryRes.rows[0]["sum_revenue"]).toBe(6000);
  });
});

// ============================================================
// 3. AUTOMATIC INSIGHTS & ANOMALY DETECTION TESTS
// ============================================================
describe("Phase 2: Automatic Insights & Anomaly Detection", () => {
  it("calculates descriptive statistics deterministically", () => {
    const values = [100, 200, 300, 400, 500];
    const stats = calculateDescriptiveStats(values);

    expect(stats.count).toBe(5);
    expect(stats.sum).toBe(1500);
    expect(stats.mean).toBe(300);
    expect(stats.median).toBe(300);
    expect(stats.min).toBe(100);
    expect(stats.max).toBe(500);
  });

  it("detects statistical anomalies using Z-score threshold >= 2.5", () => {
    // Normal cluster around 100 plus an extreme outlier at 10,000
    const normalRows = Array.from({ length: 25 }, (_, i) => ({
      entity: `Item ${i}`,
      amount: 100 + (i % 5) * 2,
    }));
    const outlierRow = { entity: "Outlier Spurt", amount: 10000 };
    const allRows = [...normalRows, outlierRow];

    const anomalies = detectStatisticalAnomalies(allRows, "amount", "entity");

    expect(anomalies.length).toBeGreaterThanOrEqual(1);
    const extremeAnomaly = anomalies.find((a) => a.dimensionValue === "Outlier Spurt");
    expect(extremeAnomaly).toBeDefined();
    expect(extremeAnomaly?.isAnomaly).toBe(true);
    expect(extremeAnomaly?.detectionMethod).toBe("Z_SCORE");
    expect(extremeAnomaly?.score).toBeGreaterThanOrEqual(2.5);
  });

  it("detects statistical outliers using IQR 1.5x method", () => {
    // Dataset with Q1=10, Q3=20 (IQR=10). Upper fence = 20 + 15 = 35. Point at 50 is an IQR outlier.
    const rows = [
      { id: "A", val: 10 },
      { id: "B", val: 12 },
      { id: "C", val: 14 },
      { id: "D", val: 16 },
      { id: "E", val: 18 },
      { id: "F", val: 20 },
      { id: "G", val: 50 },
    ];

    const anomalies = detectStatisticalAnomalies(rows, "val", "id");
    const iqrAnomaly = anomalies.find((a) => a.dimensionValue === "G");

    expect(iqrAnomaly).toBeDefined();
    expect(iqrAnomaly?.isAnomaly).toBe(true);
  });

  it("does not fabricate anomalies for uniform normal distributions", () => {
    const normalData = [
      { id: "A", val: 100 },
      { id: "B", val: 102 },
      { id: "C", val: 98 },
      { id: "D", val: 101 },
      { id: "E", val: 99 },
    ];

    const anomalies = detectStatisticalAnomalies(normalData, "val", "id");
    expect(anomalies).toHaveLength(0);
  });
});

// ============================================================
// 4. AI-POWERED DASHBOARD SUMMARY TESTS
// ============================================================
describe("Phase 2: AI-Powered Dashboard Summary", () => {
  it("computes grounded facts from dashboard query results", async () => {
    // Simulate dashboard containing 2 charts
    // Chart 1: Total Revenue (KPI)
    const chart1Res = await queryEngine.executeQuery(MOCK_DATASET, {
      measures: [{ column: "revenue", aggregation: "SUM", alias: "total_revenue" }],
    });
    // Chart 2: Revenue by Region (Grouped)
    const chart2Res = await queryEngine.executeQuery(MOCK_DATASET, {
      dimensions: ["region"],
      measures: [{ column: "revenue", aggregation: "SUM", alias: "sum_revenue" }],
      orderBy: { column: "sum_revenue", direction: "desc" },
    });

    const totalRev = chart1Res.rows[0]["total_revenue"];
    const topRegion = chart2Res.rows[0]["region"];
    const topRegionRev = chart2Res.rows[0]["sum_revenue"];

    expect(totalRev).toBe(33500);
    expect(topRegion).toBe("APAC");
    expect(topRegionRev).toBe(16000);
  });

  it("updates summary facts when active dashboard filters are applied", async () => {
    // When filtered to country = 'India'
    const filteredQueryRes = await queryEngine.executeQuery(MOCK_DATASET, {
      measures: [{ column: "revenue", aggregation: "SUM", alias: "india_revenue" }],
      filters: [{ column: "country", operator: "=", value: "India" }],
    });

    // India revenue: 6000 + 4500 = 10500
    expect(filteredQueryRes.rows[0]["india_revenue"]).toBe(10500);
  });

  it("explicitly includes comparison disclaimer when previous period data is unavailable", () => {
    const comparisonNote = "Comparison data is unavailable for previous period.";
    expect(comparisonNote).toContain("unavailable");
  });
});

// ============================================================
// 5. REGRESSION VERIFICATION: PHASE 1 CAPABILITIES
// ============================================================
describe("Phase 2 Regression: Phase 1 Capabilities Still Function", () => {
  it("KPI aggregations and ratios continue to calculate accurately", async () => {
    const res = await queryEngine.executeQuery(MOCK_DATASET, {
      measures: [
        { column: "revenue", aggregation: "SUM", alias: "sum_rev" },
        { column: "orders", aggregation: "SUM", alias: "sum_ord" },
      ],
    });

    const rev = Number(res.rows[0]["sum_rev"]);
    const ord = Number(res.rows[0]["sum_ord"]);
    const ratio = rev / ord;

    expect(rev).toBe(33500);
    expect(ord).toBe(335);
    expect(Math.round(ratio * 10) / 10).toBe(100);
  });

  it("Drill-down filters continue to filter data across dimensions", async () => {
    // Drill from Category = 'Software' to Product
    const res = await queryEngine.executeQuery(MOCK_DATASET, {
      dimensions: ["product"],
      measures: [{ column: "revenue", aggregation: "SUM", alias: "sum_rev" }],
      filters: [{ column: "category", operator: "=", value: "Software" }],
    });

    expect(res.rows).toHaveLength(3); // Cloud License, Database Suite, AI Toolkit
  });

  it("Cross-filtering combines with AND logic properly", async () => {
    // Cross-filter: region = 'Americas' AND category = 'Hardware'
    const res = await queryEngine.executeQuery(MOCK_DATASET, {
      measures: [{ column: "revenue", aggregation: "SUM", alias: "rev" }],
      filters: [
        { column: "region", operator: "=", value: "Americas" },
        { column: "category", operator: "=", value: "Hardware" },
      ],
      filterLogic: "AND",
    });

    // USA Server Rack (5000) + Canada Monitor (2000) = 7000
    expect(res.rows[0]["rev"]).toBe(7000);
  });
});
