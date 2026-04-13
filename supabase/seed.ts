/**
 * Seeds Supabase with programme nodes, engineer pool, and programme demo CSVs (forecast, scope engineers, timesheet) for project 1. Project 2 is programme tree + scope engineers only; timesheets are cleared on re-seed.
 * Requires CSVs under `supabase/seed/csv/` — run `npm run seed:programme-csv` if missing.
 * npm run seed  (loads `.env`, then `.env.local` overrides — same idea as Next.js)
 */
import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

import { clampCapacityDay, clampCapacityWeek } from "../src/lib/engineers/engineerCapacity";
import { deriveEngineerCodeBase } from "../src/lib/engineers/engineerCode";
import { collectScopeIds, flattenTree } from "../src/lib/programme/programmeTree";
import {
  buildProgrammeNodesFromSeed,
  SEED_ENGINEER_ROWS,
  SEED_LONDON_OFFICE_ID,
  SEED_OFFICES,
  SEED_PROJECT_ENGINEER_RATE_ROWS,
  SEED_PROJECT_ID,
  SEED_PROJECT_TEST_ID,
  SEED_PROJECT_TEST_NODE_ID_PREFIX,
  seedProjectRow,
  seedProjectTestRow,
} from "../src/lib/programme/seedConfig";
import { programmeNodesWithPrefixedIds } from "../src/lib/programme/seedProgrammeClone";
import { resolveSupabaseEnvConfig } from "../src/lib/supabase/resolve-config";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "..", ".env"), quiet: true });
config({ path: resolve(__dirname, "..", ".env.local"), quiet: true, override: true });

const { url, anonKey } = resolveSupabaseEnvConfig();
const supabase = createClient(url, anonKey);

const FORECAST_DEMO_CSV = join(__dirname, "seed", "csv", "forecast_programme_demo.csv");
const SCOPE_ENGINEERS_DEMO_CSV = join(
  __dirname,
  "seed",
  "csv",
  "scope_engineers_programme_demo.csv"
);
const TIMESHEET_DEMO_CSV = join(__dirname, "seed", "csv", "timesheet_programme_demo.csv");
/** Synthetic upload name for {@link TIMESHEET_DEMO_CSV} on the primary seed project. */
const TIMESHEET_DEMO_FILE_NAME = "Programme_demo_timesheet.csv";

const DEMO_CSV_HINT =
  "Run npm run seed:programme-csv to generate demo CSVs, then npm run seed again.";

type ForecastSeedRow = {
  project_id: string;
  scope_id: string;
  engineer_id: string;
  date: string;
  hours: number;
};

function parseForecastProgrammeDemoCsv(
  csvPath: string,
  codeToId: Map<string, string>
): ForecastSeedRow[] {
  if (!existsSync(csvPath)) {
    throw new Error(`Missing ${csvPath}. ${DEMO_CSV_HINT}`);
  }
  const raw = readFileSync(csvPath, "utf8").replace(/^\uFEFF/, "");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) {
    throw new Error(`Forecast demo CSV has no data rows: ${csvPath}`);
  }
  const header = lines[0]!.split(",");
  if (
    header[0] !== "project_id" ||
    header[1] !== "scope_id" ||
    header[2] !== "engineer_code" ||
    header[3] !== "date" ||
    header[4] !== "hours"
  ) {
    throw new Error(`Forecast demo CSV unexpected header (got: ${lines[0]})`);
  }

  const out: ForecastSeedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i]!.split(",");
    if (cols.length < 5) {
      throw new Error(`Forecast demo CSV line ${i + 1}: expected 5 columns`);
    }
    const projectId = cols[0]!.trim();
    const scopeId = cols[1]!.trim();
    const code = cols[2]!.trim();
    const date = cols[3]!.trim();
    const hours = Number(cols[4]!.trim());
    if (projectId !== SEED_PROJECT_ID) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error(`Forecast demo CSV line ${i + 1}: invalid date ${date}`);
    }
    if (!Number.isFinite(hours) || hours <= 0) continue;
    const engineerId = codeToId.get(code);
    if (!engineerId) {
      throw new Error(`Forecast demo CSV line ${i + 1}: unknown engineer code ${code}`);
    }
    out.push({
      project_id: projectId,
      scope_id: scopeId,
      engineer_id: engineerId,
      date,
      hours: Math.round(hours),
    });
  }
  return out;
}

type TimesheetSeedEntryRow = {
  engineerId: string | null;
  entryDate: string | null;
  hours: number | null;
  scopeId: string | null;
  activityId: string | null;
  notes: string | null;
  rawData: Record<string, string>;
};

