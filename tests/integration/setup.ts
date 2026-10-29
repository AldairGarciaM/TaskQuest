import { afterAll, beforeEach, vi } from "vitest";

import { getTestDatabaseUrl } from "./test-db";

// Must run before anything imports @/lib/prisma.
process.env.DATABASE_URL = getTestDatabaseUrl();

// Server Actions call revalidatePath, which needs a Next.js request context.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// Server Actions read the client IP; tests set it with setClientIp() from ./helpers.
vi.mock("next/headers", async () => {
  const { requestHeaders } = await import("./helpers");
  return { headers: vi.fn(async () => new Headers(requestHeaders.value)) };
});

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
  const { setClientIp, signOut } = await import("./helpers");
  signOut();
  setClientIp(null);
  // Cascades to every table that references User or Organization.
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "User", "Organization", "RateLimit" CASCADE');
});

afterAll(async () => {
  const { prisma } = await import("@/lib/prisma");
  await prisma.$disconnect();
});
