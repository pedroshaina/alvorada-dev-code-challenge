import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { RESOURCES } from "../src/resources/resource.data.js";
import { InMemoryReservationRepository } from "./reservations/reservation.in-memory.repository.js";

let app: FastifyInstance;

afterEach(() => app.close());

describe("framework-level responses use the API error format", () => {
  it("an unknown route returns 404 not_found", async () => {
    app = buildApp({ resources: RESOURCES, repository: new InMemoryReservationRepository() });
    const res = await app.inject({ method: "GET", url: "/nope" });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe("not_found");
  });

  it("malformed percent-encoding returns 400 bad_request", async () => {
    app = buildApp({ resources: RESOURCES, repository: new InMemoryReservationRepository() });
    const res = await app.inject({ method: "GET", url: "/reservations/%FF" });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("bad_request");
  });

  it("an over-long path id returns 414 bad_request", async () => {
    app = buildApp({ resources: RESOURCES, repository: new InMemoryReservationRepository() });
    const res = await app.inject({ method: "GET", url: `/reservations/${"a".repeat(120)}` });
    expect(res.statusCode).toBe(414);
    expect(res.json().error.code).toBe("bad_request");
  });

  it("an unexpected failure returns 500 internal_error without internals", async () => {
    const failing = new InMemoryReservationRepository();
    failing.findById = async () => {
      throw new Error("database is down");
    };
    app = buildApp({ resources: RESOURCES, repository: failing });
    const res = await app.inject({ method: "GET", url: "/reservations/A" });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: { code: "internal_error", message: "Something went wrong." } });
  });
});
