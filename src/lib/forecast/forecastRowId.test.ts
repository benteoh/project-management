import { describe, it, expect } from "vitest";

import { forecastRowId, parseForecastRowId } from "./forecastRowId";

const E = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"; // valid v4 UUID

describe("forecastRowId", () => {
  it("concatenates scope and engineer with a single hyphen", () => {
    expect(forecastRowId("scope-a", E)).toBe(`scope-a-${E}`);
  });

  it("supports numeric scope ids", () => {
    expect(forecastRowId("1", E)).toBe(`1-${E}`);
  });
});

describe("parseForecastRowId", () => {
  it("parses scope id without hyphens", () => {
    expect(parseForecastRowId(`1-${E}`)).toEqual({ scopeId: "1", engineerId: E });
  });

  it("parses scope id that contains hyphens (scope is not a UUID)", () => {
    expect(parseForecastRowId(`my-scope-${E}`)).toEqual({ scopeId: "my-scope", engineerId: E });
  });

  it("parses scope id that looks like a UUID prefix (engineer UUID is always last 36 chars)", () => {
    const scope = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    expect(parseForecastRowId(`${scope}-${E}`)).toEqual({ scopeId: scope, engineerId: E });
  });

  it("returns null for row ids shorter than 38 characters", () => {
    expect(parseForecastRowId("short")).toBeNull();
    expect(parseForecastRowId("")).toBeNull();
  });

  it("returns null when last 36 chars are not a valid UUID", () => {
    expect(parseForecastRowId(`1-not-a-uuid-xxxxxxxxxxxxxxxxxxxxxxxxxxxx`)).toBeNull();
  });

  it("returns null when engineer segment is not UUID-shaped (wrong length)", () => {
    // 35 chars after final hyphen
    expect(parseForecastRowId(`1-${E.slice(0, 35)}`)).toBeNull();
  });

  it("returns null when row id is only hyphen plus UUID (length 37 < 38)", () => {
    const id = `-${E}`;
    expect(id.length).toBe(37);
    expect(parseForecastRowId(id)).toBeNull();
  });

  it("is round-trippable with forecastRowId for typical scope ids", () => {
    const scopeId = "prog-node-42";
    const rid = forecastRowId(scopeId, E);
    expect(parseForecastRowId(rid)).toEqual({ scopeId, engineerId: E });
  });
});
