import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Guards against a silent gap in the record of admin changes: every route that writes data
// and requires an admin must call `recordActivity`. Add a new admin write route without a
// record and this fails. Read-only routes are not checked.

/** Admin write routes in a source file that never call `recordActivity`, as "METHOD /path". */
export function findUnrecordedAdminWrites(source: string): string[] {
  const routePattern = /fastify\.(get|post|put|patch|delete)\(\s*"([^"]+)"/g;
  const starts = [...source.matchAll(routePattern)];
  const missing: string[] = [];
  starts.forEach((match, i) => {
    const [, method, url] = match;
    if (method === "get") return;
    const end = starts[i + 1]?.index ?? source.length;
    const body = source.slice(match.index, end);
    if (body.includes("requireAdmin(") && !body.includes("recordActivity(")) {
      missing.push(`${method!.toUpperCase()} ${url}`);
    }
  });
  return missing;
}

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    // Test support (src/test) may clear its own test records; the app itself never does.
    if (entry.isDirectory()) return entry.name === "test" ? [] : sourceFiles(full);
    return full.endsWith(".ts") && !full.endsWith(".test.ts") ? [full] : [];
  });
}

describe("the record of admin changes has no silent gaps", () => {
  it("every admin write route in the app writes a record", () => {
    const routesDir = path.join(SRC, "routes");
    const missing = fs
      .readdirSync(routesDir)
      .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
      .flatMap((f) => findUnrecordedAdminWrites(fs.readFileSync(path.join(routesDir, f), "utf8")).map((r) => `${f}: ${r}`));
    expect(missing).toEqual([]);
  });

  it("the checker really does catch a route left without a record", () => {
    const withRecord = `
      fastify.post("/a", async (request, reply) => { const s = await requireAdmin(request, reply); await recordActivity(db, s); });
      fastify.get("/b", async (request, reply) => { await requireAdmin(request, reply); });
    `;
    expect(findUnrecordedAdminWrites(withRecord)).toEqual([]);

    const forgotten = `
      fastify.post("/a", async (request, reply) => { await requireAdmin(request, reply); await recordActivity(db, s); });
      fastify.patch("/forgotten/:id", async (request, reply) => { await requireAdmin(request, reply); await db.update(x); });
      fastify.delete("/also", async (request, reply) => { if (!(await requireAdmin(request, reply))) return; });
      fastify.post("/player-route", async (request, reply) => { await requireSession(request, reply); });
    `;
    expect(findUnrecordedAdminWrites(forgotten)).toEqual(["PATCH /forgotten/:id", "DELETE /also"]);
  });

  it("no code in the app updates or deletes an activity record", () => {
    const offenders = sourceFiles(SRC).filter((file) =>
      /\b(update|delete)\(\s*adminActivity\b/.test(fs.readFileSync(file, "utf8"))
    );
    expect(offenders.map((f) => path.relative(SRC, f))).toEqual([]);
  });
});
