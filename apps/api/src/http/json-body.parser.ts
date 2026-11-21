import type { FastifyInstance } from "fastify";

// Many clients send `Content-Type: application/json` on body-less POSTs (e.g. cancel); treat an empty
// body as no body instead of a parse error. Non-empty bodies keep Fastify's default (safe) JSON parser.
export function registerJsonBodyParser(app: FastifyInstance) {
  const defaultJsonParser = app.getDefaultJsonParser("error", "error");
  app.removeContentTypeParser("application/json");
  app.addContentTypeParser("application/json", { parseAs: "string" }, (request, body, done) => {
    const text = body.toString();
    if (text === "") return done(null, undefined);
    return defaultJsonParser(request, text, done);
  });
}
