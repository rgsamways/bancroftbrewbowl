import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { authPlugin } from "./lib/auth-plugin.js";
import { poolRoutes } from "./routes/pools.js";
import { entryRoutes } from "./routes/entries.js";
import { nflRoutes } from "./routes/nfl.js";
import { pickRoutes } from "./routes/picks.js";
import { wipeoutRoutes } from "./routes/wipeouts.js";
import { promotionRoutes } from "./routes/promotions.js";

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
await fastify.register(promotionRoutes);

fastify.get("/health", async () => ({ ok: true }));

const port = Number(process.env.PORT ?? 3001);
await fastify.listen({ port, host: "0.0.0.0" });
