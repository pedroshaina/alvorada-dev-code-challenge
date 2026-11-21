import type { DomainError } from "./errors.types.js";

export type Result<T> = { ok: true; value: T } | { ok: false; error: DomainError };
