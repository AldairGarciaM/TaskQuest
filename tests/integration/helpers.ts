import { hash } from "bcryptjs";

import { prisma } from "@/lib/prisma";

interface SessionUser {
  id: string;
  name: string;
  email: string;
}

export const currentUser: { value: SessionUser | null } = { value: null };

export function signInAs(user: SessionUser) {
  currentUser.value = user;
}

export function signOut() {
  currentUser.value = null;
}

let counter = 0;

/** Creates a user directly in the database and returns its session shape. */
export async function createUser(overrides: { name?: string; email?: string; xp?: number } = {}) {
  counter++;
  const user = await prisma.user.create({
    data: {
      name: overrides.name ?? `Tester ${counter}`,
      email: overrides.email ?? `tester${counter}-${Date.now()}@taskquest.test`,
      // Low cost keeps tests fast; production uses cost 12.
      passwordHash: await hash("Secreta123", 4),
      xp: overrides.xp ?? 0,
    },
    select: { id: true, name: true, email: true },
  });
  return user;
}

export async function createSignedInUser(overrides?: Parameters<typeof createUser>[0]) {
  const user = await createUser(overrides);
  signInAs(user);
  return user;
}

/**
 * Pre-creates today's daily missions with unreachable targets so they never pay a bonus.
 * Use in tests that assert exact XP from tasks alone.
 */
export async function neutralizeDailyMissions(userId: string) {
  const { dayKey } = await import("@/lib/dates");
  const { pickDailyTypes } = await import("@/lib/gamification/daily");
  const day = dayKey(new Date());
  await prisma.dailyMission.createMany({
    data: pickDailyTypes(userId, day).map((type) => ({ userId, day, type, target: 1_000_000, xpReward: 0 })),
    skipDuplicates: true,
  });
}
