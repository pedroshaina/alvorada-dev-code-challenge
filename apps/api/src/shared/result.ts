import type { ErrorCode } from "./errors.types.js";
import type { Result } from "./result.types.js";

export const successResult = <T>(value: T): Result<T> => ({ ok: true, value });

export const failureResult = <T = never>(code: ErrorCode, message: string, details?: unknown): Result<T> => ({
  ok: false,
  error: details === undefined ? { code, message } : { code, message, details },
});
