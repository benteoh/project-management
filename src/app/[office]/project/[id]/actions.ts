"use server";

import type { ProgrammeNode } from "@/components/programme/types";
import { getEngineerByCodeFromDb } from "@/lib/engineers/engineerDb";
import type { CellValues } from "@/components/forecast/forecastGridTypes";
import { loadForecastEntries, loadForecastHoursByScopeForProject } from "@/lib/forecast/forecastDb";
import { upsertEngineerPoolCodeInDb } from "@/lib/programme/programmeDb";
import { createSupabaseProgrammeRepository } from "@/lib/programme/supabaseProgrammeRepository";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  deleteTimesheetUpload,
  getTimesheetEntries,
  listTimesheetUploads,
  relinkTimesheetUpload,
  saveTimesheetUpload,
} from "@/lib/timesheet/timesheetDb";
import { getScopeMappings, upsertScopeMapping } from "@/lib/timesheet/scopeMappingDb";
import {
  getTimesheetActualsForProject,
  getTimesheetCvrEntriesForProject,
} from "@/lib/timesheet/timesheetActualsDb";
import type { TimesheetActualEntry, TimesheetCvrEntry } from "@/lib/timesheet/timesheetActualsDb";
import type { TimesheetEntry, TimesheetScopeMapping, TimesheetUpload } from "@/types/timesheet";
import type { ForecastHoursByScopeRecord } from "@/types/forecast-scope";

export async function saveProgrammeAction(projectId: string, tree: ProgrammeNode[]) {
  const repo = createSupabaseProgrammeRepository(await createServerSupabaseClient(), projectId);
  return repo.save(tree);
}

export async function addEngineerToPoolAction(code: string) {
  const client = await createServerSupabaseClient();
  const err = await upsertEngineerPoolCodeInDb(client, code.trim());
  if (err) return { ok: false as const, error: err };
  const eng = await getEngineerByCodeFromDb(client, code.trim());
  if ("error" in eng) return { ok: false as const, error: eng.error };
  return { ok: true as const, engineer: eng.engineer };
}

export async function saveTimesheetUploadAction(
  projectId: string,
  fileName: string,
  headers: string[],
  rows: string[][]
): Promise<{ ok: true; upload: TimesheetUpload } | { ok: false; error: string }> {
  const client = await createServerSupabaseClient();
  return saveTimesheetUpload(client, projectId, fileName, headers, rows);
}

export async function deleteTimesheetUploadAction(
  uploadId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = await createServerSupabaseClient();
  return deleteTimesheetUpload(client, uploadId);
}

export async function listTimesheetUploadsAction(
  projectId: string
): Promise<{ uploads: TimesheetUpload[] } | { error: string }> {
  const client = await createServerSupabaseClient();
  return listTimesheetUploads(client, projectId);
}

export async function getTimesheetEntriesAction(
  uploadId: string
): Promise<{ entries: TimesheetEntry[]; headers: string[] } | { error: string }> {
  const client = await createServerSupabaseClient();
  return getTimesheetEntries(client, uploadId);
}

export async function relinkTimesheetUploadAction(
  projectId: string,
  uploadId: string
): Promise<{ ok: true; updatedCount: number } | { ok: false; error: string }> {
  const client = await createServerSupabaseClient();
  return relinkTimesheetUpload(client, projectId, uploadId);
}

export async function getScopeMappingsAction(
  projectId: string
): Promise<{ mappings: TimesheetScopeMapping[] } | { error: string }> {
  const client = await createServerSupabaseClient();
  return getScopeMappings(client, projectId);
}

export async function upsertScopeMappingAction(
  projectId: string,
  rawText: string,
  scopeId: string
): Promise<{ ok: true; mapping: TimesheetScopeMapping } | { ok: false; error: string }> {
  const client = await createServerSupabaseClient();
  return upsertScopeMapping(client, projectId, rawText, scopeId);
}

export async function getTimesheetProjectActualsAction(
  projectId: string
): Promise<{ rows: TimesheetActualEntry[] } | { error: string }> {
  const client = await createServerSupabaseClient();
  return getTimesheetActualsForProject(client, projectId);
}

export async function getTimesheetCvrEntriesAction(
  projectId: string
): Promise<{ rows: TimesheetCvrEntry[] } | { error: string }> {
  const client = await createServerSupabaseClient();
  return getTimesheetCvrEntriesForProject(client, projectId);
}

export async function getProjectForecastHoursByScopeAction(
  projectId: string
): Promise<{ byScope: ForecastHoursByScopeRecord } | { error: string }> {
  const client = await createServerSupabaseClient();
  const result = await loadForecastHoursByScopeForProject(client, projectId);
  if (!result.ok) return { error: result.error };
  return { byScope: result.byScope };
}

/** Dated forecast grid cells for CVR upcoming £ (same shape as the demand forecast tab). */
export async function getForecastCellValuesForCvrAction(
  projectId: string
): Promise<{ values: CellValues } | { error: string }> {
  const client = await createServerSupabaseClient();
  const result = await loadForecastEntries(client, projectId);
  if (!result.ok) return { error: result.error };
  return { values: result.values };
}
