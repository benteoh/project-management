import { describe, expect, it } from "vitest";

import { findCol, findColRegex, normaliseHeaderForColMatch } from "./xlsxUtils";

describe("normaliseHeaderForColMatch", () => {
  it("collapses internal whitespace and lowercases", () => {
    expect(normaliseHeaderForColMatch("Proj.  #")).toBe("proj. #");
    expect(normaliseHeaderForColMatch("TASK ID")).toBe("task id");
  });

  it("maps fullwidth # and .", () => {
    expect(normaliseHeaderForColMatch(`Proj\uFF0E\uFF03`)).toBe("proj. #");
  });
});

describe("findCol", () => {
  const row = ["Date", "Hours", "Employee", "Proj. #", "Task ID", "Notes"];

  it("matches Proj. # in a typical export header row", () => {
    expect(findCol(row, ["proj. #"])).toBe(3);
  });

  it("matches with extra spaces in header", () => {
    expect(findCol(["Date", "Proj.  #", "Notes"], ["proj. #"])).toBe(1);
  });
});

describe("findColRegex", () => {
  it("finds proj # column when exact list misses", () => {
    const row = ["Date", "Hours", "PROJECT #", "Task ID"];
    expect(findColRegex(row, [/^proj(ect)?\.?\s*#\s*$/])).toBe(2);
  });
});
