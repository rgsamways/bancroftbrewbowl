// The e2e suite creates and deletes real rows, so it must only ever run against a
// database on this machine (or the CI job's own Postgres service). Checked when the
// config loads, before any server starts or any row is written.

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function assertLocalDatabase(databaseUrl: string | undefined): void {
  if (!databaseUrl) {
    throw new Error("e2e: DATABASE_URL is not set (expected in apps/api/.env or the environment). Refusing to run.");
  }
  let host: string;
  try {
    host = new URL(databaseUrl).hostname;
  } catch {
    throw new Error("e2e: DATABASE_URL is not a valid URL. Refusing to run.");
  }
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(`e2e: DATABASE_URL points at "${host}", which is not a local database. These tests write data, so they only run against localhost. Refusing to run.`);
  }
}
