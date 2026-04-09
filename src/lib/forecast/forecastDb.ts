import type { SupabaseClient } from "@supabase/supabase-js";

import type { CellValues } from "@/components/forecast/forecastGridTypes";
import type { ForecastEntryDbRow } from "@/types/forecast-entry";
import type { ForecastHoursByScopeRecord, ForecastHoursPerEngineer } from "@/types/forecast-scope";

import { forecastRowId, parseForecastRowId } from "./forecastRowId";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function loadForecastEntries(
  client: SupabaseClient,
  projectId: string
): Promise<{ ok: true; values: CellValues } | { ok: false; error: string }> {
  const { data, error } = await client
    .from("forecast_entries")
    .select("scope_id, engineer_id, date, hours")
    .eq("project_id", projectId);

  if (error) return { ok: false, error: error.message };

  const values: CellValues = {};
  for (const row of (data ?? []) as Pick<
    ForecastEntryDbRow,
    "scope_id" | "engineer_id" | "date" | "hours"
  >[]) {
    const rid = forecastRowId(row.scope_id, row.engineer_id);
    if (!values[rid]) values[rid] = {};
    const hrs = Number(row.hours);
    if (hrs > 0) values[rid][row.date] = Math.round(hrs);
  }

  return { ok: true, values };
}

type UpsertRow = {
  project_id: string;
  scope_id: string;
  engineer_id: string;
  date: string;
  hours: number;
};

export async function saveForecastEntries(
  client: SupabaseClient,
  projectId: string,
  values: CellValues
): Promise<{ ok: true } | { ok: false; error: string }> {
  const upserts: UpsertRow[] = [];
  const keepKeys = new Set<string>();

  for (const [rowId, fields] of Object.entries(values)) {
    const parsed = parseForecastRowId(rowId);
    if (!parsed) continue;
    for (const [dateKey, raw] of Object.entries(fields)) {
      if (!ISO_DATE.test(dateKey)) continue;
      const hrs = typeof raw === "number" ? raw : Number(raw);
      if (raw == null || hrs === 0 || Number.isNaN(hrs)) continue;
      const h = Math.round(hrs);
      if (h <= 0) continue;
      keepKeys.add(`${parsed.scopeId}|${parsed.engineerId}|${dateKey}`);
      upserts.push({
        project_id: projectId,
        scope_id: parsed.scopeId,
        engineer_id: parsed.engineerId,
        date: dateKey,
        hours: h,
      });
    }
  }

  if (upserts.length > 0) {
    const { error: upErr } = await client.from("forecast_entries").upsert(upserts, {
      onConflict: "project_id,scope_id,engineer_id,date",
    });
    if (upErr) return { ok: false, error: upErr.message };
  }

  const { data: existing, error: selErr } = await client
    .from("forecast_entries")
    .select("id, scope_id, engineer_id, date")
    .eq("project_id", projectId);

  if (selErr) return { ok: false, error: selErr.message };

  const toDelete: string[] = [];
  for (const row of (existing ?? []) as {
    id: string;
    scope_id: string;
    engineer_id: string;
    date: string;
  }[]) {
    const k = `${row.scope_id}|${row.engineer_id}|${row.date}`;
    if (!keepKeys.has(k)) toDelete.push(row.id);
  }

  if (toDelete.length > 0) {
    const { error: delErr } = await client.from("forecast_entries").delete().in("id", toDelete);
    if (delErr) return { ok: false, error: delErr.message };
  }

  return { ok: true };
}

/**
 * Sums `forecast_entries.hours` per scope and per engineer for the programme table
 * (read-only display on scope rows).
 */
export async function loadForecastHoursByScopeForProject(
  client: SupabaseClient,
  projectId: string
): Promise<{ ok: true; byScope: ForecastHoursByScopeRecord } | { ok: false; error: string }> {
  const { data, error } = await client
    .from("forecast_entries")
    .select("scope_id, engineer_id, hours")
    .eq("project_id", projectId);

  if (error) return { ok: false, error: error.message };

  const acc = new Map<string, Map<string, number>>();
  for (const row of (data ?? []) as Pick<
    ForecastEntryDbRow,
    "scope_id" | "engineer_id" | "hours"
  >[]) {
    const sid = row.scope_id;
    const eid = row.engineer_id;
    const h = Number(row.hours);
    if (Number.isNaN(h)) continue;
    if (!acc.has(sid)) acc.set(sid, new Map());
    const m = acc.get(sid)!;
    m.set(eid, (m.get(eid) ?? 0) + h);
  }

  const byScope: ForecastHoursByScopeRecord = {};
  for (const [scopeId, engMap] of acc) {
    const list: ForecastHoursPerEngineer[] = [...engMap.entries()].map(([engineerId, sum]) => ({
      engineerId,
      hours: Math.round(sum * 100) / 100,
    }));
    list.sort((a, b) => a.engineerId.localeCompare(b.engineerId));
    byScope[scopeId] = list;
  }

  return { ok: true, byScope };
}
