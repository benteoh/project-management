import type { SupabaseClient } from "@supabase/supabase-js";

import { deriveEngineerCodeBase } from "@/lib/engineers/engineerCode";
import type {
  Engineer,
  EngineerDbRow,
  EngineerInsertRow,
  EngineerUpdateRow,
} from "@/types/engineer-pool";

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function rowToEngineer(r: EngineerDbRow): Engineer {
  return {
    id: r.id,
    code: r.code,
    firstName: r.first_name,
    lastName: r.last_name,
    isActive: r.is_active,
    maxDailyHours: numOrNull(r.max_daily_hours),
    maxWeeklyHours: numOrNull(r.max_weekly_hours),
  };
}

export async function listEngineersFromDb(
  client: SupabaseClient
): Promise<{ engineers: Engineer[] } | { error: string }> {
  const { data, error } = await client
    .from("engineer_pool")
    .select("*")
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true });

  if (error) return { error: error.message };
  return { engineers: ((data ?? []) as EngineerDbRow[]).map(rowToEngineer) };
}

/**
 * Picks a unique `engineer_pool.code`: base from names, then `base1`, `base2`, … if needed.
 */
export async function allocateUniqueEngineerCodeInDb(
  client: SupabaseClient,
  firstName: string,
  lastName: string,
  options?: { excludeEngineerId?: string }
): Promise<{ code: string } | { error: string }> {
  const base = deriveEngineerCodeBase(firstName, lastName);

  const { data, error } = await client.from("engineer_pool").select("id, code");
  if (error) return { error: error.message };

  const taken = new Set(
    (data ?? [])
      .filter((r: { id: string }) => r.id !== options?.excludeEngineerId)
      .map((r: { code: string }) => r.code)
  );

  if (!taken.has(base)) return { code: base };

  for (let n = 1; n < 10_000; n++) {
    const candidate = `${base}${n}`;
    if (!taken.has(candidate)) return { code: candidate };
  }

  return { error: "Could not allocate a unique engineer code." };
}

export async function getEngineerByCodeFromDb(
  client: SupabaseClient,
  code: string
): Promise<{ engineer: Engineer } | { error: string }> {
  const { data, error } = await client
    .from("engineer_pool")
    .select("*")
    .eq("code", code)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Engineer not found" };
  return { engineer: rowToEngineer(data as EngineerDbRow) };
}

export async function createEngineerInDb(
  client: SupabaseClient,
  input: EngineerInsertRow
): Promise<{ engineer: Engineer } | { error: string }> {
  const { data, error } = await client.from("engineer_pool").insert(input).select("*").single();
  if (error) return { error: error.message };
  return { engineer: rowToEngineer(data as EngineerDbRow) };
}

export async function updateEngineerInDb(
  client: SupabaseClient,
  id: string,
  input: EngineerUpdateRow
): Promise<{ engineer: Engineer } | { error: string }> {
  const { data, error } = await client
    .from("engineer_pool")
    .update(input)
    .eq("id", id)
    .select("*")
    .single();
  if (error) return { error: error.message };
  return { engineer: rowToEngineer(data as EngineerDbRow) };
}

export async function deleteEngineerInDb(
  client: SupabaseClient,
  id: string
): Promise<{ ok: true } | { error: string }> {
  const { error } = await client.from("engineer_pool").delete().eq("id", id);
  if (error) return { error: error.message };
  return { ok: true };
}
