import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { CellValues } from "@/components/forecast/forecastGridTypes";

import { FORECAST_ENTRIES_PAGE_SIZE, loadForecastEntries, saveForecastEntries } from "./forecastDb";

const E = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

function cellValuesWithConsecutiveDates(rowKey: string, dayCount: number): CellValues {
  const fields: Record<string, number> = {};
  const d = new Date(Date.UTC(2026, 0, 1));
  for (let i = 0; i < dayCount; i++) {
    const iso = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    fields[iso] = 1;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return { [rowKey]: fields };
}

/**
 * Minimal fluent mock: `select().eq().order().order().range()` for paged reads;
 * `upsert()`, `delete().in()` for writes.
 */
function createForecastEntriesClient(handlers: {
  load?: { data: unknown[]; error: { message: string } | null };
  upsert?: { error: { message: string } | null };
  existing?: { data: unknown[]; error: { message: string } | null };
  deleteIn?: { error: { message: string } | null };
}) {
  const upsert = vi
    .fn()
    .mockImplementation(() => Promise.resolve(handlers.upsert ?? { error: null }));
  const deleteIn = vi
    .fn()
    .mockImplementation(() => Promise.resolve(handlers.deleteIn ?? { error: null }));

  /** Set by the latest `select()` — used to assert `.eq("project_id", …)`. */
  let lastEq: ReturnType<typeof vi.fn> | null = null;

  const from = vi.fn(() => ({
    select: vi.fn((columns: string) => {
      const isIdFirst = /^\s*id\s*,/i.test(columns);
      const payload = isIdFirst
        ? (handlers.existing ?? { data: [], error: null })
        : (handlers.load ?? { data: [], error: null });
      const eq = vi.fn(() => ({
        order: vi.fn(() => ({
          order: vi.fn(() => ({
            range: vi.fn(() => Promise.resolve(payload)),
          })),
        })),
      }));
      lastEq = eq;
      return { eq };
    }),
    upsert,
    delete: vi.fn(() => ({ in: deleteIn })),
  }));
  return {
    client: { from } as unknown as SupabaseClient,
    get lastEq() {
      return lastEq;
    },
    upsert,
    deleteIn,
  };
}

describe("loadForecastEntries", () => {
  it("maps rows to CellValues keyed by scopeId-engineerId and ISO date", async () => {
    const ctx = createForecastEntriesClient({
      load: {
        data: [
          { scope_id: "s1", engineer_id: E, date: "2026-01-05", hours: "4.2" },
          { scope_id: "s1", engineer_id: E, date: "2026-01-06", hours: 3 },
        ],
        error: null,
      },
    });
    const result = await loadForecastEntries(ctx.client, "p1");
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.values[`s1-${E}`]).toEqual({
      "2026-01-05": 4,
      "2026-01-06": 3,
    });
    expect(ctx.lastEq).toHaveBeenCalledWith("project_id", "p1");
  });

  it("drops non-positive hours from the map", async () => {
    const { client } = createForecastEntriesClient({
      load: {
        data: [{ scope_id: "s1", engineer_id: E, date: "2026-01-05", hours: 0 }],
        error: null,
      },
    });
    const result = await loadForecastEntries(client, "p1");
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.values[`s1-${E}`] ?? {}).toEqual({});
  });

  it("returns error when Supabase returns an error", async () => {
    const { client } = createForecastEntriesClient({
      load: { data: [], error: { message: "permission denied" } },
    });
    const result = await loadForecastEntries(client, "p1");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected err");
    expect(result.error).toBe("permission denied");
  });

  it("fetches every PostgREST page (merges beyond max_rows chunk)", async () => {
    function addUtcDays(iso: string, n: number): string {
      const [y, m, d] = iso.split("-").map(Number);
      const t = new Date(Date.UTC(y, m - 1, d));
      t.setUTCDate(t.getUTCDate() + n);
      return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
    }
    const total = FORECAST_ENTRIES_PAGE_SIZE + 1;
    const rows = Array.from({ length: total }, (_, i) => ({
      scope_id: "s1",
      engineer_id: E,
      date: addUtcDays("2025-06-01", i),
      hours: 1,
    }));
    let offset = 0;
    const from = vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            order: vi.fn(() => ({
              range: vi.fn(() => {
                const chunk = rows.slice(offset, offset + FORECAST_ENTRIES_PAGE_SIZE);
                offset += FORECAST_ENTRIES_PAGE_SIZE;
                return Promise.resolve({ data: chunk, error: null });
              }),
            })),
          })),
        })),
      })),
      upsert: vi.fn(),
      delete: vi.fn(() => ({ in: vi.fn() })),
    }));
    const result = await loadForecastEntries({ from } as unknown as SupabaseClient, "p1");
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(Object.keys(result.values[`s1-${E}`]!)).toHaveLength(total);
    expect(from).toHaveBeenCalledTimes(2);
  });
});

