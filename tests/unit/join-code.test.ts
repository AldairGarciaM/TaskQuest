import { describe, expect, it } from "vitest";

import { formatJoinCode, JOIN_CODE_ALPHABET, JOIN_CODE_LENGTH } from "@/lib/organizations/join-code";
import { createJoinCode } from "@/lib/organizations/tokens";
import { joinCodeSchema } from "@/lib/validations/organization";

describe("createJoinCode", () => {
  it("uses only unambiguous characters", () => {
    const codes = Array.from({ length: 200 }, createJoinCode);
    for (const code of codes) {
      expect(code).toHaveLength(JOIN_CODE_LENGTH);
      expect([...code].every((char) => JOIN_CODE_ALPHABET.includes(char))).toBe(true);
    }
    expect(JOIN_CODE_ALPHABET).not.toMatch(/[0O1IL]/);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("formats with a hyphen in the middle", () => {
    expect(formatJoinCode("ABCD2345")).toBe("ABCD-2345");
  });
});

describe("joinCodeSchema", () => {
  it("accepts any case, spaces and the hyphen", () => {
    expect(joinCodeSchema.parse("abcd-2345")).toBe("ABCD2345");
    expect(joinCodeSchema.parse("  AbCd 2345 ")).toBe("ABCD2345");
  });

  it("rejects empty, short and ambiguous codes", () => {
    expect(joinCodeSchema.safeParse("").success).toBe(false);
    expect(joinCodeSchema.safeParse("ABCD-234").success).toBe(false);
    expect(joinCodeSchema.safeParse("ABCD-2340").success).toBe(false);
    expect(joinCodeSchema.safeParse("ABCD-23456").success).toBe(false);
  });
});
