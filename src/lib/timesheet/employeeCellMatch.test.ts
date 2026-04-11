import { describe, expect, it } from "vitest";

import {
  buildEmployeeCellMatchSet,
  buildEmployeeCellMatchSetFromGridPool,
  employeeCellIsKnown,
  resolveEngineerFromEmployeeCell,
  type EngineerPoolRow,
} from "./employeeCellMatch";

const pool: EngineerPoolRow[] = [
  {
    id: "uuid-1",
    code: "Gak",
    first_name: "Andreas",
    last_name: "Gakis",
  },
  {
    id: "uuid-2",
    code: "EBa",
    first_name: "Emma",
    last_name: "Barnes",
  },
];

describe("resolveEngineerFromEmployeeCell", () => {
  it("matches LastName Initial.", () => {
    expect(resolveEngineerFromEmployeeCell("Gakis A.", pool)).toEqual({
      engineerId: "uuid-1",
    });
  });

  it("matches LastName Initial without dot", () => {
    expect(resolveEngineerFromEmployeeCell("gakis a", pool)).toEqual({
      engineerId: "uuid-1",
    });
  });

  it("matches Last, First", () => {
    expect(resolveEngineerFromEmployeeCell("Barnes, Emma", pool)).toEqual({
      engineerId: "uuid-2",
    });
  });

  it("matches Last, F.", () => {
    expect(resolveEngineerFromEmployeeCell("Barnes, E.", pool)).toEqual({
      engineerId: "uuid-2",
    });
  });

  it("matches normalised First Last", () => {
    expect(resolveEngineerFromEmployeeCell("Emma Barnes", pool)).toEqual({
      engineerId: "uuid-2",
    });
  });

  it("matches normalised Last First", () => {
    expect(resolveEngineerFromEmployeeCell("Barnes Emma", pool)).toEqual({
      engineerId: "uuid-2",
    });
  });

  it("falls back to engineer code after name patterns fail", () => {
    expect(resolveEngineerFromEmployeeCell("EBa", pool)).toEqual({
      engineerId: "uuid-2",
    });
  });

  it("returns null engineerId when unknown", () => {
    expect(resolveEngineerFromEmployeeCell("Nobody Here", pool)).toEqual({
      engineerId: null,
    });
  });

  it("returns null for empty cell", () => {
    expect(resolveEngineerFromEmployeeCell("  ", pool)).toEqual({
      engineerId: null,
    });
  });

  it("prefers name match over code when both could apply", () => {
    const ambiguous: EngineerPoolRow[] = [
      { id: "a", code: "X1", first_name: "X1", last_name: "Smith" },
      { id: "b", code: "AB", first_name: "Ann", last_name: "Brown" },
    ];
    expect(resolveEngineerFromEmployeeCell("Smith X.", ambiguous).engineerId).toBe("a");
  });
});

describe("buildEmployeeCellMatchSet & employeeCellIsKnown", () => {
  const known = buildEmployeeCellMatchSet(pool);

  it("recognises display name variants", () => {
    expect(employeeCellIsKnown("Gakis A.", known)).toBe(true);
    expect(employeeCellIsKnown("gakis a.", known)).toBe(true);
  });

  it("recognises code", () => {
    expect(employeeCellIsKnown("EBa", known)).toBe(true);
  });

  it("rejects unknown", () => {
    expect(employeeCellIsKnown("Unknown Person", known)).toBe(false);
  });

  it("buildEmployeeCellMatchSetFromGridPool maps camelCase fields", () => {
    const set = buildEmployeeCellMatchSetFromGridPool([
      { code: "Z", firstName: "Zed", lastName: "Zed" },
    ]);
    expect(employeeCellIsKnown("Zed Z.", set)).toBe(true);
  });
});
