import { beforeEach, describe, expect, it, vi } from "vitest";

const MockRedis = vi.hoisted(() => vi.fn());

vi.mock("@upstash/redis", () => ({
  Redis: MockRedis,
}));

describe("getRedis", () => {
  beforeEach(() => {
    MockRedis.mockClear();
    MockRedis.mockImplementation(function (this: object, opts: { url: string; token: string }) {
      Object.assign(this, opts);
    });
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  it("returns null when URL or token is missing", async () => {
    const { getRedis } = await import("./redis");
    expect(getRedis()).toBeNull();
    expect(MockRedis).not.toHaveBeenCalled();
  });

  it("returns a Redis client when URL and token are set", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "secret";

    const { getRedis } = await import("./redis");
    const client = getRedis();

    expect(client).not.toBeNull();
    expect(client).toMatchObject({
      url: "https://example.upstash.io",
      token: "secret",
    });
    expect(MockRedis).toHaveBeenCalledWith({
      url: "https://example.upstash.io",
      token: "secret",
    });
  });
});
