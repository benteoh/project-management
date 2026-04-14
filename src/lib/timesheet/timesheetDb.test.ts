import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import type { TimesheetEntryDbRow } from "@/types/timesheet";

import { getTimesheetEntries, TIMESHEET_ENTRIES_LOAD_PAGE_SIZE } from "./timesheetDb";

function makeRow(
  partial: Partial<TimesheetEntryDbRow> & Pick<TimesheetEntryDbRow, "row_index" | "id">
): TimesheetEntryDbRow {
  return {
    upload_id: "u1",
    project_id: null,
    engineer_id: null,
    entry_date: null,
    hours: null,
    scope_id: null,
    activity_id: null,
    notes: null,
    raw_data: {},
    ...partial,
  };
}

describe("getTimesheetEntries", () => {
  it("fetches every PostgREST page (merges beyond max_rows chunk)", async () => {
    const sentinel = makeRow({
      id: "sentinel",
      row_index: -1,
      raw_data: { __dsp_column_order__: JSON.stringify(["H"]) },
    });
    const n = TIMESHEET_ENTRIES_LOAD_PAGE_SIZE + 1;
    const dataRows = Array.from({ length: n }, (_, i) =>
      makeRow({ id: `r${i}`, row_index: i, raw_data: { H: `${i}` } })
    );
    const allRows = [sentinel, ...dataRows];

    const range = vi.fn((start: number, end: number) => {
      const slice = allRows.slice(start, end + 1);
      return Promise.resolve({ data: slice, error: null });
    });

    const from = vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({ range })),
        })),
      })),
    }));

    const result = await getTimesheetEntries({ from } as unknown as SupabaseClient, "u1");

    expect("error" in result).toBe(false);
    if ("error" in result) throw new Error("expected ok");
    expect(result.entries).toHaveLength(n);
    expect(result.entries[n - 1]!.rawData.H).toBe(`${n - 1}`);
    expect(range).toHaveBeenCalledTimes(2);
  });
});
