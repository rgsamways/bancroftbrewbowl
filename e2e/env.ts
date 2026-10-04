import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Fixed private ports: 3001 and 5173 belong to other projects on this machine.
export const API_PORT = 3011;
export const WEB_PORT = 5183;
export const API_URL = `http://localhost:${API_PORT}`;
export const WEB_URL = `http://localhost:${WEB_PORT}`;

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** DATABASE_URL from the environment (CI), else from apps/api/.env (local dev). */
export function databaseUrl(): string | undefined {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const file = path.join(ROOT, "apps", "api", ".env");
  if (!fs.existsSync(file)) return undefined;
  const match = fs.readFileSync(file, "utf8").match(/^DATABASE_URL=(.*)$/m);
  return match?.[1].trim().replace(/^"|"$/g, "");
}
