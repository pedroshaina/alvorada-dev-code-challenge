import type { ApiResult } from "../types/api.types.js";

export const isAbortError = (error: unknown) => error instanceof DOMException && error.name === "AbortError";

export async function request<T>(path: string, init: RequestInit = {}): Promise<ApiResult<T>> {
  try {
    const response = await fetch(`/api${path}`, {
      ...init,
      headers: init.body ? { "content-type": "application/json" } : undefined,
    });
    const body = await response.json();
    return response.ok ? { ok: true, data: body as T } : { ok: false, error: body.error };
  } catch (error) {
    if (isAbortError(error)) throw error;
    return { ok: false, error: { code: "network", message: "Could not reach the API. Is it running?" } };
  }
}
