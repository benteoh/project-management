import "server-only";

import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { SupabaseClient } from "@supabase/supabase-js";

import { flattenTree } from "@/lib/programme/programmeTree";
import { programmeNodesWithPrefixedIds } from "@/lib/programme/seedProgrammeClone";
import { officeNameToUrlPathSegment } from "@/lib/offices/officeUrl";
import { parseCsvDataLine } from "@/lib/seed/seedCsv";
import { SEED_LONDON_OFFICE_ID } from "@/lib/programme/seedConfig";
import {
  buildIverEghamProgrammeNodes,
  iverEghamProjectRow,
  iverEghamSeedData,
  IVER_EGHAM_PROJECT_ENGINEER_RATES,
  IVER_EGHAM_PROJECT_ID,
} from "@/lib/seed/iverEghamSeed";
import {
  collectSeedScopeForecastSpecs,
  programmeDemoTimesheetTaskCellToScopeId,
} from "@/lib/seed/seedProgrammeScopeMetadata";

const DEMO_CSV_DIR = join(process.cwd(), "supabase", "seed", "csv");
const FORECAST_CSV = join(DEMO_CSV_DIR, "forecast_617.csv");
const SCOPE_ENGINEERS_CSV = join(DEMO_CSV_DIR, "scope_engineers_617.csv");
const TIMESHEET_CSV = join(DEMO_CSV_DIR, "timesheet_617.csv");
const TIMESHEET_FILE_NAME = "Iver_Egham_617_timesheet.csv";

function readRequiredCsv(path: string): string {
  if (!existsSync(path)) {
    throw new Error(
      `Missing demo data file: ${path}. Ensure supabase/seed/csv is present (run npm run seed:617-csv).`
    );
  }
  return readFileSync(path, "utf8").replace(/^﻿/, "");
}

