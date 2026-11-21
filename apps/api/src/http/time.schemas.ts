import { z } from "zod";

const INT32_MIN = -2147483648;
const INT32_MAX = 2147483647;

export const time = z.number().int().min(INT32_MIN).max(INT32_MAX);

// Query strings arrive as text; only plain integer strings become numbers, anything else (including
// repeated params, which arrive as arrays) is left as-is so the time schema rejects it.
export const timeParam = z.preprocess((v) => (typeof v === "string" && /^-?\d+$/.test(v) ? Number(v) : v), time);
