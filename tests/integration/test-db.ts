import "dotenv/config";

/**
 * Integration tests run against a separate database so they never touch dev data.
 * Uses TEST_DATABASE_URL, or DATABASE_URL with the database name suffixed with `_test`.
 */
export function getTestDatabaseUrl(): string {
  const explicit = process.env.TEST_DATABASE_URL;
  const base = explicit ?? process.env.DATABASE_URL;
  if (!base) throw new Error("Set DATABASE_URL or TEST_DATABASE_URL to run integration tests.");

  const url = new URL(base);
  if (!explicit) url.pathname = `${url.pathname}_test`;

  const dbName = url.pathname.slice(1);
  if (!dbName.endsWith("_test")) {
    throw new Error(`Refusing to run tests against "${dbName}": the database name must end in _test.`);
  }
  return url.toString();
}
