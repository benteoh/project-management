import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BANK_HOLIDAYS_ENGLAND_WALES_KEY, getBankHolidays } from "./bankHolidays";

const mockGet = vi.fn();
const mockSet = vi.fn();

vi.mock("@upstash/redis", () => ({
  Redis: class {
    get = mockGet;
    set = mockSet;
  },
}));

const GOV_UK_JSON = {
  "england-and-wales": {
    events: [{ date: "2026-01-01" }, { date: "2026-04-03" }],
  },
};

describe("getBankHolidays", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    mockGet.mockReset();
    mockSet.mockReset();
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  it("fetches from gov.uk when Upstash is not configured and returns dates", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => GOV_UK_JSON,
    }) as unknown as typeof fetch;

    const dates = await getBankHolidays();

    expect(dates).toEqual(["2026-01-01", "2026-04-03"]);
    expect(mockGet).not.toHaveBeenCalled();
    expect(mockSet).not.toHaveBeenCalled();
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("returns fresh Redis cache without calling fetch", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";

    const fetchedAt = new Date().toISOString();
    mockGet.mockResolvedValue({
      dates: ["2025-12-25"],
      fetchedAt,
    });

    globalThis.fetch = vi.fn() as unknown as typeof fetch;

    const dates = await getBankHolidays();

    expect(dates).toEqual(["2025-12-25"]);
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(mockSet).not.toHaveBeenCalled();
  });

  it("refetches when cache is older than 7 days and writes Redis", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T12:00:00.000Z"));

    const staleFetchedAt = new Date("2026-01-01T00:00:00.000Z").toISOString();
    mockGet.mockResolvedValue({
      dates: ["2025-12-25"],
      fetchedAt: staleFetchedAt,
    });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => GOV_UK_JSON,
    }) as unknown as typeof fetch;

    const dates = await getBankHolidays();

    expect(dates).toEqual(["2026-01-01", "2026-04-03"]);
    expect(mockSet).toHaveBeenCalledWith(BANK_HOLIDAYS_ENGLAND_WALES_KEY, {
      dates: ["2026-01-01", "2026-04-03"],
      fetchedAt: "2026-06-01T12:00:00.000Z",
    });
  });

  it("returns stale cached dates when gov.uk fetch fails", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";

    mockGet.mockResolvedValue({
      dates: ["2025-12-25"],
      fetchedAt: new Date().toISOString(),
    });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    }) as unknown as typeof fetch;

    const dates = await getBankHolidays();

    expect(dates).toEqual(["2025-12-25"]);
  });

  it("returns an empty array when fetch fails and there is no cache", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    }) as unknown as typeof fetch;

    const dates = await getBankHolidays();

    expect(dates).toEqual([]);
  });
});
