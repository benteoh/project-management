// Pure, stateless cell-value utilities. No React, no AG Grid API dependency.

import type { SelRange } from "./forecastGridTypes";

// ── Formula evaluation ────────────────────────────────────────────────────────
// Only digits / operators / parens are allowed through — safe against injection.
export function evalFormula(raw: string): number | string {
  if (!raw.startsWith("=")) return raw;
  const expr = raw.slice(1).replace(/[^0-9+\-*/().\s]/g, "");
  if (!expr.trim() || expr.length > 200) return "#ERROR";
  try {
    const result = new Function(`"use strict"; return (${expr})`)() as unknown;
    return typeof result === "number" && isFinite(result)
      ? Math.round(result * 1000) / 1000
      : "#ERROR";
  } catch {
    return "#ERROR";
  }
}

export function cellNumeric(value: unknown): number {
  if (value == null || value === "") return 0;
  if (typeof value === "string" && value.startsWith("=")) {
    const ev = evalFormula(value);
    return typeof ev === "number" ? ev : 0;
  }
  const n = Number(value);
  return isNaN(n) ? 0 : n;
}

export function displayValue(value: unknown): string {
  if (value == null || value === "") return "";
  if (typeof value === "string" && value.startsWith("=")) return String(evalFormula(value));
  return String(value);
}

// ── Pattern detection ─────────────────────────────────────────────────────────
// Supports constant and arithmetic progressions.
// Returns a function: (offsetFromEnd) => nextValue
export function detectFillPattern(vals: (number | null)[]): (offset: number) => number | null {
  const nums = vals.filter((v): v is number => v != null);
  if (nums.length === 0) return () => null;
  if (nums.length === 1) return () => nums[0];
  const diffs = nums.slice(1).map((v, i) => v - nums[i]);
  const step = diffs[0];
  const isArithmetic = diffs.every((d) => Math.abs(d - step) < 0.0001);
  if (isArithmetic) {
    const last = nums[nums.length - 1];
    return (offset: number) => last + step * (offset + 1);
  }
  return () => nums[nums.length - 1];
}

// ── Selection helpers ─────────────────────────────────────────────────────────
export function normSel(s: SelRange): SelRange {
  return {
    r1: Math.min(s.r1, s.r2),
    r2: Math.max(s.r1, s.r2),
    c1: Math.min(s.c1, s.c2),
    c2: Math.max(s.c1, s.c2),
  };
}
