import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { authPlugin } from "./lib/auth-plugin.js";
import { poolRoutes } from "./routes/pools.js";
import { entryRoutes } from "./routes/entries.js";
import { nflRoutes } from "./routes/nfl.js";
import { pickRoutes } from "./routes/picks.js";
import { wipeoutRoutes } from "./routes/wipeouts.js";
import { breweryRoutes } from "./routes/brewery.js";
import { adminSummaryRoutes } from "./routes/admin-summary.js";
import { adminRequestRoutes } from "./routes/admin-requests.js";
import { menuRoutes } from "./routes/menu.js";
import { musicRoutes } from "./routes/music.js";
import { activityRoutes } from "./routes/activity.js";
import { standingsRoutes } from "./routes/standings.js";
import { tvRoutes } from "./routes/tv.js";
import { recapRoutes } from "./routes/recap.js";
import { homeRoutes } from "./routes/home.js";
import { passwordRoutes } from "./routes/password.js";
import { cannedPromotionRoutes } from "./routes/canned-promotions.js";

const fastify = Fastify({ logger: true });

await fastify.register(cors, {
  origin: process.env.DASHBOARD_URL ?? "http://localhost:5173",
  credentials: true,
});

await fastify.register(authPlugin);

await fastify.register(poolRoutes);
await fastify.register(entryRoutes);
await fastify.register(nflRoutes);
await fastify.register(pickRoutes);
await fastify.register(wipeoutRoutes);
await fastify.register(breweryRoutes);
await fastify.register(cannedPromotionRoutes);
await fastify.register(passwordRoutes);
await fastify.register(homeRoutes);
await fastify.register(standingsRoutes);
await fastify.register(tvRoutes);
await fastify.register(recapRoutes);
await fastify.register(activityRoutes);
await fastify.register(adminSummaryRoutes);
await fastify.register(adminRequestRoutes);
await fastify.register(menuRoutes);
await fastify.register(musicRoutes);

fastify.get("/health", async () => ({ ok: true }));

const port = Number(process.env.PORT ?? 3001);
await fastify.listen({ port, host: "0.0.0.0" });
