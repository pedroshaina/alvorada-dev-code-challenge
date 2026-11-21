import { z } from "zod";
import { time } from "../http/time.schemas.js";

export const createReservationBodySchema = z
  .object({
    id: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, "id must be 1-64 letters, digits, '_' or '-'"),
    resource: z.string().min(1),
    start: time,
    end: time,
  })
  .strict();

export const listQuerySchema = z
  .object({
    status: z.enum(["active", "canceled"]).optional(),
    resource: z.string().min(1).optional(),
  })
  .strict();
