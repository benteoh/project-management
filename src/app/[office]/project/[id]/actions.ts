"use server";

import type { ProgrammeNode } from "@/components/programme/types";
import { getEngineerByCodeFromDb } from "@/lib/engineers/engineerDb";
import { upsertEngineerPoolCodeInDb } from "@/lib/programme/programmeDb";
import { createSupabaseProgrammeRepository } from "@/lib/programme/supabaseProgrammeRepository";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  deleteTimesheetUpload,
  getTimesheetEntries,
  listTimesheetUploads,
  saveTimesheetUpload,
} from "@/lib/timesheet/timesheetDb";
import type { TimesheetEntry, TimesheetUpload } from "@/types/timesheet";

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
