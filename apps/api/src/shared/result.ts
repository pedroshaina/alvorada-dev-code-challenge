import type { ErrorCode, ValidationIssue } from "./errors.types.js";
import type { Result } from "./result.types.js";

export const successResult = <T>(value: T): Result<T> => ({ ok: true, value });

export const failureResult = <T = never>(code: ErrorCode, message: string, details?: unknown): Result<T> => ({
  ok: false,
  error: details === undefined ? { code, message } : { code, message, details },
});

export const invalidDataResult = <T = never>(issues: ValidationIssue[]): Result<T> =>
  failureResult("invalid_data", "The request data is invalid.", { issues });
