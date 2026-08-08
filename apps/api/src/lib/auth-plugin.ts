import type { FastifyInstance } from "fastify";
import { auth } from "../auth.js";
import { toWebRequest } from "./to-web-request.js";

export async function authPlugin(fastify: FastifyInstance) {
  fastify.route({
    method: ["GET", "POST"],
    url: "/api/auth/*",
    async handler(request, reply) {
      const response = await auth.handler(toWebRequest(request));
      reply.status(response.status);
      response.headers.forEach((value, key) => reply.header(key, value));
      const text = await response.text();
      reply.send(text || null);
    },
  });
}

export async function getSession(request: import("fastify").FastifyRequest) {
  return auth.api.getSession({ headers: toWebRequest(request).headers });
}
