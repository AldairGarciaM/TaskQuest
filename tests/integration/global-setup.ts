import { execSync } from "node:child_process";

import { Client } from "pg";

import { getTestDatabaseUrl } from "./test-db";

/** Creates the test database if needed and applies all migrations to it. */
export default async function setup() {
  const testUrl = new URL(getTestDatabaseUrl());
  const dbName = testUrl.pathname.slice(1);

  const adminUrl = new URL(testUrl);
  adminUrl.pathname = "/postgres";
  adminUrl.search = "";

  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    const { rowCount } = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
    if (!rowCount) await admin.query(`CREATE DATABASE "${dbName.replaceAll('"', '""')}"`);
  } finally {
    await admin.end();
  }

  execSync("pnpm exec prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: testUrl.toString() },
    stdio: "pipe",
  });
}
