import type { SupabaseClient } from "@supabase/supabase-js";

import type { Office, OfficeDbRow } from "@/types/office";

function rowToOffice(r: OfficeDbRow): Office {
  return { id: r.id, name: r.name, location: r.location };
}

export async function listOfficesFromDb(
  client: SupabaseClient
): Promise<{ offices: Office[] } | { error: string }> {
  const { data, error } = await client
    .from("offices")
    .select("*")
    .order("name", { ascending: true });
  if (error) return { error: error.message };
  return { offices: (data as OfficeDbRow[]).map(rowToOffice) };
}

export async function createOfficeInDb(
  client: SupabaseClient,
  payload: { name: string; location: string }
): Promise<{ office: Office } | { error: string }> {
  const { data, error } = await client
    .from("offices")
    .insert({ name: payload.name, location: payload.location })
    .select()
    .single();
  if (error) return { error: error.message };
  return { office: rowToOffice(data as OfficeDbRow) };
}

export async function updateOfficeInDb(
  client: SupabaseClient,
  id: string,
  payload: { name: string; location: string }
): Promise<{ office: Office } | { error: string }> {
  const { data, error } = await client
    .from("offices")
    .update({ name: payload.name, location: payload.location })
    .eq("id", id)
    .select()
    .single();
  if (error) return { error: error.message };
  return { office: rowToOffice(data as OfficeDbRow) };
}

export async function deleteOfficeInDb(
  client: SupabaseClient,
  id: string
): Promise<{ ok: true } | { error: string }> {
  const { error } = await client.from("offices").delete().eq("id", id);
  if (error) return { error: error.message };
  return { ok: true };
}
