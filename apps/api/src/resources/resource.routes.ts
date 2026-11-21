import type { FastifyInstance } from "fastify";
import { parseInput } from "../http/request.validation.js";
import { sendResult } from "../http/result.response.js";
import type { ReservationService } from "../reservations/reservation.service.js";
import { availabilityQuerySchema } from "./resource.schemas.js";
import type { Resource } from "./resource.types.js";

type IdParams = { Params: { id: string } };

export function registerResourceRoutes(
  app: FastifyInstance,
  resources: readonly Resource[],
  reservations: ReservationService,
) {
  app.get("/resources", async () => resources);

  // Availability lives here for simplicity; in a real system it would likely be its own domain over resources and reservations.
  app.get<IdParams>("/resources/:id/availability", async (request, reply) => {
    const query = parseInput(availabilityQuerySchema, request.query);
    if (!query.ok) return sendResult(reply, query);
    return sendResult(reply, await reservations.checkAvailability({ resource: request.params.id, ...query.value }));
  });
}
