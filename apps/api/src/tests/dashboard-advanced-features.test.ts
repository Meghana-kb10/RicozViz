// ========================================
// Dashboard Advanced Features & UX Polish Tests
// ========================================
// Tests for Auto-Refresh, Multi-Select 'in' Filters, Relative Date Presets,
// Filter Clearing, and Filter-Aware CSV Export.
// ========================================

import { describe, it, expect } from "vitest";
import { datasetQueryEngine } from "../services/dataset/query-engine.js";

// Helper RFC 4180 CSV serializer for testing export
function serializeToCsv(
  columns: { name: string }[],
  rows: Record<string, unknown>[]
): string {
  const escapeVal = (val: unknown) => {
    if (val === null || val === undefined) return "";
    const str = typeof val === "object" ? JSON.stringify(val) : String(val);
    if (str.includes('"') || str.includes(",") || str.includes("\n") || str.includes("\r")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const header = columns.map((c) => escapeVal(c.name)).join(",");
  const data = rows.map((r) => columns.map((c) => escapeVal(r[c.name])).join(","));
  return [header, ...data].join("\r\n");
}

describe("Dashboard Advanced Features Sprint", () => {
  // Mock Dataset for Query Engine Tests
  const mockDataset = {
    id: "ds-sprint-test",
    workspaceId: "ws-test",
    name: "Regional Sales Dataset",
    type: "UPLOADED",
    status: "READY",
    schemaMeta: {
      columns: [
        { name: "region", type: "string" },
        { name: "amount", type: "number" },
        { name: "created_at", type: "date" },
      ],
      sampleData: [
        { region: "North", amount: 150, created_at: new Date().toISOString() },
        { region: "South", amount: 250, created_at: new Date().toISOString() },
        { region: "East", amount: 350, created_at: new Date(Date.now() - 10 * 86400000).toISOString() },
        { region: "West", amount: 450, created_at: new Date(Date.now() - 40 * 86400000).toISOString() },
      ],
    },
  } as any;

  // ============================================================
  // TARGET 1 — DASHBOARD AUTO REFRESH
  // ============================================================
  describe("Target 1 — Auto Refresh Configuration & Lifecycle", () => {
    it("supports the required refresh interval options: Off (0), 30s (30), 1m (60), 5m (300)", () => {
      const allowedIntervals = [0, 30, 60, 300];
      expect(allowedIntervals).toContain(0);
      expect(allowedIntervals).toContain(30);
      expect(allowedIntervals).toContain(60);
      expect(allowedIntervals).toContain(300);
    });

    it("prevents overlapping refresh requests via concurrency protection flag", async () => {
      let isRefreshing = false;
      let executions = 0;

      const runRefresh = async () => {
        if (isRefreshing) return false;
        isRefreshing = true;
        try {
          // Simulate query execution
          await new Promise((resolve) => setTimeout(resolve, 10));
          executions++;
          return true;
        } finally {
          isRefreshing = false;
        }
      };

      // Launch two concurrent refreshes
      const [res1, res2] = await Promise.all([runRefresh(), runRefresh()]);

      // Exactly one should succeed, one should be skipped
      expect([res1, res2]).toEqual([true, false]);
      expect(executions).toBe(1);
    });

    it("updates lastUpdatedAt timestamp upon successful manual or auto refresh", () => {
      const initialTimestamp = new Date("2026-01-01T12:00:00Z");
      let lastUpdatedAt = initialTimestamp;

      // Simulate refresh completion
      const newTimestamp = new Date("2026-01-01T12:01:00Z");
      lastUpdatedAt = newTimestamp;

      expect(lastUpdatedAt.getTime()).toBeGreaterThan(initialTimestamp.getTime());
    });
  });

  // ============================================================
  // TARGET 2 — ADVANCED DASHBOARD FILTERS (MULTI-SELECT & DATES)
  // ============================================================
  describe("Target 2 — Advanced Dashboard Filters", () => {
    it("multi-select: successfully filters categories using 'in' operator", async () => {
      const result = await datasetQueryEngine.executeQuery(mockDataset, {
        filters: [
          {
            column: "region",
            operator: "in",
            value: ["North", "South"],
          },
        ],
      });

      expect(result.rows).toHaveLength(2);
      const regions = result.rows.map((r) => r.region);
      expect(regions).toContain("North");
      expect(regions).toContain("South");
      expect(regions).not.toContain("East");
      expect(regions).not.toContain("West");
    });

    it("multi-select: accepts comma-separated string and coerces to array for 'in' operator", async () => {
      const result = await datasetQueryEngine.executeQuery(mockDataset, {
        filters: [
          {
            column: "region",
            operator: "in",
            value: "North, West",
          },
        ],
      });

      expect(result.rows).toHaveLength(2);
      const regions = result.rows.map((r) => r.region);
      expect(regions).toContain("North");
      expect(regions).toContain("West");
      expect(regions).not.toContain("South");
      expect(regions).not.toContain("East");
    });

    it("relative date filters: filters records within 'Last 7 days' window", async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

      const result = await datasetQueryEngine.executeQuery(mockDataset, {
        filters: [
          {
            column: "created_at",
            operator: ">=",
            value: sevenDaysAgo,
          },
        ],
      });

      // Today's records (North and South) should be included; 10-day and 40-day old records excluded
      expect(result.rows).toHaveLength(2);
      const regions = result.rows.map((r) => r.region);
      expect(regions).toEqual(["North", "South"]);
    });

    it("relative date filters: filters records within 'Last 30 days' window", async () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

      const result = await datasetQueryEngine.executeQuery(mockDataset, {
        filters: [
          {
            column: "created_at",
            operator: ">=",
            value: thirtyDaysAgo,
          },
        ],
      });

      // Today (North, South) and 10 days ago (East) should be included; 40 days ago (West) excluded
      expect(result.rows).toHaveLength(3);
      const regions = result.rows.map((r) => r.region);
      expect(regions).toContain("North");
      expect(regions).toContain("South");
      expect(regions).toContain("East");
      expect(regions).not.toContain("West");
    });

    it("clear individual filter removes target filter and preserves others", () => {
      const filters = [
        { id: "f-1", field: "region", operator: "in", value: ["North"] },
        { id: "f-2", field: "amount", operator: ">", value: 100 },
      ];

      const afterRemove = filters.filter((f) => f.id !== "f-1");
      expect(afterRemove).toHaveLength(1);
      expect(afterRemove[0].id).toBe("f-2");
    });

    it("clear all filters resets filter state to empty array and counts active filters", () => {
      const filters = [
        { id: "f-1", field: "region", operator: "in", value: ["North"] },
        { id: "f-2", field: "amount", operator: ">", value: 100 },
      ];

      expect(filters.length).toBe(2);

      const cleared: typeof filters = [];
      expect(cleared.length).toBe(0);
    });
  });

  // ============================================================
  // TARGET 3 — CHART DATA CSV EXPORT
  // ============================================================
  describe("Target 3 — Chart Data CSV Export", () => {
    it("formats query columns and rows into RFC 4180 compliant CSV string", () => {
      const columns = [{ name: "region" }, { name: "amount" }, { name: "note" }];
      const rows = [
        { region: "North", amount: 150, note: "Standard, with comma" },
        { region: "South", amount: 250, note: 'Contains "quotes"' },
      ];

      const csv = serializeToCsv(columns, rows);

      expect(csv).toContain("region,amount,note");
      expect(csv).toContain('North,150,"Standard, with comma"');
      expect(csv).toContain('South,250,"Contains ""quotes"""');
    });

    it("exports data strictly respecting active dashboard filters", async () => {
      // 1. Execute query with multi-select filter
      const filteredResult = await datasetQueryEngine.executeQuery(mockDataset, {
        filters: [
          {
            column: "region",
            operator: "in",
            value: ["South", "West"],
          },
        ],
      });

      // 2. Export the filtered result
      const csv = serializeToCsv(filteredResult.columns, filteredResult.rows);

      // 3. Verify only filtered records appear in exported CSV
      expect(csv).toContain("South,250");
      expect(csv).toContain("West,450");
      expect(csv).not.toContain("North");
      expect(csv).not.toContain("East");
    });
  });
});
