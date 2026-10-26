import { afterAll, beforeEach, vi } from "vitest";

import { getTestDatabaseUrl } from "./test-db";

// Must run before anything imports @/lib/prisma.
process.env.DATABASE_URL = getTestDatabaseUrl();

// Server Actions call revalidatePath, which needs a Next.js request context.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// Tests choose the signed-in user with signInAs()/signOut() from ./helpers.
vi.mock("@/lib/session", async () => {
  const { currentUser } = await import("./helpers");
  return {
    requireUser: vi.fn(async () => {
      if (!currentUser.value) throw new Error("NEXT_REDIRECT: /auth/login");
      return currentUser.value;
    }),
  };
});

beforeEach(async () => {
  const { prisma } = await import("@/lib/prisma");
  const { signOut } = await import("./helpers");
  signOut();
  // Cascades to every table that references User.
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "User" CASCADE');
});

afterAll(async () => {
  const { prisma } = await import("@/lib/prisma");
  await prisma.$disconnect();
});
