import { describe, expect, it } from "vitest";

import { loginSchema, registerSchema } from "@/lib/validations/auth";
import { taskInputSchema } from "@/lib/validations/task";

describe("registerSchema", () => {
  const valid = { firstName: "Ada", lastName: "Lovelace", username: "ada", email: "a@b.co", password: "12345678" };

  it("normalizes the email and username and trims names", () => {
    const result = registerSchema.parse({
      firstName: "  Ada  ",
      lastName: " Lovelace ",
      username: " Ada.L ",
      email: "  Ada@Example.COM ",
      password: "12345678",
    });
    expect(result).toEqual({
      firstName: "Ada",
      lastName: "Lovelace",
      username: "ada.l",
      email: "ada@example.com",
      password: "12345678",
    });
  });

  it.each([
    ["short first name", { firstName: "A" }, "firstName"],
    ["missing last name", { lastName: "" }, "lastName"],
    ["username with spaces", { username: "ada l" }, "username"],
    ["username too short", { username: "ad" }, "username"],
    ["username with symbols", { username: "ada!" }, "username"],
    ["invalid email", { email: "not-an-email" }, "email"],
    ["short password", { password: "1234567" }, "password"],
    ["password over bcrypt's limit", { password: "x".repeat(73) }, "password"],
  ])("rejects %s", (_, override, field) => {
    const result = registerSchema.safeParse({ ...valid, ...override });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path[0])).toContain(field);
  });
});

describe("loginSchema", () => {
  it("requires a password", () => {
    expect(loginSchema.safeParse({ identifier: "ada", password: "" }).success).toBe(false);
  });

  it("normalizes the identifier", () => {
    expect(loginSchema.parse({ identifier: " Ada ", password: "x" }).identifier).toBe("ada");
  });
});

describe("taskInputSchema", () => {
  it("turns empty optional fields into undefined", () => {
    expect(taskInputSchema.parse({ title: " Leer ", description: "", difficulty: "EASY", dueDate: "" })).toEqual({
      title: "Leer",
      description: undefined,
      difficulty: "EASY",
      dueDate: undefined,
    });
  });

  it("drops unknown fields such as xpReward or userId", () => {
    const parsed = taskInputSchema.parse({ title: "Leer", difficulty: "EASY", xpReward: 9999, userId: "other" });
    expect(parsed).not.toHaveProperty("xpReward");
    expect(parsed).not.toHaveProperty("userId");
  });

  it.each([
    ["blank title", { title: "   ", difficulty: "EASY" }],
    ["unknown difficulty", { title: "Leer", difficulty: "LEGENDARY" }],
    ["invalid date", { title: "Leer", difficulty: "EASY", dueDate: "2026-13-45" }],
    ["title too long", { title: "x".repeat(121), difficulty: "EASY" }],
  ])("rejects %s", (_, input) => {
    expect(taskInputSchema.safeParse(input).success).toBe(false);
  });
});
