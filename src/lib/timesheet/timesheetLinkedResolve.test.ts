import { describe, expect, it } from "vitest";

import type { ProgrammeNode } from "@/components/programme/types";
import { resolveScopeNodeForTaskIdCell } from "./timesheetLinkedResolve";

const scopeNode: ProgrammeNode = {
  id: "scope-uuid-123",
  name: "Endwalls Design",
  type: "scope",
  totalHours: 100,
  start: "2026-01-01",
  finish: "2026-06-30",
  status: "",
  children: [],
  engineers: [],
};

const tree: ProgrammeNode[] = [scopeNode];

describe("resolveScopeNodeForTaskIdCell", () => {
  it("resolves by fuzzy match when no mapping", () => {
    expect(resolveScopeNodeForTaskIdCell("Endwalls Design", tree)).toBe(scopeNode);
  });

  it("returns null when no fuzzy match and no mapping", () => {
    expect(resolveScopeNodeForTaskIdCell("completely wrong text xyz", tree)).toBeNull();
  });

  it("resolves via mapping when text would not fuzzy-match", () => {
    const mappings = new Map([["completely wrong text xyz", "scope-uuid-123"]]);
    const result = resolveScopeNodeForTaskIdCell("completely wrong text xyz", tree, mappings);
    expect(result).toBe(scopeNode);
  });

  it("mapping lookup is case-insensitive", () => {
    const mappings = new Map([["completely wrong text xyz", "scope-uuid-123"]]);
    const result = resolveScopeNodeForTaskIdCell("COMPLETELY WRONG TEXT XYZ", tree, mappings);
    expect(result).toBe(scopeNode);
  });

  it("returns null when mapping points to unknown scope id", () => {
    const mappings = new Map([["some text", "nonexistent-id"]]);
    const result = resolveScopeNodeForTaskIdCell("some text", tree, mappings);
    expect(result).toBeNull();
  });
});
