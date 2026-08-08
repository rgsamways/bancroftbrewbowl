import type { FastifyRequest } from "fastify";

export function toWebRequest(request: FastifyRequest): Request {
  const url = `${request.protocol}://${request.headers.host}${request.url}`;

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
