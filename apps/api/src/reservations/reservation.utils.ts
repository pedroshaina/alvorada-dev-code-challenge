import { failureResult } from "../shared/result.js";
import type { Reservation } from "./reservation.types.js";

type Interval = { start: number; end: number };

export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

export const byId = (a: Reservation, b: Reservation) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export type ValidationIssue = { path: string; message: string };

export const invalidDataResult = (issues: ValidationIssue[]) =>
  failureResult("invalid_data", "The request data is invalid.", { issues });

export const invalidIntervalResult = () => invalidDataResult([{ path: "end", message: "start must be before end" }]);
