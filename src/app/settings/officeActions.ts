"use server";

import {
  createOfficeInDb,
  deleteOfficeInDb,
  listOfficesFromDb,
  updateOfficeInDb,
} from "@/lib/offices/officeDb";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Office } from "@/types/office";

type OfficesResult = { ok: true; offices: Office[] } | { ok: false; error: string };

export async function loadOfficesAction(): Promise<OfficesResult> {
  const r = await listOfficesFromDb(await createServerSupabaseClient());
  if ("error" in r) return { ok: false, error: r.error };
  return { ok: true, offices: r.offices };
}

export async function createOfficeAction(payload: {
  name: string;
  location: string;
}): Promise<OfficesResult> {
  const name = payload.name.trim();
  const location = payload.location.trim();
  if (!name) return { ok: false, error: "Name is required." };
  if (!location) return { ok: false, error: "Location is required." };

  const client = await createServerSupabaseClient();
  const r = await createOfficeInDb(client, { name, location });
  if ("error" in r) return { ok: false, error: r.error };
  return loadOfficesAction();
}

export async function updateOfficeAction(
  id: string,
  payload: { name: string; location: string }
): Promise<OfficesResult> {
  if (!id) return { ok: false, error: "Office id is required." };
  const name = payload.name.trim();
  const location = payload.location.trim();
  if (!name) return { ok: false, error: "Name is required." };
  if (!location) return { ok: false, error: "Location is required." };

  const client = await createServerSupabaseClient();
  const r = await updateOfficeInDb(client, id, { name, location });
  if ("error" in r) return { ok: false, error: r.error };
  return loadOfficesAction();
}

export async function deleteOfficeAction(id: string): Promise<OfficesResult> {
  if (!id) return { ok: false, error: "Office id is required." };
  const client = await createServerSupabaseClient();
  const r = await deleteOfficeInDb(client, id);
  if ("error" in r) return { ok: false, error: r.error };
  return loadOfficesAction();
}
