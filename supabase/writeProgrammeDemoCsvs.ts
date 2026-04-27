/**
 * Writes reproducible programme-wide demo CSVs (all seed scopes) under `supabase/seed/csv/`.
 * Run: `npm run seed:programme-csv`
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createSeededRng } from "../src/lib/seed/seedDeterministicRandom";
import {
  DEMO_FORECAST_VARIANCE_FACTOR_MAX,
  DEMO_FORECAST_VARIANCE_FACTOR_MIN,
  demoExactPlannedScopeIds,
  generateProgrammeForecastRows,
  generateTimesheetRowsFromForecast,
} from "../src/lib/seed/generate";
import {
  PROGRAMME_DEMO_PROJECT_CODE,
  PROGRAMME_DEMO_PROJECT_ID,
  PROGRAMME_DEMO_PROJECT_LABEL,
  SEED_SCOPE_ENGINEER_FALLBACK,
} from "../src/lib/seed/programmeSeedDemo";
import {
  DEMO_FORECAST_ABOVE_PLANNED_VARIANCE,
  DEMO_FORECAST_PLAN_END_ISO,
  DEMO_TIMESHEET_FORECAST_RETENTION,
  defaultSeedScopeForecastSpecs,
  isProgrammeDemoForecastExactScope,
  programmeDemoForecastScopePayload,
  programmeScopeNameForTimesheetDisplay,
  type SeedScopeForecastSpec,
} from "../src/lib/seed/seedProgrammeScopeMetadata";
import { deriveEngineerCodeBase } from "../src/lib/engineers/engineerCode";
import { SEED_ENGINEER_ROWS } from "../src/lib/programme/seedConfig";
import { sumAllocationPlannedHrs } from "../src/lib/seed/scopeEngineerPlannedDistribution";
import { toCsvContent } from "../src/lib/seed/seedCsv";

const __dirname = dirname(fileURLToPath(import.meta.url));

function engineerDisplayName(firstName: string, lastName: string): string {
  return `${lastName} ${firstName[0]}.`;
}

const CODE_TO_EMPLOYEE = new Map(
  SEED_ENGINEER_ROWS.map((r) => [
    deriveEngineerCodeBase(r.firstName, r.lastName),
    engineerDisplayName(r.firstName, r.lastName),
  ])
);
const ROOT = resolve(__dirname, "..");
const OUT_DIR = join(ROOT, "supabase", "seed", "csv");
const DEMO_SEED = 42;

function activityIdsMap(specs: readonly SeedScopeForecastSpec[]): Map<string, readonly string[]> {
  const m = new Map<string, readonly string[]>();
  for (const s of specs) {
    m.set(s.scopeId, s.activityIds);
  }
  return m;
}

function scopeEngineersCsv(specs: readonly SeedScopeForecastSpec[]): string {
  const headers = [
    "scope_id",
    "engineer_code",
    "is_lead",
    "planned_hrs",
    "position",
    "rate",
    "weekly_limit_hrs",
  ];
  const rows: string[][] = [];
  for (const spec of specs) {
    spec.allocations.forEach((a, position) => {
      rows.push([
        spec.scopeId,
        a.code,
        a.isLead ? "true" : "false",
        a.plannedHrs != null ? String(a.plannedHrs) : "",
        String(position),
        "A",
        "",
      ]);
    });
  }
  return toCsvContent(headers, rows);
}

function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const specs = defaultSeedScopeForecastSpecs(SEED_SCOPE_ENGINEER_FALLBACK);

  const rngForecast = createSeededRng(DEMO_SEED);
  const rngTimesheet = createSeededRng(DEMO_SEED + 97);

  const exactPlannedScopes = demoExactPlannedScopeIds(specs.map((s) => s.scopeId));

  const forecastRows = generateProgrammeForecastRows({
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
    rng: rngForecast,
  });

  const timesheetForecastRetentionByScopeId = new Map(
    Object.entries(DEMO_TIMESHEET_FORECAST_RETENTION)
  );

  const scopeDisplayNameByScopeId = new Map(
    specs.map((s) => [s.scopeId, programmeScopeNameForTimesheetDisplay(s.name)])
  );

  const { rows: timesheetRows, stats } = generateTimesheetRowsFromForecast({
    forecastRows,
    projectLabel: PROGRAMME_DEMO_PROJECT_LABEL,
    scopeDisplayNameByScopeId,
    activityIdsByScopeId: activityIdsMap(specs),
    rng: rngTimesheet,
    timesheetForecastRetentionByScopeId,
  });

  const forecastCsv = toCsvContent(
    ["project_id", "scope_id", "engineer_code", "date", "hours"],
    forecastRows.map((r) => [r.projectId, r.scopeId, r.engineerCode, r.date, String(r.hours)])
  );

  const timesheetCsv = toCsvContent(
    ["Date", "Employee", "Hours", "Task ID", "Project", "Notes"],
    timesheetRows.map((r) => [
      r.date.split("-").reverse().join("/"),
      CODE_TO_EMPLOYEE.get(r.code) ?? r.code,
      String(r.hours),
      r.taskId,
      PROGRAMME_DEMO_PROJECT_CODE,
      r.description,
    ])
  );

  writeFileSync(join(OUT_DIR, "forecast_programme_demo.csv"), forecastCsv, "utf8");
  writeFileSync(join(OUT_DIR, "timesheet_programme_demo.csv"), timesheetCsv, "utf8");
  writeFileSync(
    join(OUT_DIR, "scope_engineers_programme_demo.csv"),
    scopeEngineersCsv(specs),
    "utf8"
  );

  console.log(`Scopes: ${specs.length} (${specs.map((s) => s.scopeId).join(", ")})`);
  const exactEffective = specs
    .filter((s) => isProgrammeDemoForecastExactScope(s.scopeId, exactPlannedScopes))
    .map((s) => s.scopeId)
    .sort();
  const varianceOnly = specs
    .filter(
      (s) =>
        !isProgrammeDemoForecastExactScope(s.scopeId, exactPlannedScopes) &&
        !DEMO_FORECAST_ABOVE_PLANNED_VARIANCE[s.scopeId]
    )
    .map((s) => s.scopeId)
    .sort();
  console.log(
    `Forecast: exact=planned ${exactEffective.join(", ")}; above roster planned ${Object.entries(
      DEMO_FORECAST_ABOVE_PLANNED_VARIANCE
    )
      .map(([id, v]) => `${id} ${v.min}–${v.max}×`)
      .join(
        ", "
      )}; other variance ${varianceOnly.join(", ") || "(none)"} use ${DEMO_FORECAST_VARIANCE_FACTOR_MIN}–${DEMO_FORECAST_VARIANCE_FACTOR_MAX}×; ≤8h/day/engineer/scope; through ${DEMO_FORECAST_PLAN_END_ISO}`
  );
  console.log(`Wrote ${forecastRows.length} forecast rows → forecast_programme_demo.csv`);
  console.log(
    `Wrote ${timesheetRows.length} timesheet rows (aligned ${stats.alignedSlotCount}/${stats.forecastSlotsWithHours} forecast slots, ${stats.divergentSkipped} divergent skips) → timesheet_programme_demo.csv`
  );
  const engRows = specs.reduce((n, s) => n + s.allocations.length, 0);
  console.log(`Wrote scope_engineers_programme_demo.csv (${engRows} rows)`);
  const under = specs.filter((s) => s.isUnderAllocated);
  for (const s of under) {
    const sum = sumAllocationPlannedHrs(s.allocations);
    console.log(
      `  Under-allocated ${s.scopeId}: planned_hrs sum ${sum} / totalHours ${s.totalHours} (${Math.round((100 * sum) / s.totalHours)}%)`
    );
  }
  const over = specs.filter((s) => s.isOverAllocated);
  for (const s of over) {
    const sum = sumAllocationPlannedHrs(s.allocations);
    console.log(
      `  Over-allocated ${s.scopeId}: planned_hrs sum ${sum} / totalHours ${s.totalHours} (+${sum - s.totalHours} vs WBS)`
    );
  }
  for (const [sid, frac] of timesheetForecastRetentionByScopeId) {
    console.log(
      `  Timesheet vs forecast (incomplete): ${sid} books ~${Math.round(frac * 100)}% of forecast slot hours`
    );
  }
  console.log(`Output: ${OUT_DIR}`);
}

main();
