import Fastify, { type FastifyInstance } from "fastify";
import { vi } from "vitest";
import { getSession } from "../lib/auth-plugin.js";
import { entryRoutes } from "../routes/entries.js";
import { adminSummaryRoutes } from "../routes/admin-summary.js";
import { adminRequestRoutes } from "../routes/admin-requests.js";
import { menuRoutes } from "../routes/menu.js";
import { musicRoutes } from "../routes/music.js";
import { activityRoutes } from "../routes/activity.js";
import { cannedPromotionRoutes } from "../routes/canned-promotions.js";
import { nflRoutes } from "../routes/nfl.js";
import { breweryRoutes } from "../routes/brewery.js";
import { wipeoutRoutes } from "../routes/wipeouts.js";
import { standingsRoutes } from "../routes/standings.js";
import { tvRoutes } from "../routes/tv.js";
import { recapRoutes } from "../routes/recap.js";
import { homeRoutes } from "../routes/home.js";
import { passwordRoutes } from "../routes/password.js";
import { pickRoutes } from "../routes/picks.js";
import { poolRoutes } from "../routes/pools.js";

// Route tests run the real route code against the real test database, with only
// the "who is signed in" lookup replaced. A test file that uses this harness must
// mock the session module at the top of the file (vitest hoists it):
//
//   vi.mock("../lib/auth-plugin.js", () => ({ getSession: vi.fn(), authPlugin: async () => {} }));
//
// then call `actAs(...)` before each request.

export type TestActor = { id: string; name: string; email: string; isAdmin?: boolean | null } | null;

/** Builds a Fastify app with the routes under test, without the real sign-in
 * plugin and without listening on a port. Use `app.inject(...)` to call it. */
export async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify();
  await app.register(poolRoutes);
  await app.register(entryRoutes);
  await app.register(pickRoutes);
  await app.register(passwordRoutes);
  await app.register(homeRoutes);
  await app.register(standingsRoutes);
  await app.register(tvRoutes);
  await app.register(recapRoutes);
  await app.register(activityRoutes);
  await app.register(adminSummaryRoutes);
  await app.register(adminRequestRoutes);
  await app.register(menuRoutes);
  await app.register(musicRoutes);
  await app.register(nflRoutes);
  await app.register(wipeoutRoutes);
  await app.register(breweryRoutes);
  await app.register(cannedPromotionRoutes);
  await app.ready();
  return app;
}

/** Sets who the next requests are made as. `null` means signed out. */
export function actAs(actor: TestActor) {
  vi.mocked(getSession).mockResolvedValue(
    actor
      ? ({
          user: { id: actor.id, name: actor.name, email: actor.email, isAdmin: actor.isAdmin ?? false },
          session: { id: "test-session", userId: actor.id },
        } as never)
      : null
  );
}
