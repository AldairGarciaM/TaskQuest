import { describe, expect, it } from "vitest";

import { createTask, deleteTask, setTaskCompleted, updateTask } from "@/app/actions/tasks";
import { prisma } from "@/lib/prisma";

import {
  createSignedInUser as createSignedInUserWithDailies,
  createUser,
  neutralizeDailyMissions,
  signInAs,
  signOut,
} from "./helpers";

// These tests assert XP from tasks alone, so daily mission bonuses are switched off.
async function createSignedInUser() {
  const user = await createSignedInUserWithDailies();
  await neutralizeDailyMissions(user.id);
  return user;
}

async function newTask(input: Record<string, unknown>) {
  const result = await createTask(input);
  expect(result.ok).toBe(true);
  return prisma.task.findFirstOrThrow({ where: { title: input.title as string }, orderBy: { createdAt: "desc" } });
}

const userXp = (id: string) =>
  prisma.user.findUniqueOrThrow({ where: { id }, select: { xp: true, level: true } });

describe("createTask", () => {
  it("sets the XP reward on the server and ignores client-sent fields", async () => {
    const user = await createSignedInUser();
    const other = await createUser();

    await newTask({ title: "Reporte", difficulty: "HARD", dueDate: "2026-11-02", xpReward: 99999, userId: other.id });

    const task = await prisma.task.findFirstOrThrow({ where: { title: "Reporte" } });
    expect(task).toMatchObject({ userId: user.id, xpReward: 50, status: "PENDING" });
    expect(task.dueDate?.toISOString()).toBe("2026-11-02T00:00:00.000Z");
  });

  it("returns field errors for invalid input", async () => {
    await createSignedInUser();
    const result = await createTask({ title: " ", difficulty: "LEGENDARY" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.fieldErrors ?? {})).toEqual(["title", "difficulty"]);
    expect(await prisma.task.count()).toBe(0);
  });

  it("requires a session", async () => {
    signOut();
    await expect(createTask({ title: "Sin sesión", difficulty: "EASY" })).rejects.toThrow(/NEXT_REDIRECT/);
    expect(await prisma.task.count()).toBe(0);
  });
});

describe("setTaskCompleted", () => {
  it("awards XP once and levels up", async () => {
    const user = await createSignedInUser();
    const hard = await newTask({ title: "Difícil", difficulty: "HARD" });
    const epic = await newTask({ title: "Épica", difficulty: "EPIC" });

    expect(await setTaskCompleted(hard.id, true)).toMatchObject({ ok: true, xpDelta: 50, level: 1, leveledUp: false });
    expect(await setTaskCompleted(hard.id, true)).toMatchObject({ ok: true, xpDelta: 0 });
    expect(await setTaskCompleted(epic.id, true)).toMatchObject({ ok: true, xpDelta: 100, level: 2, leveledUp: true });

    expect(await userXp(user.id)).toEqual({ xp: 150, level: 2 });
    const completed = await prisma.task.findUniqueOrThrow({ where: { id: hard.id } });
    expect(completed.status).toBe("COMPLETED");
    expect(completed.completedAt).toBeInstanceOf(Date);
  });

  it("does not award XP twice for concurrent completions", async () => {
    const user = await createSignedInUser();
    const task = await newTask({ title: "Doble clic", difficulty: "EPIC" });

    const results = await Promise.all([setTaskCompleted(task.id, true), setTaskCompleted(task.id, true)]);

    const total = results.reduce((sum, r) => sum + (r.ok ? r.xpDelta : 0), 0);
    expect(total).toBe(100);
    expect((await userXp(user.id)).xp).toBe(100);
  });

  it("takes the XP back when a task is marked as pending again", async () => {
    const user = await createSignedInUser();
    const task = await newTask({ title: "Ida y vuelta", difficulty: "EPIC" });

    await setTaskCompleted(task.id, true);
    expect(await setTaskCompleted(task.id, false)).toMatchObject({ ok: true, xpDelta: -100, level: 1 });

    expect(await userXp(user.id)).toEqual({ xp: 0, level: 1 });
    expect((await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).completedAt).toBeNull();
  });

  it("rejects non-boolean values", async () => {
    await createSignedInUser();
    const task = await newTask({ title: "Tipos", difficulty: "EASY" });
    expect((await setTaskCompleted(task.id, "true")).ok).toBe(false);
  });
});

describe("updateTask", () => {
  it("recalculates the reward of a pending task", async () => {
    await createSignedInUser();
    const task = await newTask({ title: "Editar", difficulty: "HARD", dueDate: "2026-11-02" });

    expect(await updateTask(task.id, { title: "Editada", difficulty: "MEDIUM", dueDate: "" })).toEqual({ ok: true });

    expect(await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).toMatchObject({
      title: "Editada",
      difficulty: "MEDIUM",
      xpReward: 25,
      dueDate: null,
    });
  });

  it("does not let a completed task change difficulty", async () => {
    await createSignedInUser();
    const task = await newTask({ title: "Cobrada", difficulty: "EPIC" });
    await setTaskCompleted(task.id, true);

    const result = await updateTask(task.id, { title: "Cobrada", difficulty: "EASY" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors?.difficulty).toBeDefined();

    expect(await updateTask(task.id, { title: "Renombrada", difficulty: "EPIC" })).toEqual({ ok: true });
  });
});

describe("deleteTask", () => {
  it("keeps XP already earned", async () => {
    const user = await createSignedInUser();
    const task = await newTask({ title: "Borrar", difficulty: "HARD" });
    await setTaskCompleted(task.id, true);

    expect(await deleteTask(task.id)).toEqual({ ok: true });
    expect(await prisma.task.count()).toBe(0);
    expect((await userXp(user.id)).xp).toBe(50);
    expect((await deleteTask(task.id)).ok).toBe(false);
  });
});

describe("ownership", () => {
  it("never lets a user read or change another user's tasks", async () => {
    const owner = await createSignedInUser();
    const task = await newTask({ title: "Privada", difficulty: "HARD" });

    const intruder = await createUser();
    signInAs(intruder);

    expect((await setTaskCompleted(task.id, true)).ok).toBe(false);
    expect((await updateTask(task.id, { title: "pwned", difficulty: "EPIC" })).ok).toBe(false);
    expect((await deleteTask(task.id)).ok).toBe(false);

    expect(await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).toMatchObject({
      title: "Privada",
      status: "PENDING",
      userId: owner.id,
    });
    expect((await userXp(intruder.id)).xp).toBe(0);
  });
});
