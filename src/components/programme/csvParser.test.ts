// src/components/programme/csvParser.test.ts
import { describe, it, expect } from "vitest";
import { parseCsv } from "./csvParser";

const HDR = "Activity ID\tActivity Name\tStart\tFinish\tActivity Status";

describe("parseCsv - header validation", () => {
  it("throws when a required column is missing", () => {
    expect(() =>
      parseCsv("Wrong Header\tActivity Name\tStart\tFinish\tActivity Status\nA1000\tFoo\t\t\t")
    ).toThrow("Missing required columns: Activity ID");
  });

  it("throws on empty file", () => {
    expect(() => parseCsv("   ")).toThrow("File is empty");
  });

  it("accepts comma-separated headers with extra Primavera columns", () => {
    const header =
      "Activity ID,Activity Name,Original Duration,Start,Finish,BL1 Duration,BL1 Start,BL1 Finish,Activity Status,Activity % Complete";
    const csv = `${header}\nA1000,Collect info,10,12/05/2025 9:00,26/05/2025 09:00,10,12/05/2025 9:00,26/05/2025 09:00,Completed,100%`;
    const row = parseCsv(csv)[0];
    expect(row.activityId).toBe("A1000");
    expect(row.name).toBe("Collect info");
    expect(row.status).toBe("Completed");
  });

  it("parses quoted activity names that contain commas", () => {
    const header = "Activity ID,Activity Name,Original Duration,Start,Finish,Activity Status";
    const csv = `${header}\n,"1.1 Report (Buildings, Utilities, NR)",,25/06/2025 09:00,01-Sep-25 16:00 A,`;
    const row = parseCsv(csv)[0];
    expect(row.rowType).toBe("task");
    expect(row.name).toContain("Buildings, Utilities");
  });
});

describe("parseCsv - row type detection", () => {
  it("skips project header row (no Activity ID, no number prefix)", () => {
    const csv = `${HDR}\n\tDSP HS2 Euston Design\t\t\t`;
    expect(parseCsv(csv)[0].rowType).toBe("skip");
  });

  it("skips EPS / programme title in Activity ID (long text with spaces)", () => {
    const csv = `${HDR}\nDSP HS2 Euston Design - CL32 Programme\t\t\t\t`;
    expect(parseCsv(csv)[0].rowType).toBe("skip");
  });

  it("treats unnumbered P6 summary with acronym + parentheses as scope", () => {
    const csv = `${HDR}\nAIP (Agreement in Principle)\t\t12/05/2025 9:00\t01-Sep-25 16:00 A\t`;
    const row = parseCsv(csv)[0];
    expect(row.rowType).toBe("scope");
    expect(row.name).toBe("AIP (Agreement in Principle)");
  });

  it("identifies scope row by '1. ' pattern", () => {
    const csv = `${HDR}\n\t1. GMA Scoping\t12/05/2025 9:00\t01-Sep-25 16:00 A\t`;
    expect(parseCsv(csv)[0].rowType).toBe("scope");
  });

  it("identifies scope when Primavera puts the WBS label in Activity ID (Activity Name empty)", () => {
    const csv = `${HDR}\n1. GMA Scoping / Assumptions\t\t12/05/2025 9:00\t01-Sep-25 16:00 A\t`;
    const row = parseCsv(csv)[0];
    expect(row.rowType).toBe("scope");
    expect(row.name).toBe("1. GMA Scoping / Assumptions");
  });

  it("identifies task row by '1.1 ' pattern", () => {
    const csv = `${HDR}\n\t1.1 Phase 2 report\t25/06/2025 09:00\t01-Sep-25 16:00 A\t`;
    expect(parseCsv(csv)[0].rowType).toBe("task");
  });

  it("identifies task when the label is only in Activity ID (P6 export)", () => {
    const csv = `${HDR}\n1.1 Phase 2 report for CGMM (Buildings)\t\t25/06/2025 09:00\t01-Sep-25 16:00 A\t`;
    const row = parseCsv(csv)[0];
    expect(row.rowType).toBe("task");
    expect(row.name).toContain("Phase 2 report");
  });

  it("identifies subtask row by '1.1.1 ' pattern", () => {
    const csv = `${HDR}\n\t1.1.1 Sub-item\t25/06/2025 09:00\t01-Sep-25 16:00 A\t`;
    expect(parseCsv(csv)[0].rowType).toBe("subtask");
  });

  it("identifies activity row when Activity ID is present", () => {
    const csv = `${HDR}\nA1000\tCollect info\t12/05/2025 9:00\t26/05/2025 09:00\tCompleted`;
    const row = parseCsv(csv)[0];
    expect(row.rowType).toBe("activity");
    expect(row.activityId).toBe("A1000");
    expect(row.status).toBe("Completed");
  });
});

describe("parseCsv - date normalisation", () => {
  it("normalises DD/MM/YYYY HH:mm to dd-Mon-yy", () => {
    const csv = `${HDR}\nA1000\tFoo\t12/05/2025 9:00\t26/05/2025 09:00\t`;
    const row = parseCsv(csv)[0];
    expect(row.start).toBe("12-May-25");
    expect(row.finish).toBe("26-May-25");
  });

  it("normalises DD-Mon-YY HH:mm A to dd-Mon-yy", () => {
    const csv = `${HDR}\nA1000\tFoo\t01-Sep-25 16:00 A\t23-May-25 16:00 A\t`;
    const row = parseCsv(csv)[0];
    expect(row.start).toBe("01-Sep-25");
    expect(row.finish).toBe("23-May-25");
  });

  it("returns undefined and stores startRaw for unparseable date", () => {
    const csv = `${HDR}\nA1000\tFoo\tnot-a-date\t26/05/2025 09:00\t`;
    const row = parseCsv(csv)[0];
    expect(row.start).toBeUndefined();
    expect(row.startRaw).toBe("not-a-date");
  });

  it("omits start/finish and startRaw/finishRaw when date cells are empty", () => {
    const csv = `${HDR}\nA1000\tFoo\t\t\t`;
    const row = parseCsv(csv)[0];
    expect(row.start).toBeUndefined();
    expect(row.startRaw).toBeUndefined();
    expect(row.finish).toBeUndefined();
    expect(row.finishRaw).toBeUndefined();
  });
});
