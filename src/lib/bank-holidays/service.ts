import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";

const GOV_UK_BANK_HOLIDAYS_URL = "https://www.gov.uk/bank-holidays.json";
const CACHE_TTL_DAYS = 7;

type GovUkBankHolidaysResponse = {
  "england-and-wales": {
    events: { date: string }[];
  };
};

/**
 * Returns UK bank holiday dates (England & Wales) as ISO strings (YYYY-MM-DD).
 * Fetches from the gov.uk API and caches the result in the DB for 7 days.
 */
export async function getBankHolidays(): Promise<string[]> {
  const client = await createServerSupabaseClient();

  // Check cache
  const { data: cached } = await client
    .from("bank_holidays_cache")
    .select("dates, fetched_at")
    .eq("id", 1)
    .single();

  if (cached) {
    const ageMs = Date.now() - new Date(cached.fetched_at as string).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    if (ageDays < CACHE_TTL_DAYS) {
      return cached.dates as string[];
    }
  }

  // Fetch from gov.uk
  const res = await fetch(GOV_UK_BANK_HOLIDAYS_URL, { next: { revalidate: 0 } });
  if (!res.ok) {
    // Fall back to stale cache rather than failing completely
    if (cached) return cached.dates as string[];
    return [];
  }

  const json: GovUkBankHolidaysResponse = await res.json();
  const dates = json["england-and-wales"].events.map((e) => e.date);

  // Upsert into cache
  await client
    .from("bank_holidays_cache")
    .upsert({ id: 1, dates, fetched_at: new Date().toISOString() });

  return dates;
}
