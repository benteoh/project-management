"use server";

import { randomUUID } from "node:crypto";

import {
  createEngineerInDb,
  deleteEngineerInDb,
  listEngineersFromDb,
  updateEngineerInDb,
} from "@/lib/engineers/engineerDb";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Engineer } from "@/types/engineer-pool";

type EngineersResult = { ok: true; engineers: Engineer[] } | { ok: false; error: string };

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

export async function createEngineerAction(input: {
  code: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
}): Promise<EngineersResult> {
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
  });
  if ("error" in createRes) return { ok: false, error: createRes.error };
  return loadEngineersAction();
}

export async function updateEngineerAction(input: {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
}): Promise<EngineersResult> {
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
