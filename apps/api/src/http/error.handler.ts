import type { FastifyReply, FastifyRequest } from "fastify";
import { invalidDataResult } from "../shared/result.js";
import { sendResult } from "./result.response.js";

export function handleError(error: { code?: string; message: string }, request: FastifyRequest, reply: FastifyReply) {
  // Body-parsing failures (malformed or empty JSON, unsupported content type) are bad input, not server errors.
  if (error.code?.startsWith("FST_ERR_CTP_")) {
    return sendResult(reply, invalidDataResult([{ path: "", message: error.message }]));
  }
  request.log.error(error);
  return reply.code(500).send({ error: { code: "internal_error", message: "Something went wrong." } });
}

export function handleNotFound(request: FastifyRequest, reply: FastifyReply) {
  return reply
    .code(404)
    .send({ error: { code: "not_found", message: `Route ${request.method} ${request.url} does not exist.` } });
}

// Errors raised while routing, before any handler runs: malformed percent-encoding, over-long path params.
export function handleFrameworkError(
  error: { statusCode?: number; message: string },
  _request: FastifyRequest,
  reply: FastifyReply,
) {
  return reply.code(error.statusCode ?? 400).send({ error: { code: "bad_request", message: error.message } });
}
