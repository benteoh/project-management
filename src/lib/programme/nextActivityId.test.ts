import { describe, it, expect } from "vitest";

import type { ProgrammeNode } from "@/components/programme/types";

import { nextActivityIdFromTree } from "./nextActivityId";

const empty = (): ProgrammeNode[] => [];

describe("nextActivityIdFromTree", () => {
  it("defaults when no activities", () => {
    expect(nextActivityIdFromTree(empty())).toBe("A3610");
  });

  it("adds 10 to max numeric suffix with same prefix", () => {
    const tree: ProgrammeNode[] = [
      {
        id: "s",
        name: "S",
        type: "scope",
        totalHours: 0,
        start: "",
        finish: "",
        status: "",
        children: [
          {
            id: "a",
            name: "A",
            type: "activity",
            activityId: "A3630",
            totalHours: 1,
            start: "",
            finish: "",
            status: "Not Started",
            children: [],
          },
        ],
      },
    ];
    expect(nextActivityIdFromTree(tree)).toBe("A3640");
  });
});
