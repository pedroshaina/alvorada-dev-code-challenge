import type { FastifyReply } from "fastify";
import type { ErrorCode } from "../shared/errors.types.js";
import type { Result } from "../shared/result.types.js";

const STATUS: Record<ErrorCode, number> = {
  invalid_data: 422,
  resource_not_found: 404,
  reservation_not_found: 404,
  id_already_used: 409,
  conflict: 409,
};

export const statusFor = (code: ErrorCode) => STATUS[code];

export function sendResult<T>(reply: FastifyReply, result: Result<T>, successStatus = 200) {
  if (result.ok) return reply.code(successStatus).send(result.value);
  return reply.code(statusFor(result.error.code)).send({ error: result.error });
}
