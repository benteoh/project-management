/**
 * Writes 617 forecast, scope-engineer, and timesheet CSVs from the real forecast sheet
 * (Iver & Egham.xlsx - Sheet2.csv). Per-engineer daily hours are scope-attributed using
 * earliest-ending active scope rule. Run: `npm run seed:617-csv`
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createSeededRng } from "../src/lib/seed/seedDeterministicRandom";
import {
  generateTimesheetRowsFromForecast,
  type ProgrammeForecastRow,
} from "../src/lib/seed/generate";
import {
  iverEghamProjectRow,
  iverEghamSeedData,
  IVER_EGHAM_PROJECT_ID,
} from "../src/lib/seed/iverEghamSeed";
import {
  collectSeedScopeForecastSpecs,
  programmeScopeNameForTimesheetDisplay,
} from "../src/lib/seed/seedProgrammeScopeMetadata";
import { parseSeedDisplayDate } from "../src/lib/seed/parseSeedDisplayDate";
import { toCsvContent } from "../src/lib/seed/seedCsv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const CSV_IN = join(ROOT, "supabase", "seed", "csv", "Iver & Egham.xlsx - Sheet2.csv");
const OUT_DIR = join(ROOT, "supabase", "seed", "csv");
const TIMESHEET_SEED = 43;

const NAME_TO_CODE: Record<string, string> = {
  "Brian Lyons": "BLy",
  "Andreas Feiersinger": "AFe",
  "Justyna Wroblicka": "JWr",
  "Kenneth Law": "KLa",
  "Sebastian Kumpfmueller": "SKu",
  "Laurence Chaplin": "LCh",
  "Alex Petit": "APe",
};

const MONTH_ABBR: Record<string, string> = {
  Jan: "01",
  Feb: "02",
  Mar: "03",
  Apr: "04",
  May: "05",
  Jun: "06",
  Jul: "07",
  Aug: "08",
  Sep: "09",
  Oct: "10",
  Nov: "11",
  Dec: "12",
};

function parseMonthLabel(label: string): { month: string; year: string } | null {
  const m = label.match(/^([A-Za-z]+)-(\d{2})$/);
  if (!m) return null;
  const month = MONTH_ABBR[m[1]!];
  if (!month) return null;
  const year = `20${m[2]}`;
  return { month, year };
}

function buildDateMap(monthRow: string[], dayRow: string[]): Map<number, string> {
  const map = new Map<number, string>();
  let current: { month: string; year: string } | null = null;
  for (let i = 3; i < dayRow.length; i++) {
    const monthCell = monthRow[i]?.trim() ?? "";
    if (monthCell) {
      const parsed = parseMonthLabel(monthCell);
      if (parsed) current = parsed;
    }
    const day = dayRow[i]?.trim();
    if (!day || !current) continue;
    map.set(i, `${current.year}-${current.month}-${day.padStart(2, "0")}`);
  }
  return map;
}

type ScopeRange = { scopeId: string; start: string; end: string };

function buildEngineerScopeRanges(): Map<string, ScopeRange[]> {
  const m = new Map<string, ScopeRange[]>();
  for (const node of iverEghamSeedData) {
    if (node.type !== "scope" || !node.engineers || !node.start || !node.finish) continue;
    const start = parseSeedDisplayDate(node.start);
    const end = parseSeedDisplayDate(node.finish);
    for (const eng of node.engineers) {
      const list = m.get(eng.code) ?? [];
      list.push({ scopeId: node.id, start, end });
      m.set(eng.code, list);
    }
  }
  for (const [, ranges] of m) {
    ranges.sort((a, b) => a.end.localeCompare(b.end));
  }
  return m;
}

function assignScope(
  code: string,
  date: string,
  scopeRanges: Map<string, ScopeRange[]>
): string | null {
  for (const r of scopeRanges.get(code) ?? []) {
    if (date >= r.start && date <= r.end) return r.scopeId;
  }
  return null;
}

function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const raw = readFileSync(CSV_IN, "utf8").replace(/^﻿/, "");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim() !== "");

  const monthRow = lines[0]!.split(",");
  const dayRow = lines[1]!.split(",");
  // lines[2] = day-of-week row — used only for verification, not parsing

  const dateMap = buildDateMap(monthRow, dayRow);
  const scopeRanges = buildEngineerScopeRanges();

  const forecastRows: ProgrammeForecastRow[] = [];
  let skippedCount = 0;

  for (let li = 3; li < lines.length; li++) {
    const cols = lines[li]!.split(",");
    const name = cols[2]?.trim() ?? "";
    const code = NAME_TO_CODE[name];
    if (!code) continue;

    for (const [colIdx, date] of dateMap) {
      const cell = cols[colIdx]?.trim() ?? "";
      if (!cell) continue;
      const hours = Number(cell);
      if (!Number.isFinite(hours) || hours <= 0) continue;

      const scopeId = assignScope(code, date, scopeRanges);
      if (!scopeId) {
        skippedCount++;
        continue;
      }

      forecastRows.push({
        projectId: IVER_EGHAM_PROJECT_ID,
        scopeId,
        engineerCode: code,
        date,
        hours,
      });
    }
  }

  // Scope-engineer planned_hrs = sum of forecast hours per (scope, engineer)
  const scopeEngHrs = new Map<string, number>();
  for (const r of forecastRows) {
    const key = `${r.scopeId}|${r.engineerCode}`;
    scopeEngHrs.set(key, (scopeEngHrs.get(key) ?? 0) + r.hours);
  }

  const seRows: string[][] = [];
  for (const node of iverEghamSeedData) {
    if (node.type !== "scope" || !node.engineers) continue;
    node.engineers.forEach((eng, position) => {
      const planned = scopeEngHrs.get(`${node.id}|${eng.code}`);
      if (!planned) return;
      seRows.push([
        node.id,
        eng.code,
        eng.isLead ? "true" : "false",
        String(Math.round(planned)),
        String(position),
        "A",
        "",
      ]);
    });
  }

  // Timesheet — generate from forecast rows with realistic variation
  const specs = collectSeedScopeForecastSpecs(iverEghamSeedData, {
    fallbackAllocations: [],
    underAllocatedScopeIds: new Set(),
    overAllocatedScopeIds: new Set(),
  });
  const activityIdsByScopeId = new Map(specs.map((s) => [s.scopeId, s.activityIds]));
  const scopeDisplayNameByScopeId = new Map(
    specs.map((s) => [s.scopeId, programmeScopeNameForTimesheetDisplay(s.name)])
  );

  const { rows: timesheetRows, stats } = generateTimesheetRowsFromForecast({
    forecastRows,
    projectLabel: `${iverEghamProjectRow.project_code} — ${iverEghamProjectRow.name}`,
    scopeDisplayNameByScopeId,
    activityIdsByScopeId,
    rng: createSeededRng(TIMESHEET_SEED),
  });

  writeFileSync(
    join(OUT_DIR, "forecast_617.csv"),
    toCsvContent(
      ["project_id", "scope_id", "engineer_code", "date", "hours"],
      forecastRows.map((r) => [r.projectId, r.scopeId, r.engineerCode, r.date, String(r.hours)])
    ),
    "utf8"
  );
  writeFileSync(
    join(OUT_DIR, "scope_engineers_617.csv"),
    toCsvContent(
      [
        "scope_id",
        "engineer_code",
        "is_lead",
        "planned_hrs",
        "position",
        "rate",
        "weekly_limit_hrs",
      ],
      seRows
    ),
    "utf8"
  );
  writeFileSync(
    join(OUT_DIR, "timesheet_617.csv"),
    toCsvContent(
      ["Date", "Code", "Hours", "Task ID", "Project", "Description"],
      timesheetRows.map((r) => [
        r.date.split("-").reverse().join("/"),
        r.code,
        String(r.hours),
        r.taskId,
        iverEghamProjectRow.project_code ?? "",
        r.description,
      ])
    ),
    "utf8"
  );

  // Summary
  const byEng = new Map<string, number>();
  const byScope = new Map<string, number>();
  for (const r of forecastRows) {
    byEng.set(r.engineerCode, (byEng.get(r.engineerCode) ?? 0) + r.hours);
    byScope.set(r.scopeId, (byScope.get(r.scopeId) ?? 0) + r.hours);
  }
  console.log(
    `\nForecast entries: ${forecastRows.length} (${skippedCount} skipped — no active scope)`
  );
  console.log("\nBy engineer:");
  for (const [code, hrs] of [...byEng].sort((a, b) => a[0].localeCompare(b[0])))
    console.log(`  ${code}: ${hrs}h`);
  console.log("\nBy scope:");
  for (const [sid, hrs] of [...byScope].sort((a, b) => a[0].localeCompare(b[0])))
    console.log(`  ${sid}: ${hrs}h`);
  console.log("\nScope-engineer rows:");
  for (const r of seRows) console.log(`  ${r[0]} ${r[1]}: ${r[3]}h (lead=${r[2]})`);
  console.log(
    `\nTimesheet: ${timesheetRows.length} rows (aligned ${stats.alignedSlotCount}/${stats.forecastSlotsWithHours})`
  );
  console.log(`\nOutput: ${OUT_DIR}`);
}

main();
