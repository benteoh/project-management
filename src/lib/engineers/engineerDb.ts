import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  Engineer,
  EngineerDbRow,
  EngineerInsertRow,
  EngineerUpdateRow,
} from "@/types/engineer-pool";

function rowToEngineer(r: EngineerDbRow): Engineer {
  return {
    id: r.id,
    code: r.code,
    firstName: r.first_name,
    lastName: r.last_name,
    isActive: r.is_active,
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
