"use server";

import { randomUUID } from "node:crypto";

import { reconcileEngineerCapacityForSave } from "@/lib/engineers/engineerCapacity";
import {
  allocateUniqueEngineerCodeInDb,
  createEngineerInDb,
  deleteEngineerInDb,
  listEngineersFromDb,
  updateEngineerInDb,
} from "@/lib/engineers/engineerDb";
import {
  createProjectInDb,
  deleteProjectInDb,
  listProjectsFromDb,
  loadProjectById,
  updateProjectInDb,
} from "@/lib/projects/projectDb";
import { duplicateProjectInDb } from "@/lib/projects/projectDuplicateDb";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Engineer } from "@/types/engineer-pool";
import type { Project } from "@/types/project";

import type {
  EngineerCapacityPayload,
  ProjectCreatePayload,
  ProjectUpdatePayload,
} from "@/components/settings/types";

type EngineersResult = { ok: true; engineers: Engineer[] } | { ok: false; error: string };

function capacityToDb(c: EngineerCapacityPayload) {
  return {
    max_daily_hours: c.maxDailyHours,
    max_weekly_hours: c.maxWeeklyHours,
  };
}

function normalizeName(name: string): string {
  return name.trim();
}

export async function loadEngineersAction(): Promise<EngineersResult> {
  const r = await listEngineersFromDb(await createServerSupabaseClient());
  if ("error" in r) return { ok: false, error: r.error };
  return { ok: true, engineers: r.engineers };
}

export async function createEngineerAction(
  input: {
    firstName: string;
    lastName: string;
    isActive: boolean;
    officeId: string | null;
  } & EngineerCapacityPayload
): Promise<EngineersResult> {
  const firstName = normalizeName(input.firstName);
  const lastName = normalizeName(input.lastName);
  if (!firstName || !lastName) {
    return { ok: false, error: "First name and last name are required." };
  }

  const client = await createServerSupabaseClient();
  const allocated = await allocateUniqueEngineerCodeInDb(client, firstName, lastName);
  if ("error" in allocated) return { ok: false, error: allocated.error };

  const cap = reconcileEngineerCapacityForSave(input.maxDailyHours, input.maxWeeklyHours);

  const createRes = await createEngineerInDb(client, {
    id: randomUUID(),
    code: allocated.code,
    first_name: firstName,
    last_name: lastName,
    is_active: input.isActive,
    office_id: input.officeId,
    ...capacityToDb(cap),
  });
  if ("error" in createRes) return { ok: false, error: createRes.error };
  return loadEngineersAction();
}

export async function updateEngineerAction(
  input: {
    id: string;
    firstName: string;
    lastName: string;
    isActive: boolean;
    officeId: string | null;
  } & EngineerCapacityPayload
): Promise<EngineersResult> {
  const firstName = normalizeName(input.firstName);
  const lastName = normalizeName(input.lastName);
  if (!input.id || !firstName || !lastName) {
    return { ok: false, error: "Engineer id, first name, and last name are required." };
  }

  const client = await createServerSupabaseClient();
  const allocated = await allocateUniqueEngineerCodeInDb(client, firstName, lastName, {
    excludeEngineerId: input.id,
  });
  if ("error" in allocated) return { ok: false, error: allocated.error };

  const cap = reconcileEngineerCapacityForSave(input.maxDailyHours, input.maxWeeklyHours);

  const updateRes = await updateEngineerInDb(client, input.id, {
    code: allocated.code,
    first_name: firstName,
    last_name: lastName,
    is_active: input.isActive,
    office_id: input.officeId,
    ...capacityToDb(cap),
  });
  if ("error" in updateRes) return { ok: false, error: updateRes.error };
  return loadEngineersAction();
}

export async function deleteEngineerAction(id: string): Promise<EngineersResult> {
  if (!id) return { ok: false, error: "Engineer id is required." };

  const client = await createServerSupabaseClient();
  const delRes = await deleteEngineerInDb(client, id);
  if ("error" in delRes) return { ok: false, error: delRes.error };
  return loadEngineersAction();
}

type ProjectsListResult = { ok: true; projects: Project[] } | { ok: false; error: string };

export async function loadProjectsForSettingsAction(): Promise<ProjectsListResult> {
  const r = await listProjectsFromDb(await createServerSupabaseClient());
  if ("error" in r) return { ok: false, error: r.error };
  return { ok: true, projects: r.projects };
}

type ProjectSettingsResult =
  | { ok: true; project: Project }
  | { ok: false; error: string; notFound?: boolean };

export async function loadProjectForSettingsAction(id: string): Promise<ProjectSettingsResult> {
  if (!id) return { ok: false, error: "Project id is required." };
  const r = await loadProjectById(await createServerSupabaseClient(), id);
  if ("error" in r) return { ok: false, error: r.error, notFound: r.notFound };
  return { ok: true, project: r.project };
}

export async function createProjectAction(
  payload: ProjectCreatePayload
): Promise<ProjectsListResult> {
  const name = payload.name.trim();
  const client = payload.client.trim();
  if (!name) return { ok: false, error: "Project name is required." };
  if (!client) return { ok: false, error: "Client is required." };
  if (!payload.officeId) return { ok: false, error: "Office is required." };

  const db = await createServerSupabaseClient();
  const r = await createProjectInDb(db, {
    id: randomUUID(),
    name,
    client,
    office_id: payload.officeId,
    project_code: payload.projectCode || null,
    status: payload.status,
    fixed_fee: payload.fixedFee,
    start_date: payload.startDate,
    end_date: payload.endDate,
  });
  if ("error" in r) return { ok: false, error: r.error };
  return loadProjectsForSettingsAction();
}

export type DuplicateProjectResult =
  | { ok: true; newProjectId: string }
  | { ok: false; error: string };

export async function duplicateProjectAction(
  sourceProjectId: string
): Promise<DuplicateProjectResult> {
  if (!sourceProjectId) return { ok: false, error: "Project id is required." };
  const client = await createServerSupabaseClient();
  const r = await duplicateProjectInDb(client, sourceProjectId);
  if ("error" in r) return { ok: false, error: r.error };
  return { ok: true, newProjectId: r.projectId };
}

export async function deleteProjectAction(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!id) return { ok: false, error: "Project id is required." };
  const db = await createServerSupabaseClient();
  const r = await deleteProjectInDb(db, id);
  if ("error" in r) return { ok: false, error: r.error };
  return { ok: true };
}

export async function updateProjectAction(
  payload: ProjectUpdatePayload
): Promise<ProjectsListResult> {
  const name = payload.name.trim();
  const client = payload.client.trim();
  if (!payload.id) return { ok: false, error: "Project id is required." };
  if (!name) return { ok: false, error: "Project name is required." };
  if (!client) return { ok: false, error: "Client is required." };
  if (!payload.officeId) return { ok: false, error: "Office is required." };

  const db = await createServerSupabaseClient();
  const r = await updateProjectInDb(db, payload.id, {
    name,
    client,
    office_id: payload.officeId,
    project_code: payload.projectCode || null,
    status: payload.status,
    fixed_fee: payload.fixedFee,
    start_date: payload.startDate,
    end_date: payload.endDate,
  });
  if ("error" in r) return { ok: false, error: r.error };
  return loadProjectsForSettingsAction();
}