describe("saveForecastEntries", () => {
  it("upserts positive integer hours for valid row ids and ISO date keys", async () => {
    const { client, upsert } = createForecastEntriesClient({
      existing: { data: [], error: null },
    });
    const values: CellValues = {
      [`s1-${E}`]: { "2026-01-05": 4, "2026-01-06": 2.7 },
    };
    const result = await saveForecastEntries(client, "proj-1", values);
    expect(result.ok).toBe(true);
    expect(upsert).toHaveBeenCalledWith(
      [
        {
          project_id: "proj-1",
          scope_id: "s1",
          engineer_id: E,
          date: "2026-01-05",
          hours: 4,
        },
        {
          project_id: "proj-1",
          scope_id: "s1",
          engineer_id: E,
          date: "2026-01-06",
          hours: 3,
        },
      ],
      { onConflict: "project_id,scope_id,engineer_id,date" }
    );
  });

  it("skips invalid row ids that do not parse to scope + UUID engineer", async () => {
    const { client, upsert } = createForecastEntriesClient({
      existing: { data: [], error: null },
    });
    const values: CellValues = {
      "bad-row-id": { "2026-01-05": 8 },
      [`s1-${E}`]: { "2026-01-05": 1 },
    };
    const result = await saveForecastEntries(client, "p1", values);
    expect(result.ok).toBe(true);
    expect(upsert).toHaveBeenCalledWith(
      [
        {
          project_id: "p1",
          scope_id: "s1",
          engineer_id: E,
          date: "2026-01-05",
          hours: 1,
        },
      ],
      { onConflict: "project_id,scope_id,engineer_id,date" }
    );
  });

  it("skips non-ISO date field keys and zero or null hours", async () => {
    const { client, upsert } = createForecastEntriesClient({
      existing: { data: [], error: null },
    });
    const values: CellValues = {
      [`s1-${E}`]: {
        "01-05-2026": 5,
        "2026-01-05": 0,
        "2026-01-06": null as unknown as number,
        "2026-01-07": 2,
      },
    };
    await saveForecastEntries(client, "p1", values);
    expect(upsert).toHaveBeenCalledWith(
      [
        {
          project_id: "p1",
          scope_id: "s1",
          engineer_id: E,
          date: "2026-01-07",
          hours: 2,
        },
      ],
      { onConflict: "project_id,scope_id,engineer_id,date" }
    );
  });

  it("does not call upsert when there is nothing to persist", async () => {
    const { client, upsert } = createForecastEntriesClient({
      existing: { data: [], error: null },
    });
    await saveForecastEntries(client, "p1", {});
    expect(upsert).not.toHaveBeenCalled();
  });

  it("returns error when upsert fails", async () => {
    const { client } = createForecastEntriesClient({
      upsert: { error: { message: "unique violation" } },
      existing: { data: [], error: null },
    });
    const values: CellValues = { [`s1-${E}`]: { "2026-01-05": 1 } };
    const result = await saveForecastEntries(client, "p1", values);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected err");
    expect(result.error).toBe("unique violation");
  });

  it("deletes rows that are no longer in the snapshot", async () => {
    const existing = [
      { id: "row-a", scope_id: "s1", engineer_id: E, date: "2026-01-01" },
      { id: "row-b", scope_id: "s1", engineer_id: E, date: "2026-01-02" },
    ];
    const { client, deleteIn } = createForecastEntriesClient({
      existing: { data: existing, error: null },
    });
    const values: CellValues = {
      [`s1-${E}`]: { "2026-01-02": 3 },
    };
    const result = await saveForecastEntries(client, "p1", values);
    expect(result.ok).toBe(true);
    expect(deleteIn).toHaveBeenCalledWith("id", ["row-a"]);
  });

  it("does not call delete when every existing row is still in the snapshot", async () => {
    const existing = [{ id: "row-b", scope_id: "s1", engineer_id: E, date: "2026-01-02" }];
    const { client, deleteIn } = createForecastEntriesClient({
      existing: { data: existing, error: null },
    });
    const values: CellValues = {
      [`s1-${E}`]: { "2026-01-02": 3 },
    };
    await saveForecastEntries(client, "p1", values);
    expect(deleteIn).not.toHaveBeenCalled();
  });

  it("returns error when loading existing rows fails after upsert", async () => {
    const { client } = createForecastEntriesClient({
      existing: { data: [], error: { message: "timeout" } },
    });
    const values: CellValues = { [`s1-${E}`]: { "2026-01-05": 1 } };
    const result = await saveForecastEntries(client, "p1", values);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected err");
    expect(result.error).toBe("timeout");
  });

  it("returns error when delete fails", async () => {
    const existing = [{ id: "x", scope_id: "s1", engineer_id: E, date: "2026-01-01" }];
    const { client } = createForecastEntriesClient({
      existing: { data: existing, error: null },
      deleteIn: { error: { message: "forbidden" } },
    });
    const result = await saveForecastEntries(client, "p1", {});
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected err");
    expect(result.error).toBe("forbidden");
  });

  it("deletes every existing row when the snapshot is empty", async () => {
    const existing = [
      { id: "a", scope_id: "s1", engineer_id: E, date: "2026-01-01" },
      { id: "b", scope_id: "s2", engineer_id: E, date: "2026-01-02" },
    ];
    const { client, deleteIn } = createForecastEntriesClient({
      existing: { data: existing, error: null },
    });
    const result = await saveForecastEntries(client, "p1", {});
    expect(result.ok).toBe(true);
    expect(deleteIn).toHaveBeenCalledWith("id", ["a", "b"]);
  });

  it("chunks large upserts across multiple requests", async () => {
    const n = FORECAST_ENTRIES_PAGE_SIZE + 1;
    const { client, upsert } = createForecastEntriesClient({
      existing: { data: [], error: null },
    });
    const values = cellValuesWithConsecutiveDates(`s1-${E}`, n);
    const result = await saveForecastEntries(client, "p1", values);
    expect(result.ok).toBe(true);
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert.mock.calls[0]![0]).toHaveLength(FORECAST_ENTRIES_PAGE_SIZE);
    expect(upsert.mock.calls[1]![0]).toHaveLength(1);
  });

  it("chunks large deletes across multiple .in() requests", async () => {
    const existing = Array.from({ length: 501 }, (_, i) => ({
      id: `del-${i}`,
      scope_id: "s1",
      engineer_id: E,
      date: "2026-01-01",
    }));
    const { client, deleteIn } = createForecastEntriesClient({
      existing: { data: existing, error: null },
    });
    const result = await saveForecastEntries(client, "p1", {});
    expect(result.ok).toBe(true);
    expect(deleteIn).toHaveBeenCalledTimes(2);
    expect(deleteIn.mock.calls[0]![1]).toHaveLength(500);
    expect(deleteIn.mock.calls[1]![1]).toHaveLength(1);
  });
});
