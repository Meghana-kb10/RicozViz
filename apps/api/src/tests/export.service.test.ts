import { afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../lib/prisma.js";
import { datasetQueryEngine } from "../services/dataset/query-engine.js";
import { exportResource } from "../services/export/export.service.js";

const organizationId = "org-export-test";
const datasetId = "dataset-export-test";

const dataset = {
  id: datasetId,
  name: "Quarterly Sales",
  organizationId,
  workspaceId: null,
  columns: [{ name: "region" }, { name: "revenue" }],
};

const queryResult = {
  rows: [
    { region: "North", revenue: 1200 },
    { region: "South", revenue: 800 },
  ],
  columns: [
    { name: "region", dataType: "STRING" },
    { name: "revenue", dataType: "NUMBER" },
  ],
  rowCount: 2,
  total: 2,
  limit: 1000,
  offset: 0,
  executionTimeMs: 1,
  metadata: {},
};

describe("Advanced Export Center service", () => {
  afterEach(() => vi.restoreAllMocks());

  function mockDatasetQuery() {
    vi.spyOn(prisma.dataset, "findFirst").mockResolvedValue(dataset as never);
    vi.spyOn(prisma.auditLog, "create").mockResolvedValue({} as never);
    vi.spyOn(datasetQueryEngine, "executeQuery")
      .mockResolvedValueOnce(queryResult as never)
      .mockResolvedValueOnce({ ...queryResult, rows: [] } as never);
  }

  it("exports RFC 4180 CSV in bounded batches and honors header options", async () => {
    mockDatasetQuery();

    const result = await exportResource({
      resourceType: "DATASET",
      resourceId: datasetId,
      format: "CSV",
      options: { rowLimit: 2, includeHeaders: false },
      userId: "user-export-test",
      organizationId,
    });

    expect(result.contentType).toContain("text/csv");
    expect(result.textContent).toBe("North,1200\r\nSouth,800");
    expect(result.rowCount).toBe(2);
  });

  it("returns a real XLSX workbook", async () => {
    mockDatasetQuery();

    const result = await exportResource({
      resourceType: "DATASET",
      resourceId: datasetId,
      format: "EXCEL",
      userId: "user-export-test",
      organizationId,
    });

    const bytes = Buffer.from(result.dataBase64 || "", "base64");
    expect(result.contentType).toContain("spreadsheetml");
    expect(bytes.subarray(0, 2).toString("ascii")).toBe("PK");
  });

  it("returns valid PDF and PNG file signatures instead of descriptors", async () => {
    for (const format of ["PDF", "PNG"] as const) {
      mockDatasetQuery();
      const result = await exportResource({
        resourceType: "DATASET",
        resourceId: datasetId,
        format,
        userId: "user-export-test",
        organizationId,
      });
      const bytes = Buffer.from(result.dataBase64 || "", "base64");
      expect(format === "PDF" ? bytes.subarray(0, 5).toString("ascii") : bytes.subarray(0, 8).toString("hex"))
        .toBe(format === "PDF" ? "%PDF-" : "89504e470d0a1a0a");
    }
  });
});
