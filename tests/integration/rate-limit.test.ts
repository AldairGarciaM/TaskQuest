import { describe, expect, it } from "vitest";

import { clearHits, clientIp, hit, isLimited, retryAfterLabel } from "@/lib/rate-limit";

const rule = { limit: 3, windowMs: 60_000 };
const at = (seconds: number) => new Date(Date.UTC(2026, 9, 29, 12, 0, seconds));

describe("hit", () => {
  it("allows up to the limit within a window and blocks after", async () => {
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await hit("k", rule, at(i)));

    expect(results.map((r) => [r.count, r.allowed])).toEqual([
      [1, true],
      [2, true],
      [3, true],
      [4, false],
    ]);
    // The window is anchored on the first hit.
    expect(results[3].resetAt).toEqual(at(60));
  });

  it("starts a new window once the old one ends", async () => {
    for (let i = 0; i < 4; i++) await hit("k", rule, at(0));
    expect(await hit("k", rule, at(60))).toEqual({ allowed: true, count: 1, resetAt: at(120) });
  });

  it("keeps keys apart", async () => {
    for (let i = 0; i < 4; i++) await hit("a", rule, at(0));
    expect((await hit("b", rule, at(0))).allowed).toBe(true);
  });

  it("never lets parallel hits past the limit", async () => {
    const results = await Promise.all(Array.from({ length: 10 }, () => hit("k", rule, at(0))));
    expect(results.filter((r) => r.allowed)).toHaveLength(3);
    expect(results.map((r) => r.count).sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});

describe("isLimited / clearHits", () => {
  it("reports a used-up window without counting", async () => {
    expect(await isLimited("k", rule, at(0))).toBe(false);
    for (let i = 0; i < 3; i++) await hit("k", rule, at(0));
    expect(await isLimited("k", rule, at(1))).toBe(true);
    expect(await isLimited("k", rule, at(1))).toBe(true);
    expect(await isLimited("k", rule, at(60))).toBe(false);

    await clearHits("k");
    expect(await isLimited("k", rule, at(1))).toBe(false);
  });
});

describe("retryAfterLabel", () => {
  it("rounds up to whole minutes, at least one", () => {
    expect(retryAfterLabel(at(30), at(0))).toBe("1 min");
    expect(retryAfterLabel(new Date(at(0).getTime() + 12 * 60_000 + 1), at(0))).toBe("13 min");
    expect(retryAfterLabel(at(0), at(5))).toBe("1 min");
  });
});

describe("clientIp", () => {
  it("prefers x-real-ip, then the first x-forwarded-for entry", () => {
    expect(clientIp(new Headers({ "x-real-ip": "1.1.1.1", "x-forwarded-for": "2.2.2.2" }))).toBe("1.1.1.1");
    expect(clientIp({ "x-forwarded-for": " 3.3.3.3 , 10.0.0.1" })).toBe("3.3.3.3");
    expect(clientIp({ "x-forwarded-for": ["4.4.4.4"] })).toBe("4.4.4.4");
    expect(clientIp({})).toBeNull();
    expect(clientIp(undefined)).toBeNull();
  });
});
