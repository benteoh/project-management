import { describe, it, expect } from "vitest";

import { sortProgrammeNodesByWbs, wbsKeysEqual, wbsSortKeyFromLabel } from "./wbsSort";
import type { ProgrammeNode } from "@/components/programme/types";

function scope(id: string, name: string, children: ProgrammeNode[] = []): ProgrammeNode {
  return {
    id,
    name,
    type: "scope",
    totalHours: null,
    start: "",
    finish: "",
    status: "",
    children,
    engineers: [],
  };
}

describe("wbsKeysEqual", () => {
  it("compares segment arrays", () => {
    expect(wbsKeysEqual([1, 1], [1, 1])).toBe(true);
    expect(wbsKeysEqual([1, 1], [1, 2])).toBe(false);
    expect(wbsKeysEqual(null, [1])).toBe(false);
  });
});

describe("wbsSortKeyFromLabel", () => {
  it("parses scope-style 1. ", () => {
    expect(wbsSortKeyFromLabel("1. GMA Scoping / Assumptions")).toEqual([1]);
    expect(wbsSortKeyFromLabel("2. Building Impact")).toEqual([2]);
  });

  it("parses task-style 1.1 ", () => {
    expect(wbsSortKeyFromLabel("1.1 Phase 2 report")).toEqual([1, 1]);
    expect(wbsSortKeyFromLabel("2.3 Detail")).toEqual([2, 3]);
  });

  it("parses subtask-style 1.1.1 ", () => {
    expect(wbsSortKeyFromLabel("1.1.1 Sub-item")).toEqual([1, 1, 1]);
  });

  it("returns null for activity titles without WBS prefix", () => {
    expect(wbsSortKeyFromLabel("Collect asset information")).toBeNull();
    expect(wbsSortKeyFromLabel("A1000")).toBeNull();
  });
});

describe("sortProgrammeNodesByWbs", () => {
  it("orders root scopes by leading number", () => {
    const tree: ProgrammeNode[] = [scope("s2", "2. Second scope"), scope("s1", "1. First scope")];
    const sorted = sortProgrammeNodesByWbs(tree);
    expect(sorted.map((n) => n.name)).toEqual(["1. First scope", "2. Second scope"]);
  });

  it("orders tasks under a scope by WBS (1.2 before 1.10 numerically)", () => {
    const tree: ProgrammeNode[] = [
      scope("s1", "1. GMA", [
        {
          id: "t2",
          name: "1.2 Later task",
          type: "task",
          totalHours: null,
          start: "",
          finish: "",
          status: "",
          children: [],
        },
        {
          id: "t1",
          name: "1.1 Earlier task",
          type: "task",
          totalHours: null,
          start: "",
          finish: "",
          status: "",
          children: [],
        },
      ]),
    ];
    const sorted = sortProgrammeNodesByWbs(tree);
    expect(sorted[0].children.map((c) => c.name)).toEqual(["1.1 Earlier task", "1.2 Later task"]);
  });
});
