import { config } from "@/shared/config/env";
import { handleLocalFallback } from "./localFallback";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    const res = await fetch(`${config.apiBaseUrl}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
    if (res.ok) {
      const ct = res.headers.get("content-type") ?? "";
      if (ct.includes("application/json")) {
        return (await res.json()) as T;
      }
      // Static host (e.g. Netlify SPA fallback) returned HTML instead of JSON API
      const parsedBody = init?.body ? JSON.parse(String(init.body)) : undefined;
      return await handleLocalFallback<T>(path, parsedBody);
    }
    if (res.status === 404 || res.status >= 500) {
      const parsedBody = init?.body ? JSON.parse(String(init.body)) : undefined;
      return await handleLocalFallback<T>(path, parsedBody);
    }
    throw new ApiError(res.status, await errorDetail(res));
  } catch (err) {
    if (err instanceof ApiError) throw err;
    const parsedBody = init?.body ? JSON.parse(String(init.body)) : undefined;
    return await handleLocalFallback<T>(path, parsedBody);
  }
}

/** FastAPI responde {"detail": "..."}; si no, se usa el estado HTTP. */
async function errorDetail(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { detail?: unknown };
    if (typeof body.detail === "string") return body.detail;
  } catch {
    // cuerpo vacío o no JSON
  }
  return `${res.status} ${res.statusText}`;
}

/** Único punto de salida HTTP del frontend. */
export const http = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
};