function nextDemoNumber(names: string[]): number {
  let max = 0;
  const re = /^Iver & Egham \(Demo (\d+)\)$/;
  for (const n of names) {
    const m = re.exec(n);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

function parseDdMmYyyyToIso(dateStr: string, lineNo: number): string {
  const s = dateStr.trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) throw new Error(`Timesheet CSV line ${lineNo}: invalid date "${dateStr}"`);
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31)
    throw new Error(`Timesheet CSV line ${lineNo}: date out of range "${dateStr}"`);
  return `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

function activityIdFromDescription(description: string): string | null {
  const m = description.trim().match(/^([A-Z]\d+):\s*/);
  return m ? m[1]! : null;
}

type TimesheetRow = {
  engineerId: string | null;
  entryDate: string | null;
  hours: number | null;
  scopeId: string | null;
  activityId: string | null;
  notes: string | null;
  rawData: Record<string, string>;
};

type ScopeEngineerInsert = {
  scope_id: string;
  engineer_id: string;
  is_lead: boolean;
  planned_hrs: number | null;
  weekly_limit_hrs: number | null;
  position: number;
  rate: string;
};

function parseForecastCsv(
  raw: string,
  targetProjectId: string,
  scopeIdPrefix: string,
  codeToId: Map<string, string>
): { project_id: string; scope_id: string; engineer_id: string; date: string; hours: number }[] {
  const lines = raw.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) throw new Error("Forecast CSV has no data rows");
  const out: {
    project_id: string;
    scope_id: string;
    engineer_id: string;
    date: string;
    hours: number;
  }[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i]!.split(",");
    if (cols.length < 5) throw new Error(`Forecast CSV line ${i + 1}: expected 5 columns`);
    const projectId = cols[0]!.trim();
    const scopeId = cols[1]!.trim();
    const code = cols[2]!.trim();
    const date = cols[3]!.trim();
    const hours = Number(cols[4]!.trim());
    if (projectId !== IVER_EGHAM_PROJECT_ID) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
      throw new Error(`Forecast CSV line ${i + 1}: invalid date ${date}`);
    if (!Number.isFinite(hours) || hours <= 0) continue;
    const engineerId = codeToId.get(code);
    if (!engineerId) throw new Error(`Forecast CSV line ${i + 1}: unknown engineer code ${code}`);
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

function parseScopeEngineersCsv(
  raw: string,
  scopeIdPrefix: string,
  codeToId: Map<string, string>
): ScopeEngineerInsert[] {
  const lines = raw.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) throw new Error("Scope engineers CSV has no data rows");
  const out: ScopeEngineerInsert[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i]!.split(",").map((c) => c.trim());
    if (cols.length < 7) throw new Error(`Scope engineers CSV line ${i + 1}: expected 7 columns`);
    const scopeId = cols[0]!;
    const code = cols[1]!;
    const isLead = cols[2]!.toLowerCase() === "true";
    const planned = Number(cols[3]!);
    const position = Number(cols[4]!);
    const rate = cols[5]! || "A";
    const weeklyRaw = cols[6]!.trim();
    const weeklyLimit = weeklyRaw === "" ? null : Number(weeklyRaw);
    const engineerId = codeToId.get(code);
    if (!engineerId)
      throw new Error(`Scope engineers CSV line ${i + 1}: unknown engineer code ${code}`);
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

function parseTimesheetCsv(
  raw: string,
  codeToId: Map<string, string>,
  scopeSpecs: ReadonlyArray<{ scopeId: string; name: string }>
): TimesheetRow[] {
  const lines = raw.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) throw new Error("Timesheet CSV has no data rows");
  const out: TimesheetRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvDataLine(lines[i]!);
    if (cols.length < 6)
      throw new Error(`Timesheet CSV line ${i + 1}: expected at least 6 columns`);
    const dateRaw = cols[0]!;
    const code = cols[1]!;
    const hoursN = Number(cols[2]!);
    const taskCell = cols[3]!;
    const description = cols.slice(5).join(",");
    if (!Number.isFinite(hoursN) || hoursN <= 0)
      throw new Error(`Timesheet CSV line ${i + 1}: invalid hours`);
    const scopeId = programmeDemoTimesheetTaskCellToScopeId(taskCell, scopeSpecs);
    const engineerId = codeToId.get(code) ?? null;
    if (!engineerId) throw new Error(`Timesheet CSV line ${i + 1}: unknown engineer code ${code}`);
    out.push({
      engineerId,
      entryDate: parseDdMmYyyyToIso(dateRaw, i + 1),
      hours: hoursN,
      scopeId,
      activityId: activityIdFromDescription(description),
      notes: description,
      rawData: {
        Date: dateRaw,
        Code: code,
        Hours: String(hoursN),
        "Task ID": taskCell,
        Project: cols[4]!,
        Description: description,
      },
    });
  }
  return out;
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
    const { error } = await client.from("forecast_entries").insert(rows.slice(i, i + batchSize));
    if (error) return { error: `forecast_entries: ${error.message}` };
  }
  return {};
}

async function insertTimesheetRows(
  client: SupabaseClient,
  projectId: string,
  fileName: string,
  rows: TimesheetRow[]
): Promise<{ error?: string }> {
  await client
    .from("timesheet_uploads")
    .delete()
    .eq("project_id", projectId)
    .eq("file_name", fileName);
  const { data: uploadData, error: uploadErr } = await client
    .from("timesheet_uploads")
    .insert({ project_id: projectId, file_name: fileName, row_count: rows.length })
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

/**
 * Creates a new project "Iver & Egham (Demo N)" with the same programme, scope engineers,
 * forecast, and timesheet as the primary 617 seed demo (`npm run seed`).
 */
export async function insertIverEghamDemoProject(
  client: SupabaseClient
): Promise<
  { ok: true; projectId: string; officeUrlSegment: string } | { ok: false; error: string }
> {
  let createdProjectId: string | null = null;

  try {
    const { data: nameRows, error: namesErr } = await client.from("projects").select("name");
    if (namesErr) return { ok: false, error: namesErr.message };

    const demoNum = nextDemoNumber((nameRows ?? []).map((r: { name: string }) => r.name));
    const projectId = randomUUID();
    createdProjectId = projectId;
    const scopeIdPrefix = `ia${demoNum}-`;

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
        error: "Engineer pool is empty. Run `npm run seed` before adding a demo project.",
      };
    }

    const programmeNodes = programmeNodesWithPrefixedIds(
      buildIverEghamProgrammeNodes(codeToId),
      scopeIdPrefix
    );
    const { nodeRows } = flattenTree(programmeNodes, projectId);

    const { error: projErr } = await client.from("projects").insert({
      id: projectId,
      project_code: iverEghamProjectRow.project_code,
      name: `Iver & Egham (Demo ${demoNum})`,
      client: iverEghamProjectRow.client,
      office_id: SEED_LONDON_OFFICE_ID,
      status: "active" as const,
      fixed_fee: iverEghamProjectRow.fixed_fee,
      start_date: iverEghamProjectRow.start_date,
      end_date: iverEghamProjectRow.end_date,
    });
    if (projErr) return { ok: false, error: projErr.message };

    const { error: nodesErr } = await client.from("programme_nodes").insert(nodeRows);
    if (nodesErr) throw new Error(nodesErr.message);

    const scopeEngRows = parseScopeEngineersCsv(
      readRequiredCsv(SCOPE_ENGINEERS_CSV),
      scopeIdPrefix,
      codeToId
    );
    if (scopeEngRows.length > 0) {
      const { error: seErr } = await client
        .from("scope_engineers")
        .upsert(scopeEngRows, { onConflict: "scope_id,engineer_id" });
      if (seErr) throw new Error(seErr.message);
    }

    const projectEngineerRows = IVER_EGHAM_PROJECT_ENGINEER_RATES.map((r) => {
      const engineerId = codeToId.get(r.code);
      if (!engineerId) throw new Error(`project_engineers: no pool id for code ${r.code}`);
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

    const forecastRows = parseForecastCsv(
      readRequiredCsv(FORECAST_CSV),
      projectId,
      scopeIdPrefix,
      codeToId
    );
    const fcRes = await insertForecastBatches(client, forecastRows, 400);
    if (fcRes.error) throw new Error(fcRes.error);

    const baseSpecs = collectSeedScopeForecastSpecs(iverEghamSeedData, {
      fallbackAllocations: [],
      underAllocatedScopeIds: new Set(),
      overAllocatedScopeIds: new Set(),
    });
    const tsSpecs = baseSpecs.map((s) => ({
      scopeId: `${scopeIdPrefix}${s.scopeId}`,
      name: s.name,
    }));
    const timesheetRows = parseTimesheetCsv(readRequiredCsv(TIMESHEET_CSV), codeToId, tsSpecs);
    const tsRes = await insertTimesheetRows(client, projectId, TIMESHEET_FILE_NAME, timesheetRows);
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
