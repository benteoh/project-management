import { describe, it, expect } from "vitest";
import { formatCurrency, formatDate } from "./utils";

describe("formatCurrency", () => {
  it("formats a whole number", () => {
    expect(formatCurrency(230000)).toBe("£230,000");
  });

  it("formats zero", () => {
    expect(formatCurrency(0)).toBe("£0");
  });

  it("formats a negative value", () => {
    expect(formatCurrency(-5000)).toBe("£-5,000");
  });

  it("formats a decimal value", () => {
    expect(formatCurrency(1234.5)).toBe("£1,234.5");
  });
});

describe("formatDate", () => {
  it("formats a date string to Mon YYYY", () => {
    expect(formatDate("2025-01-06")).toBe("Jan 2025");
  });

  it("formats end of year correctly", () => {
    expect(formatDate("2026-12-31")).toBe("Dec 2026");
  });

  it("formats mid-year correctly", () => {
    expect(formatDate("2025-06-15")).toBe("Jun 2025");
  });
});
