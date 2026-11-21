import type { ZodType } from "zod";
import { invalidDataResult, successResult } from "../shared/result.js";
import type { Result } from "../shared/result.types.js";

export function parseInput<T>(schema: ZodType<T>, input: unknown): Result<T> {
  const parsed = schema.safeParse(input);
  if (parsed.success) return successResult(parsed.data);
  return invalidDataResult(parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
}
