import { describe, expect, it } from "vitest";

import { safeCallbackUrl } from "@/lib/safe-redirect";

describe("safeCallbackUrl", () => {
  it("keeps same-origin relative paths", () => {
    expect(safeCallbackUrl("/logros?tab=1")).toBe("/logros?tab=1");
  });

  it.each([
    ["absolute URL", "https://evil.com"],
    ["protocol-relative URL", "//evil.com"],
    ["backslash trick", "/\\evil.com"],
    ["auth page loop", "/auth/login"],
    ["missing value", undefined],
    ["non-string value", ["/a"]],
  ])("falls back to / for %s", (_, value) => {
    expect(safeCallbackUrl(value)).toBe("/");
  });
});
