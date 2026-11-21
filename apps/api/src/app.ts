import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import { handleError, handleFrameworkError, handleNotFound } from "./http/error.handler.js";
import { registerJsonBodyParser } from "./http/json-body.parser.js";
import type { ReservationRepository } from "./reservations/reservation.repository.js";
import { registerReservationRoutes } from "./reservations/reservation.routes.js";
import { ReservationService } from "./reservations/reservation.service.js";
import { registerResourceRoutes } from "./resources/resource.routes.js";
import type { Resource } from "./resources/resource.types.js";

type AppOptions = {
  resources: readonly Resource[];
  repository: ReservationRepository;
  logger?: FastifyServerOptions["logger"];
};

export function buildApp({ resources, repository, logger = false }: AppOptions): FastifyInstance {
  const app = Fastify({ logger, frameworkErrors: handleFrameworkError });

  app.setErrorHandler(handleError);
  app.setNotFoundHandler(handleNotFound);
  registerJsonBodyParser(app);

  const reservations = new ReservationService(resources, repository);
  registerResourceRoutes(app, resources, reservations);
  registerReservationRoutes(app, reservations);

  return app;
}
