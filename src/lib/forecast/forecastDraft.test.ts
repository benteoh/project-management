import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CellValues } from "@/components/forecast/forecastGridTypes";

import { clearDraft, loadDraft, saveDraft } from "./forecastDraft";

describe("forecastDraft", () => {
  const projectId = "test-project-1";

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-09T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it("returns null when no draft exists", () => {
    expect(loadDraft(projectId)).toBeNull();
  });

  it("round-trips values via saveDraft and loadDraft", () => {
    const values: CellValues = {
      "scope-uuid-a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11": {
        "2026-01-05": 4,
        "2026-01-06": 1,
      },
    };
    saveDraft(projectId, values);
    const loaded = loadDraft(projectId);
    expect(loaded).not.toBeNull();
    expect(loaded!.values).toEqual(values);
    expect(loaded!.savedAt).toBe("2026-04-09T12:00:00.000Z");
  });

  it("uses key forecast_draft_${projectId}", () => {
    saveDraft(projectId, {});
    expect(localStorage.getItem(`forecast_draft_${projectId}`)).not.toBeNull();
    expect(localStorage.getItem("forecast_draft_other")).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    localStorage.setItem(`forecast_draft_${projectId}`, "not-json");
    expect(loadDraft(projectId)).toBeNull();
  });

  it("returns null when payload is missing values", () => {
    localStorage.setItem(
      `forecast_draft_${projectId}`,
      JSON.stringify({ savedAt: "2026-01-01T00:00:00.000Z" })
    );
    expect(loadDraft(projectId)).toBeNull();
  });

  it("returns null when savedAt is not a string", () => {
    localStorage.setItem(`forecast_draft_${projectId}`, JSON.stringify({ values: {}, savedAt: 0 }));
    expect(loadDraft(projectId)).toBeNull();
  });

  it("clearDraft removes the stored key", () => {
    saveDraft(projectId, { a: { "2026-01-01": 1 } });
    clearDraft(projectId);
    expect(loadDraft(projectId)).toBeNull();
  });

  it("overwrites an existing draft on second saveDraft", () => {
    saveDraft(projectId, { r1: { "2026-01-01": 1 } });
    saveDraft(projectId, { r2: { "2026-01-02": 2 } });
    const loaded = loadDraft(projectId);
    expect(loaded).not.toBeNull();
    expect(loaded!.values).toEqual({ r2: { "2026-01-02": 2 } });
  });
});
