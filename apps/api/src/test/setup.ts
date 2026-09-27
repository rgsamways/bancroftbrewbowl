import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";

// vitest runs from the repo root, so the default dotenv/config cwd lookup
// wouldn't find this — apps/api/.env, same file `pnpm dev:api` reads.
config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../.env") });
