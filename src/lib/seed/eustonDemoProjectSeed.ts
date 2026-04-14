import "server-only";

import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { SupabaseClient } from "@supabase/supabase-js";

import { flattenTree } from "@/lib/programme/programmeTree";
import {
  buildProgrammeNodesFromSeed,
  SEED_LONDON_OFFICE_ID,
  SEED_PROJECT_ENGINEER_RATE_ROWS,
  SEED_PROJECT_ID,
  seedProjectRow,
} from "@/lib/programme/seedConfig";
import { programmeNodesWithPrefixedIds } from "@/lib/programme/seedProgrammeClone";
import { applySeedScopeQuotations } from "@/lib/programme/seedScopeQuotations";
import { SEED_SCOPE_ENGINEER_FALLBACK } from "@/lib/seed/programmeSeedDemo";
import {
  defaultSeedScopeForecastSpecs,
  programmeDemoTimesheetTaskCellToScopeId,
} from "@/lib/seed/seedProgrammeScopeMetadata";
import { officeNameToUrlPathSegment } from "@/lib/offices/officeUrl";
import { parseCsvDataLine } from "@/lib/seed/seedCsv";

const DEMO_CSV_DIR = join(process.cwd(), "supabase", "seed", "csv");
const FORECAST_CSV = join(DEMO_CSV_DIR, "forecast_programme_demo.csv");
const SCOPE_ENGINEERS_CSV = join(DEMO_CSV_DIR, "scope_engineers_programme_demo.csv");
const TIMESHEET_CSV = join(DEMO_CSV_DIR, "timesheet_programme_demo.csv");
const TIMESHEET_DEMO_FILE_NAME = "Programme_demo_timesheet.csv";

const SOURCE_FORECAST_PROJECT_ID = SEED_PROJECT_ID;

type TimesheetSeedEntryRow = {
  engineerId: string | null;
  entryDate: string | null;
  hours: number | null;
  scopeId: string | null;
  activityId: string | null;
  notes: string | null;
  rawData: Record<string, string>;
};

function readRequiredCsv(path: string): string {
  if (!existsSync(path)) {
    throw new Error(
      `Missing demo data file: ${path}. Ensure supabase/seed/csv is present (clone repo or run npm run seed:programme-csv).`
    );
  }
  return readFileSync(path, "utf8").replace(/^\uFEFF/, "");
}

