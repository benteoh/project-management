import { describe, expect, it } from "vitest";

import { createSeededRng } from "../seedDeterministicRandom";
import {
  demoExactPlannedScopeIds,
  generateProgrammeForecastRows,
} from "./generateProgrammeForecastRows";
import {
  generateTimesheetRowsFromForecast,
  timesheetRowMatchesAlignedForecast,
} from "./generateProgrammeTimesheetFromForecast";
import {
  PROGRAMME_DEMO_PROJECT_ID,
  PROGRAMME_DEMO_PROJECT_LABEL,
  SEED_SCOPE_ENGINEER_FALLBACK,
} from "../programmeSeedDemo";
import {
  DEMO_FORECAST_PLAN_END_ISO,
  defaultSeedScopeForecastSpecs,
  programmeDemoForecastScopePayload,
} from "../seedProgrammeScopeMetadata";

describe("generateTimesheetRowsFromForecast (programme-wide)", () => {
  it("aligns at least 80% of non-zero forecast slots with same-week timesheet rows per scope", () => {
    const specs = defaultSeedScopeForecastSpecs(SEED_SCOPE_ENGINEER_FALLBACK);
    const activityIdsByScopeId = new Map(specs.map((s) => [s.scopeId, s.activityIds]));

    const rngF = createSeededRng(12345);
    const rngT = createSeededRng(999);

    const exactPlannedScopes = demoExactPlannedScopeIds(specs.map((s) => s.scopeId));

    const forecast = generateProgrammeForecastRows({
      projectId: PROGRAMME_DEMO_PROJECT_ID,
      planEndIso: DEMO_FORECAST_PLAN_END_ISO,
      scopes: specs.map((s) =>
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
          exactPlannedScopes
        )
      ),
      rng: rngF,
    });

    const { rows, stats, alignedForecastSlotKeys } = generateTimesheetRowsFromForecast({
      forecastRows: forecast,
      projectLabel: PROGRAMME_DEMO_PROJECT_LABEL,
      activityIdsByScopeId,
      rng: rngT,
    });

    expect(specs.length).toBe(9);
    expect(forecast.length).toBeGreaterThan(0);
    expect(stats.forecastSlotsWithHours).toBeGreaterThan(0);
    expect(stats.alignedSlotCount / stats.forecastSlotsWithHours).toBeGreaterThanOrEqual(0.85);

    const byKey = new Map(
      forecast
        .filter((r) => r.hours > 0)
        .map((r) => [`${r.scopeId}|${r.engineerCode}|${r.date}`, r])
    );

    for (const key of alignedForecastSlotKeys) {
      const f = byKey.get(key);
      expect(f).toBeDefined();
      const match = rows.some((row) => timesheetRowMatchesAlignedForecast(f!, row));
      expect(match).toBe(true);
    }

    for (const r of rows) {
      expect(r.hours).toBeLessThanOrEqual(8);
      expect(Number.isInteger(r.hours)).toBe(true);
    }
  });

  it("applies timesheetForecastRetentionByScopeId so timesheet totals fall short of forecast (incomplete)", () => {
    const specs = defaultSeedScopeForecastSpecs(SEED_SCOPE_ENGINEER_FALLBACK);
    const activityIdsByScopeId = new Map(specs.map((s) => [s.scopeId, s.activityIds]));
    const rngF = createSeededRng(12_345);
    const rngT = createSeededRng(99_999);
    const exactPlannedScopes = demoExactPlannedScopeIds(specs.map((s) => s.scopeId));

    const forecast = generateProgrammeForecastRows({
      projectId: PROGRAMME_DEMO_PROJECT_ID,
      planEndIso: DEMO_FORECAST_PLAN_END_ISO,
      scopes: specs.map((s) =>
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
          exactPlannedScopes
        )
      ),
      rng: rngF,
    });

    const retention = new Map<string, number>([["s13", 0.74]]);

    const { rows } = generateTimesheetRowsFromForecast({
      forecastRows: forecast,
      projectLabel: PROGRAMME_DEMO_PROJECT_LABEL,
      activityIdsByScopeId,
      rng: rngT,
      timesheetForecastRetentionByScopeId: retention,
    });

    const fcS13 = forecast.filter((r) => r.scopeId === "s13").reduce((s, r) => s + r.hours, 0);
    const tsS13 = rows.filter((r) => r.scopeId === "s13").reduce((s, r) => s + r.hours, 0);
    expect(fcS13).toBeGreaterThan(100);
    expect(tsS13).toBeLessThan(fcS13 * 0.85);
  });
});
