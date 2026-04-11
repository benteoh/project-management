import { describe, expect, it } from "vitest";

import { stripExcludedColumns } from "./timesheetSheetNormalize";
import type { SheetData } from "./types";

describe("stripExcludedColumns", () => {
  it("keeps Proj. # and Activity (required for import)", () => {
    const sheet: SheetData = {
      fileName: "t.xlsx",
      headers: ["Date", "Hours", "Employee", "Proj. #", "Activity", "Task ID", "Notes"],
      rows: [["1", "2", "3", "489 - X", "D9", "LUL", "n"]],
    };
    const out = stripExcludedColumns(sheet);
    expect(out.headers).toContain("Proj. #");
    expect(out.headers).toContain("Activity");
    expect(out.headers.indexOf("Proj. #")).toBeGreaterThan(-1);
  });

  it("still drops synthetic No. / Alert columns when present", () => {
    const sheet: SheetData = {
      fileName: "t.xlsx",
      headers: ["No.", "Alert", "Date", "Proj. #"],
      rows: [["1", "", "d", "p"]],
    };
    const out = stripExcludedColumns(sheet);
    expect(out.headers).toEqual(["Date", "Proj. #"]);
  });
});