function nextDemoNumberFromProjectNames(names: string[]): number {
  let max = 0;
  const re = /^Euston Station \(Demo (\d+)\)$/;
  for (const n of names) {
    const m = re.exec(n);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

function parseDdMmYyyyToIso(dateStr: string, lineNo: number): string {
  const s = dateStr.trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) {
    throw new Error(`Timesheet demo CSV line ${lineNo}: invalid date "${dateStr}"`);
  }
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) {
    throw new Error(`Timesheet demo CSV line ${lineNo}: date out of range "${dateStr}"`);
  }
  return `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

function activityIdFromTimesheetDescription(description: string): string | null {
  const m = description.trim().match(/^([A-Z]\d+):\s*/);
  return m ? m[1]! : null;
}

function parseTimesheetProgrammeDemoCsv(
  raw: string,
  codeToId: Map<string, string>,
  expectedProjectCode: string,
  scopeSpecs: ReadonlyArray<{ scopeId: string; name: string }>
): TimesheetSeedEntryRow[] {
  const lines = raw.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) {
    throw new Error("Timesheet demo CSV has no data rows");
  }
  const header = lines[0]!.split(",").map((c) => c.trim());
  const expected = ["Date", "Code", "Hours", "Task ID", "Project", "Description"];
  if (header.length !== expected.length || !expected.every((h, i) => header[i] === h)) {
    throw new Error(`Timesheet demo CSV unexpected header (got: ${lines[0]})`);
  }

  const out: TimesheetSeedEntryRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvDataLine(lines[i]!);
    if (cols.length < 6) {
      throw new Error(`Timesheet demo CSV line ${i + 1}: expected at least 6 columns`);
    }
    const dateRaw = cols[0]!;
    const code = cols[1]!;
    const hoursN = Number(cols[2]!);
    const taskCell = cols[3]!;
    const scopeId = programmeDemoTimesheetTaskCellToScopeId(taskCell, scopeSpecs);
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
      "Task ID": taskCell,
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

function parseForecastRows(
  raw: string,
  targetProjectId: string,
  scopeIdPrefix: string,
  codeToId: Map<string, string>
): { project_id: string; scope_id: string; engineer_id: string; date: string; hours: number }[] {
  const lines = raw.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) throw new Error("Forecast demo CSV has no data rows");
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

  const out: {
    project_id: string;
    scope_id: string;
    engineer_id: string;
    date: string;
    hours: number;
  }[] = [];

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
    if (projectId !== SOURCE_FORECAST_PROJECT_ID) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error(`Forecast demo CSV line ${i + 1}: invalid date ${date}`);
    }
    if (!Number.isFinite(hours) || hours <= 0) continue;
    const engineerId = codeToId.get(code);
    if (!engineerId) {
      throw new Error(`Forecast demo CSV line ${i + 1}: unknown engineer code ${code}`);
    }
    out.push({
      project_id: targetProjectId,
      scope_id: `${scopeIdPrefix}${scopeId}`,
      engineer_id: engineerId,
      date,
      hours: Math.round(hours),
    });
  }
  return out;
}

type ScopeEngineerInsert = {
  scope_id: string;
  engineer_id: string;
  is_lead: boolean;
  planned_hrs: number | null;
  weekly_limit_hrs: number | null;
  position: number;
  rate: string;
};

function parseScopeEngineersCsv(
  raw: string,
  scopeIdPrefix: string,
  codeToId: Map<string, string>
): ScopeEngineerInsert[] {
  const lines = raw.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) throw new Error("Scope engineers demo CSV has no data rows");
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

  const out: ScopeEngineerInsert[] = [];
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
      scope_id: `${scopeIdPrefix}${scopeId}`,
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

async function insertTimesheetParsedRows(
  client: SupabaseClient,
  projectId: string,
  fileName: string,
  rows: TimesheetSeedEntryRow[]
): Promise<{ error?: string }> {
  await client
    .from("timesheet_uploads")
    .delete()
    .eq("project_id", projectId)
    .eq("file_name", fileName);

  const { data: uploadData, error: uploadErr } = await client
    .from("timesheet_uploads")
    .insert({
      project_id: projectId,
      file_name: fileName,
      row_count: rows.length,
    })
    .select()
    .single();
  if (uploadErr) return { error: `timesheet_uploads: ${uploadErr.message}` };
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

  const { error: entryErr } = await client.from("timesheet_entries").insert(entryRows);
  if (entryErr) return { error: `timesheet_entries: ${entryErr.message}` };
  return {};
}

async function insertForecastBatches(
  client: SupabaseClient,
  rows: {
    project_id: string;
    scope_id: string;
    engineer_id: string;
    date: string;
    hours: number;
  }[],
  batchSize: number
): Promise<{ error?: string }> {
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await client.from("forecast_entries").insert(batch);
    if (error) return { error: `forecast_entries: ${error.message}` };
  }
  return {};
}

/**
 * Creates a new project "Euston Station (Demo N)" with the same programme, scope engineers,
 * forecast, and timesheet as the primary seed demo (`npm run seed`).
 */
export async function insertEustonDemoProject(
  client: SupabaseClient
): Promise<
  { ok: true; projectId: string; officeUrlSegment: string } | { ok: false; error: string }
> {
  let createdProjectId: string | null = null;

  try {
    const { data: nameRows, error: namesErr } = await client.from("projects").select("name");
    if (namesErr) return { ok: false, error: namesErr.message };

    const demoNum = nextDemoNumberFromProjectNames(
      (nameRows ?? []).map((r: { name: string }) => r.name)
    );
    const projectId = randomUUID();
    createdProjectId = projectId;
    const scopeIdPrefix = `demo${demoNum}-`;

    const { data: poolRows, error: poolErr } = await client
      .from("engineer_pool")
      .select("id, code");
    if (poolErr) return { ok: false, error: poolErr.message };
    const codeToId = new Map(
      (poolRows ?? []).map((r: { id: string; code: string }) => [r.code, r.id])
    );
    if (codeToId.size === 0) {
      return {
        ok: false,
        error:
          "Engineer pool is empty. Run `npm run seed` (or ensure engineer_pool has rows) before adding a demo project.",
      };
    }

    const programmeNodes = applySeedScopeQuotations(buildProgrammeNodesFromSeed(codeToId));
    const prefixedNodes = programmeNodesWithPrefixedIds(programmeNodes, scopeIdPrefix);
    const { nodeRows } = flattenTree(prefixedNodes, projectId);

    const projectInsert = {
      id: projectId,
      project_code: "489",
      name: `Euston Station (Demo ${demoNum})`,
      client: seedProjectRow.client,
      office_id: SEED_LONDON_OFFICE_ID,
      status: "active" as const,
      fixed_fee: seedProjectRow.fixed_fee,
      start_date: seedProjectRow.start_date,
      end_date: seedProjectRow.end_date,
    };

    const { error: projErr } = await client.from("projects").insert(projectInsert);
    if (projErr) return { ok: false, error: projErr.message };

    const { error: nodesErr } = await client.from("programme_nodes").insert(nodeRows);
    if (nodesErr) throw new Error(nodesErr.message);

    const scopeEngRaw = readRequiredCsv(SCOPE_ENGINEERS_CSV);
    const scopeEngRows = parseScopeEngineersCsv(scopeEngRaw, scopeIdPrefix, codeToId);
    if (scopeEngRows.length > 0) {
      const { error: seErr } = await client
        .from("scope_engineers")
        .upsert(scopeEngRows, { onConflict: "scope_id,engineer_id" });
      if (seErr) throw new Error(seErr.message);
    }

    const projectEngineerRows = SEED_PROJECT_ENGINEER_RATE_ROWS.map((r) => {
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
    });

    const { error: peErr } = await client
      .from("project_engineers")
      .upsert(projectEngineerRows, { onConflict: "project_id,engineer_id" });
    if (peErr) throw new Error(peErr.message);

    const forecastRaw = readRequiredCsv(FORECAST_CSV);
    const forecastRows = parseForecastRows(forecastRaw, projectId, scopeIdPrefix, codeToId);
    const fcRes = await insertForecastBatches(client, forecastRows, 400);
    if (fcRes.error) throw new Error(fcRes.error);

    const tsSpecs = defaultSeedScopeForecastSpecs(SEED_SCOPE_ENGINEER_FALLBACK).map((s) => ({
      scopeId: `${scopeIdPrefix}${s.scopeId}`,
      name: s.name,
    }));
    const timesheetRaw = readRequiredCsv(TIMESHEET_CSV);
    const timesheetRows = parseTimesheetProgrammeDemoCsv(
      timesheetRaw,
      codeToId,
      seedProjectRow.project_code ?? "",
      tsSpecs
    );
    const tsRes = await insertTimesheetParsedRows(
      client,
      projectId,
      TIMESHEET_DEMO_FILE_NAME,
      timesheetRows
    );
    if (tsRes.error) throw new Error(tsRes.error);

    const { data: officeRow, error: officeErr } = await client
      .from("offices")
      .select("name")
      .eq("id", SEED_LONDON_OFFICE_ID)
      .maybeSingle();
    if (officeErr) throw new Error(officeErr.message);

    const officeUrlSegment = officeNameToUrlPathSegment(
      (officeRow as { name: string } | null)?.name ?? "London"
    );

    return { ok: true, projectId, officeUrlSegment };
  } catch (e) {
    if (createdProjectId) {
      await client.from("projects").delete().eq("id", createdProjectId);
    }
    return { ok: false, error: e instanceof Error ? e.message : "Failed to create demo project" };
  }
}
