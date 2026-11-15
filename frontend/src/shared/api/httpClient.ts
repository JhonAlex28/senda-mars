import { config } from "@/shared/config/env";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${config.apiBaseUrl}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    throw new ApiError(res.status, await errorDetail(res));
  }
  return (await res.json()) as T;
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
