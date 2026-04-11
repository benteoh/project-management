import { describe, expect, it } from "vitest";

import {
  collectActivitiesUnderScope,
  findBestScopeId,
  matchActivityFromSpecifier,
  matchActivityIdInNotes,
  normalise,
  parseProjNumber,
  resolveProjectFromProjCell,
  sigWords,
  wordCoverage,
  type ProgrammeNodeImportRow,
  type ProjectForImport,
} from "./timesheetImportResolve";

const MIN = 0.8;

const seedProject: ProjectForImport[] = [{ id: "1", name: "Euston Station", project_code: "489" }];

describe("parseProjNumber", () => {
  it("parses bracketed form", () => {
    expect(parseProjNumber("[489] - Euston Station")).toEqual({
      code: "489",
      namePart: "Euston Station",
    });
  });

  it("parses plain code - name", () => {
    expect(parseProjNumber("489 - Euston Station HS2")).toEqual({
      code: "489",
      namePart: "Euston Station HS2",
    });
  });

  it("parses plain code with empty or abbreviated name part", () => {
    expect(parseProjNumber("489 - ")).toEqual({ code: "489", namePart: "" });
    expect(parseProjNumber("489 - Euston")).toEqual({ code: "489", namePart: "Euston" });
  });

  it("parses code-only cell", () => {
    expect(parseProjNumber("489")).toEqual({ code: "489", namePart: "" });
  });

  it("normalises Excel en-dash and NBSP", () => {
    expect(parseProjNumber("489\u00A0–\u00A0Euston")).toEqual({
      code: "489",
      namePart: "Euston",
    });
  });

  it("returns null for empty or non-matching", () => {
    expect(parseProjNumber("")).toBeNull();
    expect(parseProjNumber("no dash here")).toBeNull();
  });
});

describe("resolveProjectFromProjCell", () => {
  it("resolves when spreadsheet name extends DB name (bidirectional coverage)", () => {
    expect(resolveProjectFromProjCell("489 - Euston Station HS2", seedProject, MIN)).toBe("1");
  });

  it("resolves exact name match", () => {
    expect(resolveProjectFromProjCell("489 - Euston Station", seedProject, MIN)).toBe("1");
  });

  it("resolves by project_code when name is abbreviated (single project for code)", () => {
    expect(resolveProjectFromProjCell("489 - Euston", seedProject, MIN)).toBe("1");
  });

  it("resolves code-only cell when unique project_code", () => {
    expect(resolveProjectFromProjCell("489", seedProject, MIN)).toBe("1");
  });

  it("returns null when project_code wrong", () => {
    expect(resolveProjectFromProjCell("999 - Euston Station", seedProject, MIN)).toBeNull();
  });

  it("still maps by code when suffix does not match name (unique code)", () => {
    expect(resolveProjectFromProjCell("489 - Completely Other", seedProject, MIN)).toBe("1");
  });

  it("falls back to projects.id when project_code is null", () => {
    const idOnly: ProjectForImport[] = [{ id: "1", name: "Euston Station", project_code: null }];
    expect(resolveProjectFromProjCell("1 - Euston", idOnly, MIN)).toBe("1");
    expect(resolveProjectFromProjCell("1", idOnly, MIN)).toBe("1");
  });

  it("disambiguates when several projects share project_code", () => {
    const two: ProjectForImport[] = [
      { id: "1", name: "Euston Station", project_code: "489" },
      { id: "2", name: "Other Site", project_code: "489" },
    ];
    expect(resolveProjectFromProjCell("489 - Euston Station", two, MIN)).toBe("1");
    expect(resolveProjectFromProjCell("489 - Other Site", two, MIN)).toBe("2");
    expect(resolveProjectFromProjCell("489 - nonsense xyz", two, MIN)).toBeNull();
    expect(resolveProjectFromProjCell("489", two, MIN)).toBeNull();
  });
});

describe("findBestScopeId", () => {
  const scopes = [
    { id: "s1", name: "LUL CRX North" },
    { id: "s2", name: "Other Scope" },
  ];

  it("matches task id words to scope name at threshold", () => {
    expect(findBestScopeId("LUL CRX", scopes, MIN)).toBe("s1");
  });

  it("returns null when below threshold", () => {
    expect(findBestScopeId("Unrelated Words Here", scopes, MIN)).toBeNull();
  });

  it("returns null for blank task", () => {
    expect(findBestScopeId("  ", scopes, MIN)).toBeNull();
  });
});

describe("collectActivitiesUnderScope", () => {
  const nodes: ProgrammeNodeImportRow[] = [
    {
      id: "scope1",
      project_id: "1",
      parent_id: null,
      type: "scope",
      name: "S",
      activity_id: null,
    },
    {
      id: "task1",
      project_id: "1",
      parent_id: "scope1",
      type: "task",
      name: "T",
      activity_id: null,
    },
    {
      id: "act1",
      project_id: "1",
      parent_id: "task1",
      type: "activity",
      name: "Draw",
      activity_id: "D9",
    },
    {
      id: "act2",
      project_id: "1",
      parent_id: "scope1",
      type: "activity",
      name: "Other",
      activity_id: null,
    },
  ];

  it("collects nested activities only under the scope subtree", () => {
    const acts = collectActivitiesUnderScope("scope1", nodes);
    expect(acts.map((a) => a.id).sort()).toEqual(["act1", "act2"]);
  });
});

describe("matchActivityFromSpecifier", () => {
  const acts: ProgrammeNodeImportRow[] = [
    {
      id: "act-a",
      project_id: "1",
      parent_id: "t",
      type: "activity",
      name: "Review FEA",
      activity_id: "D9",
    },
  ];

  it("matches activity_id column case-insensitively", () => {
    expect(matchActivityFromSpecifier("d9", acts, MIN)).toBe("act-a");
  });

  it("matches node id", () => {
    expect(matchActivityFromSpecifier("act-a", acts, MIN)).toBe("act-a");
  });

  it("matches exact name", () => {
    expect(matchActivityFromSpecifier("Review FEA", acts, MIN)).toBe("act-a");
  });
});

describe("matchActivityIdInNotes", () => {
  const acts: ProgrammeNodeImportRow[] = [
    {
      id: "n1",
      project_id: "1",
      parent_id: "x",
      type: "activity",
      name: "Long activity name here",
      activity_id: "A4190",
    },
    {
      id: "n2",
      project_id: "1",
      parent_id: "x",
      type: "activity",
      name: "Second",
      activity_id: "A4200",
    },
  ];

  it("picks leftmost token in notes", () => {
    expect(matchActivityIdInNotes("A4190, A4200: review", acts)).toBe("n1");
  });

  it("returns null for empty notes", () => {
    expect(matchActivityIdInNotes("  ", acts)).toBeNull();
  });
});

describe("normalise & wordCoverage", () => {
  it("normalise strips punctuation and lowercases", () => {
    expect(normalise("LUL-CRX!")).toBe("lul crx");
  });

  it("wordCoverage is directional", () => {
    const q = sigWords("alpha beta");
    expect(wordCoverage(q, "alpha beta gamma")).toBe(1);
    expect(wordCoverage(sigWords("alpha"), "alpha beta")).toBe(1);
  });
});
