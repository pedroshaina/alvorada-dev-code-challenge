export type ErrorCode =
  | "invalid_data"
  | "resource_not_found"
  | "reservation_not_found"
  | "id_already_used"
  | "conflict";

export type DomainError = { code: ErrorCode; message: string; details?: unknown };
