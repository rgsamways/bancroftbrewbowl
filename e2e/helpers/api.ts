import type { Page } from "@playwright/test";
import { API_URL } from "../env";

export interface ApiResult<T = unknown> {
  status: number;
  json: T | null;
}

/** Call the API from inside a signed-in page, so the real session cookie is used. */
export function apiCall<T = unknown>(page: Page, method: string, path: string, body?: unknown): Promise<ApiResult<T>> {
  return page.evaluate(
    async ([base, method, path, body]) => {
      const r = await fetch(base + path, {
        method,
        credentials: "include",
        headers: body ? { "content-type": "application/json" } : {},
        body: body ? JSON.stringify(body) : undefined,
      });
      let json = null;
      try {
        json = await r.json();
      } catch {
        /* no body */
      }
      return { status: r.status, json };
    },
    [API_URL, method, path, body] as [string, string, string, unknown]
  );
}
