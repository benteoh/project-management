import { describe, expect, it } from "vitest";

import { deriveEngineerCodeBase } from "./engineerCode";

describe("deriveEngineerCodeBase", () => {
  it("uses first initial plus first two letters of last (mixed case)", () => {
    expect(deriveEngineerCodeBase("Jane", "Doe")).toBe("JDo");
  });

  it("trims whitespace", () => {
    expect(deriveEngineerCodeBase("  Alex  ", " Petit ")).toBe("APe");
  });

  it("pads missing characters with X", () => {
    expect(deriveEngineerCodeBase("", "Doe")).toBe("XDo");
    expect(deriveEngineerCodeBase("Jane", "")).toBe("JXX");
    expect(deriveEngineerCodeBase("Jane", "D")).toBe("JDX");
  });
});
