import type { FastifyRequest } from "fastify";

export function toWebRequest(request: FastifyRequest): Request {
  // Behind Railway's proxy the app itself sees plain http. Use the protocol the client
  // used, so the URL matches BETTER_AUTH_URL (better-auth's rate limiter finds the
  // request path by stripping that base URL off the front).
  const forwardedProto = request.headers["x-forwarded-proto"];
  const protocol = (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto)?.split(",")[0]?.trim() || request.protocol;
  const url = `${protocol}://${request.headers.host}${request.url}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else {
      headers.append(key, value);
    }
  }

  const hasBody = request.method !== "GET" && request.method !== "HEAD";

  return new Request(url, {
    method: request.method,
    headers,
    body: hasBody && request.body ? JSON.stringify(request.body) : undefined,
  });
}
