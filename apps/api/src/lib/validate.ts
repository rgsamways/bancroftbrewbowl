import type { ZodSchema } from "zod";
import type { FastifyReply } from "fastify";

export function parseBody<T>(schema: ZodSchema<T>, body: unknown, reply: FastifyReply): T | null {
  const result = schema.safeParse(body);
  if (!result.success) {
    reply.status(400).send({ error: "Invalid request body", details: result.error.flatten() });
    return null;
  }
  return result.data;
}
