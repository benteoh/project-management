import { describe, it, expect } from "vitest";

import type { ProgrammeNode } from "@/components/programme/types";

import { isRollupTotalHoursParent, rollupTotalHoursInTree } from "./totalHoursRollup";

const base = {
  start: "",
  finish: "",
  forecastTotalHours: null as number | null,
  status: "Not Started" as const,
};

describe("isRollupTotalHoursParent", () => {
  it("is true for task with children", () => {
    const n: ProgrammeNode = {
      ...base,
      id: "t",
      name: "T",
      type: "task",
      totalHours: 0,
      children: [{ ...base, id: "a", name: "A", type: "activity", totalHours: 5, children: [] }],
    };
    expect(isRollupTotalHoursParent(n)).toBe(true);
  });

  it("is true for scope with children", () => {
    const n: ProgrammeNode = {
      ...base,
      id: "s",
      name: "S",
      type: "scope",
      totalHours: 0,
      status: "",
      children: [{ ...base, id: "t", name: "T", type: "task", totalHours: 10, children: [] }],
    };
    expect(isRollupTotalHoursParent(n)).toBe(true);
  });

  it("is false for task without children", () => {
    const n: ProgrammeNode = {
      ...base,
      id: "t",
      name: "T",
      type: "task",
      totalHours: 10,
      children: [],
    };
    expect(isRollupTotalHoursParent(n)).toBe(false);
  });
});

describe("rollupTotalHoursInTree", () => {
  it("sets scope totalHours to sum of top-level children", () => {
    const tree: ProgrammeNode[] = [
      {
        ...base,
        id: "s",
        name: "S",
        type: "scope",
        totalHours: 999,
        status: "",
        children: [
          {
            ...base,
            id: "t1",
            name: "T1",
            type: "task",
            totalHours: 10,
            children: [],
          },
          {
            ...base,
            id: "t2",
            name: "T2",
            type: "task",
            totalHours: 20,
            children: [],
          },
        ],
      },
    ];
    const rolled = rollupTotalHoursInTree(tree);
    expect(rolled[0].totalHours).toBe(30);
  });

  it("sets parent task totalHours to sum of children", () => {
    const tree: ProgrammeNode[] = [
      {
        ...base,
        id: "s",
        name: "S",
        type: "scope",
        totalHours: 100,
        status: "",
        children: [
          {
            ...base,
            id: "t",
            name: "T",
            type: "task",
            totalHours: 999,
            children: [
              { ...base, id: "a1", name: "A1", type: "activity", totalHours: 10, children: [] },
              { ...base, id: "a2", name: "A2", type: "activity", totalHours: 20, children: [] },
            ],
          },
        ],
      },
    ];
    const rolled = rollupTotalHoursInTree(tree);
    expect(rolled[0].children[0].totalHours).toBe(30);
    expect(rolled[0].totalHours).toBe(30);
  });

  it("nested parent subtasks roll up recursively", () => {
    const tree: ProgrammeNode[] = [
      {
        ...base,
        id: "s",
        name: "S",
        type: "scope",
        totalHours: 50,
        status: "",
        children: [
          {
            ...base,
            id: "t",
            name: "T",
            type: "task",
            totalHours: 0,
            children: [
              {
                ...base,
                id: "st",
                name: "ST",
                type: "subtask",
                totalHours: 0,
                children: [
                  { ...base, id: "a", name: "A", type: "activity", totalHours: 7, children: [] },
                ],
              },
            ],
          },
        ],
      },
    ];
    const rolled = rollupTotalHoursInTree(tree);
    expect(rolled[0].children[0].children[0].totalHours).toBe(7);
    expect(rolled[0].children[0].totalHours).toBe(7);
    expect(rolled[0].totalHours).toBe(7);
  });
});
