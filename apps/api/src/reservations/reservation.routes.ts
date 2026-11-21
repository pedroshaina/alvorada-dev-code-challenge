import type { FastifyInstance } from "fastify";
import { parseInput } from "../http/request.validation.js";
import { sendResult } from "../http/result.response.js";
import { createReservationBodySchema, listQuerySchema } from "./reservation.schemas.js";
import type { ReservationService } from "./reservation.service.js";

type IdParams = { Params: { id: string } };

export function registerReservationRoutes(app: FastifyInstance, service: ReservationService) {
  app.post("/reservations", async (request, reply) => {
    const input = parseInput(createReservationBodySchema, request.body);
    if (!input.ok) return sendResult(reply, input);
    return sendResult(reply, await service.create(input.value), 201);
  });

  app.post<IdParams>("/reservations/:id/cancel", async (request, reply) =>
    sendResult(reply, await service.cancel(request.params.id)),
  );

  app.get("/reservations", async (request, reply) => {
    const filter = parseInput(listQuerySchema, request.query);
    if (!filter.ok) return sendResult(reply, filter);
    return sendResult(reply, await service.list(filter.value));
  });

  app.get<IdParams>("/reservations/:id", async (request, reply) =>
    sendResult(reply, await service.get(request.params.id)),
  );
}
