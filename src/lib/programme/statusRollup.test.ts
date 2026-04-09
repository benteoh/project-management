import { describe, expect, it } from "vitest";

import type { ProgrammeNode } from "@/components/programme/types";

import { rollupStatusesFromChildren, rollupStatusInTree } from "./statusRollup";

const base = (overrides: Partial<ProgrammeNode>): ProgrammeNode => ({
  id: "x",
  name: "n",
  type: "activity",
  totalHours: 0,
  start: "",
  finish: "",
  status: "Not Started",
  children: [],
  ...overrides,
});

describe("rollupStatusesFromChildren", () => {
  it("returns empty when no children", () => {
    expect(rollupStatusesFromChildren([])).toBe("");
  });

  it("all Completed → Completed", () => {
    expect(rollupStatusesFromChildren(["Completed", "Completed"])).toBe("Completed");
  });

  it("all Not Started or empty → Not Started", () => {
    expect(rollupStatusesFromChildren(["Not Started", "Not Started"])).toBe("Not Started");
    expect(rollupStatusesFromChildren(["", "Not Started"])).toBe("Not Started");
  });

  it("any In Progress → In Progress", () => {
    expect(rollupStatusesFromChildren(["In Progress"])).toBe("In Progress");
    expect(rollupStatusesFromChildren(["Completed", "Not Started"])).toBe("In Progress");
  });
});

describe("rollupStatusInTree", () => {
  it("keeps activity status", () => {
    const tree: ProgrammeNode[] = [base({ id: "a", status: "In Progress", type: "activity" })];
    const rolled = rollupStatusInTree(tree);
    expect(rolled[0].status).toBe("In Progress");
  });

  it("parent scope reflects only activity children", () => {
    const tree: ProgrammeNode[] = [
      {
        ...base({ id: "scope", type: "scope", status: "Completed", name: "S" }),
        children: [
          base({ id: "t", type: "task", status: "Not Started", name: "T", children: [] }),
          {
            ...base({ id: "t2", type: "task", name: "T2" }),
            children: [
              base({ id: "act", status: "Completed", name: "A" }),
              base({ id: "act2", status: "Not Started", name: "B" }),
            ],
          },
        ],
      },
    ];
    const rolled = rollupStatusInTree(tree);
    expect(rolled[0].status).toBe("In Progress");
    expect(rolled[0].children[0].status).toBe("");
    expect(rolled[0].children[1].status).toBe("In Progress");
  });

  it("leaf non-activity has empty status", () => {
    const tree: ProgrammeNode[] = [
      { ...base({ id: "t", type: "task", name: "T", status: "In Progress" }), children: [] },
    ];
    const rolled = rollupStatusInTree(tree);
    expect(rolled[0].status).toBe("");
  });
});
