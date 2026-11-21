import { z } from "zod";
import { timeParam } from "../http/time.schemas.js";

export const availabilityQuerySchema = z.object({ start: timeParam, end: timeParam }).strict();
