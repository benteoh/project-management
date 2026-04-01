import "server-only";

import { Redis } from "@upstash/redis";

const GOV_UK_BANK_HOLIDAYS_URL = "https://www.gov.uk/bank-holidays.json";
const CACHE_TTL_DAYS = 7;

/** Upstash key for England & Wales bank holiday ISO dates (JSON: `{ dates, fetchedAt }`). */
export const BANK_HOLIDAYS_ENGLAND_WALES_KEY = "bank-holidays:england-wales" as const;

type GovUkBankHolidaysResponse = {
  "england-and-wales": {
    events: { date: string }[];
  };
};

type CachedPayload = {
  dates: string[];
  fetchedAt: string;
};

function cacheAgeDays(fetchedAtIso: string, nowMs: number): number {
  return (nowMs - new Date(fetchedAtIso).getTime()) / (1000 * 60 * 60 * 24);
}

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

/**
 * UK bank holiday dates (England & Wales) as ISO strings (YYYY-MM-DD).
 * Fetches from gov.uk and caches in Upstash Redis for 7 days.
 * Without Upstash env vars, fetches each call (no persistence).
 */
export async function getBankHolidays(): Promise<string[]> {
  const redis = getRedis();

  let cached: CachedPayload | null = null;
  if (redis) {
    cached = (await redis.get(BANK_HOLIDAYS_ENGLAND_WALES_KEY)) as CachedPayload | null;
  }

  const nowMs = Date.now();
  if (cached && cacheAgeDays(cached.fetchedAt, nowMs) < CACHE_TTL_DAYS) {
    return cached.dates;
  }

  const res = await fetch(GOV_UK_BANK_HOLIDAYS_URL, { next: { revalidate: 0 } });
  if (!res.ok) {
    if (cached) return cached.dates;
    return [];
  }

  const json: GovUkBankHolidaysResponse = await res.json();
  const dates = json["england-and-wales"].events.map((e) => e.date);
  const payload: CachedPayload = {
    dates,
    fetchedAt: new Date().toISOString(),
  };

  if (redis) {
    await redis.set(BANK_HOLIDAYS_ENGLAND_WALES_KEY, payload);
  }

  return dates;
}
