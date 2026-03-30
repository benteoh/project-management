"use server";

import { randomUUID } from "node:crypto";

import {
  createEngineerInDb,
  deleteEngineerInDb,
  listEngineersFromDb,
  updateEngineerInDb,
} from "@/lib/engineers/engineerDb";
import { listProjectsFromDb, loadProjectById } from "@/lib/projects/projectDb";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Engineer } from "@/types/engineer-pool";
import type { Project } from "@/types/project";

import type { EngineerCapacityPayload } from "@/components/settings/types";

type EngineersResult = { ok: true; engineers: Engineer[] } | { ok: false; error: string };

function capacityToDb(c: EngineerCapacityPayload) {
  return {
    capacity_per_week: c.capacityPerWeek,
    capacity_days: [...c.capacityDays] as (number | null)[],
  };
}

function normalizeCode(code: string): string {
  return code.trim();
}

function normalizeName(name: string): string {
  return name.trim();
}

export async function loadEngineersAction(): Promise<EngineersResult> {
  const r = await listEngineersFromDb(createServerSupabaseClient());
  if ("error" in r) return { ok: false, error: r.error };
  return { ok: true, engineers: r.engineers };
}

export async function createEngineerAction(
  input: {
    code: string;
    firstName: string;
    lastName: string;
    isActive: boolean;
  } & EngineerCapacityPayload
): Promise<EngineersResult> {
  const code = normalizeCode(input.code);
  const firstName = normalizeName(input.firstName);
  const lastName = normalizeName(input.lastName);
  if (!code || !firstName || !lastName) {
    return { ok: false, error: "Code, first name, and last name are required." };
  }

  const client = createServerSupabaseClient();
  const createRes = await createEngineerInDb(client, {
    id: randomUUID(),
    code,
    first_name: firstName,
    last_name: lastName,
    is_active: input.isActive,
    ...capacityToDb(input),
  });
  if ("error" in createRes) return { ok: false, error: createRes.error };
  return loadEngineersAction();
}

export async function updateEngineerAction(
  input: {
    id: string;
    code: string;
    firstName: string;
    lastName: string;
    isActive: boolean;
  } & EngineerCapacityPayload
): Promise<EngineersResult> {
  const code = normalizeCode(input.code);
  const firstName = normalizeName(input.firstName);
  const lastName = normalizeName(input.lastName);
  if (!input.id || !code || !firstName || !lastName) {
    return { ok: false, error: "Engineer id, code, first name, and last name are required." };
  }

  const client = createServerSupabaseClient();
  const updateRes = await updateEngineerInDb(client, input.id, {
    code,
    first_name: firstName,
    last_name: lastName,
    is_active: input.isActive,
    ...capacityToDb(input),
  });
  if ("error" in updateRes) return { ok: false, error: updateRes.error };
  return loadEngineersAction();
}

export async function deleteEngineerAction(id: string): Promise<EngineersResult> {
  if (!id) return { ok: false, error: "Engineer id is required." };

  const client = createServerSupabaseClient();
  const delRes = await deleteEngineerInDb(client, id);
  if ("error" in delRes) return { ok: false, error: delRes.error };
  return loadEngineersAction();
}

type ProjectsListResult = { ok: true; projects: Project[] } | { ok: false; error: string };

export async function loadProjectsForSettingsAction(): Promise<ProjectsListResult> {
  const r = await listProjectsFromDb(createServerSupabaseClient());
  if ("error" in r) return { ok: false, error: r.error };
  return { ok: true, projects: r.projects };
}

type ProjectSettingsResult =
  | { ok: true; project: Project }
  | { ok: false; error: string; notFound?: boolean };

export async function loadProjectForSettingsAction(id: string): Promise<ProjectSettingsResult> {
  if (!id) return { ok: false, error: "Project id is required." };
  const r = await loadProjectById(createServerSupabaseClient(), id);
  if ("error" in r) return { ok: false, error: r.error, notFound: r.notFound };
  return { ok: true, project: r.project };
}
