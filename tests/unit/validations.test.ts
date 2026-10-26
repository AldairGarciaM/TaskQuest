import { describe, expect, it } from "vitest";

import { loginSchema, registerSchema } from "@/lib/validations/auth";
import { taskInputSchema } from "@/lib/validations/task";

describe("registerSchema", () => {
  it("normalizes the email and trims the name", () => {
    const result = registerSchema.parse({ name: "  Ada  ", email: "  Ada@Example.COM ", password: "12345678" });
    expect(result).toEqual({ name: "Ada", email: "ada@example.com", password: "12345678" });
  });

  it.each([
    ["short name", { name: "A", email: "a@b.co", password: "12345678" }, "name"],
    ["invalid email", { name: "Ada", email: "not-an-email", password: "12345678" }, "email"],
    ["short password", { name: "Ada", email: "a@b.co", password: "1234567" }, "password"],
    ["password over bcrypt's limit", { name: "Ada", email: "a@b.co", password: "x".repeat(73) }, "password"],
  ])("rejects %s", (_, input, field) => {
    const result = registerSchema.safeParse(input);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path[0])).toContain(field);
  });
});

describe("loginSchema", () => {
  it("requires a password", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
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