function parseDdMmYyyyToIso(dateStr: string, lineNo: number): string {
  const s = dateStr.trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) {
    throw new Error(`Timesheet demo CSV line ${lineNo}: invalid date "${dateStr}"`);
  }
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  if (!Number.isFinite(dd) || !Number.isFinite(mm) || !Number.isFinite(yyyy)) {
    throw new Error(`Timesheet demo CSV line ${lineNo}: invalid date "${dateStr}"`);
  }
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) {
    throw new Error(`Timesheet demo CSV line ${lineNo}: date out of range "${dateStr}"`);
  }
  return `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

function activityIdFromTimesheetDescription(description: string): string | null {
  const m = description.trim().match(/^([A-Z]\d+):\s*/);
  return m ? m[1]! : null;
}

type ScopeEngineerSeedInsert = {
  scope_id: string;
  engineer_id: string;
  is_lead: boolean;
  planned_hrs: number | null;
  weekly_limit_hrs: number | null;
  position: number;
  rate: string;
};

function parseScopeEngineersProgrammeDemoCsv(
  csvPath: string,
  codeToId: Map<string, string>
): ScopeEngineerSeedInsert[] {
  if (!existsSync(csvPath)) {
    throw new Error(`Missing ${csvPath}. ${DEMO_CSV_HINT}`);
  }
  const raw = readFileSync(csvPath, "utf8").replace(/^\uFEFF/, "");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) {
    throw new Error(`Scope engineers demo CSV has no data rows: ${csvPath}`);
  }
  const header = lines[0]!.split(",").map((c) => c.trim());
  const expected = [
    "scope_id",
    "engineer_code",
    "is_lead",
    "planned_hrs",
    "position",
    "rate",
    "weekly_limit_hrs",
  ];
  if (header.length !== expected.length || !expected.every((h, i) => header[i] === h)) {
    throw new Error(`Scope engineers demo CSV unexpected header (got: ${lines[0]})`);
  }

  const out: ScopeEngineerSeedInsert[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i]!.split(",").map((c) => c.trim());
    if (cols.length < 7) {
      throw new Error(`Scope engineers demo CSV line ${i + 1}: expected 7 columns`);
    }
    const scopeId = cols[0]!;
    const code = cols[1]!;
    const isLead = cols[2]!.toLowerCase() === "true";
    const planned = Number(cols[3]!);
    const position = Number(cols[4]!);
    const rate = cols[5]! || "A";
    const weeklyRaw = cols[6]!.trim();
    const weeklyLimit = weeklyRaw === "" ? null : Number(weeklyRaw);

    if (!Number.isFinite(planned) || planned < 0) {
      throw new Error(`Scope engineers demo CSV line ${i + 1}: invalid planned_hrs`);
    }
    if (!Number.isFinite(position) || position < 0) {
      throw new Error(`Scope engineers demo CSV line ${i + 1}: invalid position`);
    }
    if (weeklyLimit !== null && (!Number.isFinite(weeklyLimit) || weeklyLimit < 0)) {
      throw new Error(`Scope engineers demo CSV line ${i + 1}: invalid weekly_limit_hrs`);
    }
    const engineerId = codeToId.get(code);
    if (!engineerId) {
      throw new Error(`Scope engineers demo CSV line ${i + 1}: unknown engineer code ${code}`);
    }
    out.push({
      scope_id: scopeId,
      engineer_id: engineerId,
      is_lead: isLead,
      planned_hrs: planned,
      weekly_limit_hrs: weeklyLimit,
      position,
      rate,
    });
  }
  return out;
}

function parseTimesheetProgrammeDemoCsv(
  csvPath: string,
  codeToId: Map<string, string>,
  expectedProjectCode: string
): TimesheetSeedEntryRow[] {
  if (!existsSync(csvPath)) {
    throw new Error(`Missing ${csvPath}. ${DEMO_CSV_HINT}`);
  }
  const raw = readFileSync(csvPath, "utf8").replace(/^\uFEFF/, "");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) {
    throw new Error(`Timesheet demo CSV has no data rows: ${csvPath}`);
  }
  const header = lines[0]!.split(",").map((c) => c.trim());
  const expected = ["Date", "Code", "Hours", "Task ID", "Project", "Description"];
  if (header.length !== expected.length || !expected.every((h, i) => header[i] === h)) {
    throw new Error(`Timesheet demo CSV unexpected header (got: ${lines[0]})`);
  }

  const out: TimesheetSeedEntryRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i]!.split(",").map((c) => c.trim());
    if (cols.length < 6) {
      throw new Error(`Timesheet demo CSV line ${i + 1}: expected at least 6 columns`);
    }
    const dateRaw = cols[0]!;
    const code = cols[1]!;
    const hoursN = Number(cols[2]!);
    const scopeId = cols[3]!;
    const projectCol = cols[4]!;
    const description = cols.slice(5).join(",");

    if (projectCol !== expectedProjectCode) {
      throw new Error(
        `Timesheet demo CSV line ${i + 1}: project ${projectCol} (expected ${expectedProjectCode})`
      );
    }
    if (!Number.isFinite(hoursN) || hoursN <= 0) {
      throw new Error(`Timesheet demo CSV line ${i + 1}: invalid hours`);
    }

    const entryDate = parseDdMmYyyyToIso(dateRaw, i + 1);
    const engineerId = codeToId.get(code) ?? null;
    if (!engineerId) {
      throw new Error(`Timesheet demo CSV line ${i + 1}: unknown engineer code ${code}`);
    }

    const activityId = activityIdFromTimesheetDescription(description);
    const rawData: Record<string, string> = {
      Date: dateRaw,
      Code: code,
      Hours: String(hoursN),
      "Task ID": scopeId,
      Project: projectCol,
      Description: description,
    };

    out.push({
      engineerId,
      entryDate,
      hours: hoursN,
      scopeId,
      activityId,
      notes: description,
      rawData,
    });
  }
  return out;
}

async function insertTimesheetUpload(
  projectId: string,
  fileName: string,
  rows: TimesheetSeedEntryRow[]
): Promise<void> {
  await supabase
    .from("timesheet_uploads")
    .delete()
    .eq("project_id", projectId)
    .eq("file_name", fileName);

  const { data: uploadData, error: uploadErr } = await supabase
    .from("timesheet_uploads")
    .insert({
      project_id: projectId,
      file_name: fileName,
      row_count: rows.length,
    })
    .select()
    .single();
  if (uploadErr) throw new Error(`timesheet_uploads: ${uploadErr.message}`);
  const uploadId = (uploadData as { id: string }).id;

  const entryRows = rows.map((e, i) => ({
    upload_id: uploadId,
    project_id: projectId,
    row_index: i,
    engineer_id: e.engineerId,
    entry_date: e.entryDate,
    hours: e.hours,
    scope_id: e.scopeId,
    activity_id: e.activityId,
    notes: e.notes,
    raw_data: e.rawData,
  }));

  const { error: entryErr } = await supabase.from("timesheet_entries").insert(entryRows);
  if (entryErr) throw new Error(`timesheet_entries: ${entryErr.message}`);
  console.log(`\u2713 ${entryRows.length} timesheet entries (${fileName})`);
}

async function seed() {
  console.log("Seeding Supabase...");

  const { error: officeErr } = await supabase.from("offices").upsert([...SEED_OFFICES], {
    onConflict: "id",
  });
  if (officeErr) throw new Error(`offices: ${officeErr.message}`);
  console.log(`\u2713 ${SEED_OFFICES.length} offices`);

  const { error: projectErr } = await supabase
    .from("projects")
    .upsert([seedProjectRow, seedProjectTestRow], { onConflict: "id" });
  if (projectErr) throw new Error(`projects: ${projectErr.message}`);
  console.log("\u2713 projects (Euston + Euston Test)");

  const { data: existingPool, error: existingPoolErr } = await supabase
    .from("engineer_pool")
    .select("id, code");
  if (existingPoolErr) throw new Error(`engineer_pool select: ${existingPoolErr.message}`);
  const codeToExistingId = new Map(
    (existingPool ?? []).map((r: { id: string; code: string }) => [r.code, r.id])
  );

  const poolUpsertRows = SEED_ENGINEER_ROWS.map((row) => {
    const code = deriveEngineerCodeBase(row.firstName, row.lastName);
    const id = codeToExistingId.get(code) ?? randomUUID();
    const w = clampCapacityWeek(row.maxWeeklyHours);
    const d = clampCapacityDay(row.maxDailyHours);
    return {
      id,
      code,
      first_name: row.firstName,
      last_name: row.lastName,
      is_active: true,
      max_daily_hours: d,
      max_weekly_hours: w,
      office_id: SEED_LONDON_OFFICE_ID,
    };
  });

  const { error: poolErr } = await supabase
    .from("engineer_pool")
    .upsert(poolUpsertRows, { onConflict: "code" });
  if (poolErr) throw new Error(`engineer_pool: ${poolErr.message}`);
  console.log(`✓ ${SEED_ENGINEER_ROWS.length} engineers`);

  const codeToId = new Map(poolUpsertRows.map((r) => [r.code, r.id]));
  const programmeNodes = buildProgrammeNodesFromSeed(codeToId);
  const programmeNodesTest = programmeNodesWithPrefixedIds(
    programmeNodes,
    SEED_PROJECT_TEST_NODE_ID_PREFIX
  );

  const primary = flattenTree(programmeNodes, SEED_PROJECT_ID);
  const test = flattenTree(programmeNodesTest, SEED_PROJECT_TEST_ID);
  const nodeRows = [...primary.nodeRows, ...test.nodeRows];

  const { error: nodesErr } = await supabase
    .from("programme_nodes")
    .upsert(nodeRows, { onConflict: "id" });
  if (nodesErr) throw new Error(`programme_nodes: ${nodesErr.message}`);
  console.log(`\u2713 ${nodeRows.length} programme nodes (2 projects)`);

  const project1ScopeIds = collectScopeIds(programmeNodes);
  if (project1ScopeIds.length > 0) {
    const { error: delSeErr } = await supabase
      .from("scope_engineers")
      .delete()
      .in("scope_id", project1ScopeIds);
    if (delSeErr) throw new Error(`scope_engineers delete (project 1): ${delSeErr.message}`);
  }

  const demoScopeEng = parseScopeEngineersProgrammeDemoCsv(SCOPE_ENGINEERS_DEMO_CSV, codeToId);
  if (demoScopeEng.length > 0) {
    const { error: seErr } = await supabase
      .from("scope_engineers")
      .upsert(demoScopeEng, { onConflict: "scope_id,engineer_id" });
    if (seErr) throw new Error(`scope_engineers: ${seErr.message}`);
  }
  console.log(
    `\u2713 ${demoScopeEng.length} scope-engineer rows (project ${SEED_PROJECT_ID}, demo CSV)`
  );

  if (test.engineerRows.length > 0) {
    const { error: engErr } = await supabase
      .from("scope_engineers")
      .upsert(test.engineerRows, { onConflict: "scope_id,engineer_id" });
    if (engErr) throw new Error(`scope_engineers (test project): ${engErr.message}`);
    console.log(`\u2713 ${test.engineerRows.length} scope-engineer rows (test project)`);
  }

  const projectEngineerRows = [SEED_PROJECT_ID, SEED_PROJECT_TEST_ID].flatMap((projectId) =>
    SEED_PROJECT_ENGINEER_RATE_ROWS.map((r) => {
      const engineerId = codeToId.get(r.code);
      if (!engineerId) {
        throw new Error(`project_engineers: no engineer_pool id for code ${r.code}`);
      }
      return {
        project_id: projectId,
        engineer_id: engineerId,
        rate_a: r.rateA,
        rate_b: r.rateB,
        rate_c: null as number | null,
        rate_d: null as number | null,
        rate_e: null as number | null,
      };
    })
  );

  const { error: peErr } = await supabase
    .from("project_engineers")
    .upsert(projectEngineerRows, { onConflict: "project_id,engineer_id" });
  if (peErr) throw new Error(`project_engineers: ${peErr.message}`);
  console.log(`✓ ${projectEngineerRows.length} project-engineer rate rows`);

  const forecastRows = parseForecastProgrammeDemoCsv(FORECAST_DEMO_CSV, codeToId);
  const { error: delForecastErr } = await supabase
    .from("forecast_entries")
    .delete()
    .eq("project_id", SEED_PROJECT_ID);
  if (delForecastErr) throw new Error(`forecast_entries delete: ${delForecastErr.message}`);
  if (forecastRows.length > 0) {
    const { error: fcErr } = await supabase.from("forecast_entries").insert(forecastRows);
    if (fcErr) throw new Error(`forecast_entries: ${fcErr.message}`);
  }
  console.log(
    `\u2713 ${forecastRows.length} forecast entries (project ${SEED_PROJECT_ID}, demo CSV)`
  );

  // ---- Timesheet (programme demo CSV, project 1 only) -------------------
  for (const pid of [SEED_PROJECT_ID, SEED_PROJECT_TEST_ID] as const) {
    const { error: delUpErr } = await supabase
      .from("timesheet_uploads")
      .delete()
      .eq("project_id", pid);
    if (delUpErr) throw new Error(`timesheet_uploads delete (${pid}): ${delUpErr.message}`);
  }

  const demoTimesheetRows = parseTimesheetProgrammeDemoCsv(
    TIMESHEET_DEMO_CSV,
    codeToId,
    seedProjectRow.project_code ?? ""
  );
  await insertTimesheetUpload(SEED_PROJECT_ID, TIMESHEET_DEMO_FILE_NAME, demoTimesheetRows);

  console.log("Done.");
}

seed().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
