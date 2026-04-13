import { describe, expect, it } from "vitest";

import { createSeededRng } from "../seedDeterministicRandom";
import {
  demoExactPlannedScopeIds,
  generateProgrammeForecastRows,
  MAX_FORECAST_HOURS_PER_DAY,
} from "./generateProgrammeForecastRows";
import { sumAllocationPlannedHrs } from "../scopeEngineerPlannedDistribution";
import { SEED_SCOPE_ENGINEER_FALLBACK } from "../programmeSeedDemo";
import {
  DEMO_FORECAST_PLAN_END_ISO,
  defaultSeedScopeForecastSpecs,
  isProgrammeDemoForecastExactScope,
  programmeDemoForecastScopePayload,
} from "../seedProgrammeScopeMetadata";

function scopesPayload(
  specs: ReturnType<typeof defaultSeedScopeForecastSpecs>,
  exactSet: Set<string>
) {
  return specs.map((s) =>
    programmeDemoForecastScopePayload(
      {
        scopeId: s.scopeId,
        startIso: s.startIso,
        endIso: s.endIso,
        allocations: s.allocations.map((a) => ({
          code: a.code,
          plannedHrs: a.plannedHrs ?? 0,
        })),
      },
      exactSet
    )
  );
}

describe("generateProgrammeForecastRows", () => {
  it("emits only whole-hour values ≥ 1", () => {
    const specs = defaultSeedScopeForecastSpecs(SEED_SCOPE_ENGINEER_FALLBACK);
    const exact = demoExactPlannedScopeIds(specs.map((s) => s.scopeId));
    const rows = generateProgrammeForecastRows({
      projectId: "1",
      planEndIso: DEMO_FORECAST_PLAN_END_ISO,
      scopes: scopesPayload(specs.slice(0, 3), exact),
      rng: createSeededRng(123),
    });

    for (const r of rows) {
      expect(Number.isInteger(r.hours)).toBe(true);
      expect(r.hours).toBeGreaterThanOrEqual(1);
    }
  });

  it("exact-planned scopes: per-engineer totals match planned_hrs after cut", () => {
    const specs = defaultSeedScopeForecastSpecs(SEED_SCOPE_ENGINEER_FALLBACK);
    const planEnd = DEMO_FORECAST_PLAN_END_ISO;
    const exactSet = demoExactPlannedScopeIds(specs.map((s) => s.scopeId));
    const rows = generateProgrammeForecastRows({
      projectId: "1",
      planEndIso: planEnd,
      scopes: scopesPayload(specs, exactSet),
      rng: createSeededRng(777),
    });

    for (const spec of specs) {
      if (!isProgrammeDemoForecastExactScope(spec.scopeId, exactSet)) continue;

      for (const a of spec.allocations) {
        const planned = a.plannedHrs ?? 0;
        const sum = rows
          .filter((r) => r.scopeId === spec.scopeId && r.engineerCode === a.code)
          .reduce((s, r) => s + r.hours, 0);
        expect(sum).toBe(planned);
      }
    }
  });

  it("variance scopes: scope-level forecast sum usually differs from planned sum", () => {
    const specs = defaultSeedScopeForecastSpecs(SEED_SCOPE_ENGINEER_FALLBACK);
    const exactSet = demoExactPlannedScopeIds(specs.map((s) => s.scopeId));
    const varianceScope = specs.find(
      (s) => !isProgrammeDemoForecastExactScope(s.scopeId, exactSet)
    );
    expect(varianceScope).toBeDefined();

    const rows = generateProgrammeForecastRows({
      projectId: "1",
      planEndIso: DEMO_FORECAST_PLAN_END_ISO,
      scopes: scopesPayload(specs, exactSet),
      rng: createSeededRng(42),
    });

    const plannedSum = sumAllocationPlannedHrs(varianceScope!.allocations);
    const forecastSum = rows
      .filter((r) => r.scopeId === varianceScope!.scopeId)
      .reduce((s, r) => s + r.hours, 0);

    expect(forecastSum).not.toBe(plannedSum);
  });

  it("does not place hours after planEndIso", () => {
    const specs = defaultSeedScopeForecastSpecs(SEED_SCOPE_ENGINEER_FALLBACK);
    const planEnd = DEMO_FORECAST_PLAN_END_ISO;
    const exactSet = demoExactPlannedScopeIds(specs.map((s) => s.scopeId));
    const rows = generateProgrammeForecastRows({
      projectId: "1",
      planEndIso: planEnd,
      scopes: scopesPayload(specs, exactSet),
      rng: createSeededRng(3),
    });

    for (const r of rows) {
      expect(r.date.localeCompare(planEnd)).toBeLessThanOrEqual(0);
    }
  });

  it("never exceeds MAX_FORECAST_HOURS_PER_DAY on any row (programme demo)", () => {
    const specs = defaultSeedScopeForecastSpecs(SEED_SCOPE_ENGINEER_FALLBACK);
    const exactSet = demoExactPlannedScopeIds(specs.map((s) => s.scopeId));
    const rows = generateProgrammeForecastRows({
      projectId: "1",
      planEndIso: DEMO_FORECAST_PLAN_END_ISO,
      scopes: scopesPayload(specs, exactSet),
      rng: createSeededRng(2026),
    });

    for (const r of rows) {
      expect(r.hours).toBeLessThanOrEqual(MAX_FORECAST_HOURS_PER_DAY);
    }
  });

  it("variance above1× planned can exceed roster hours when weekday capacity allows", () => {
    const rows = generateProgrammeForecastRows({
      projectId: "1",
      planEndIso: "2026-12-31",
      scopes: [
        {
          scopeId: "sz",
          startIso: "2026-01-05",
          endIso: "2026-12-31",
          allocations: [{ code: "ZZ", plannedHrs: 200 }],
          exactPlanned: false,
          varianceFactorMin: 1.08,
          varianceFactorMax: 1.15,
        },
      ],
      rng: createSeededRng(42),
    });
    const fc = rows.reduce((s, r) => s + r.hours, 0);
    expect(fc).toBeGreaterThan(200);
    for (const r of rows) {
      expect(r.hours).toBeLessThanOrEqual(MAX_FORECAST_HOURS_PER_DAY);
    }
  });
});
