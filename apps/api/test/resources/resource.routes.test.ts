import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { RESOURCES } from "../../src/resources/resource.data.js";
import { InMemoryReservationRepository } from "../reservations/reservation.in-memory.repository.js";

let app: FastifyInstance;

beforeEach(() => {
  app = buildApp({ resources: RESOURCES, repository: new InMemoryReservationRepository() });
});

afterEach(() => app.close());

it("GET /resources lists the fixed resources", async () => {
  const res = await app.inject({ method: "GET", url: "/resources" });
  expect(res.statusCode).toBe(200);
  expect(res.json()).toEqual([
    { id: "R1", name: "Meeting room 1" },
    { id: "R2", name: "Meeting room 2" },
    { id: "R3", name: "Projector" },
  ]);
});

function create(payload: object) {
  return app.inject({ method: "POST", url: "/reservations", payload });
}

function get(url: string) {
  return app.inject({ method: "GET", url });
}

const valid = { id: "A", resource: "R1", start: 10, end: 20 };

describe("GET /resources/:id/availability", () => {
  it("RULE-10: reports conflicts sorted by id, or availability", async () => {
    await create({ id: "B", resource: "R1", start: 20, end: 30 });
    await create(valid);

    const busy = await get("/resources/R1/availability?start=19&end=21");
    expect(busy.statusCode).toBe(200);
    expect(busy.json().available).toBe(false);
    expect(busy.json().conflicts.map((r: { id: string }) => r.id)).toEqual(["A", "B"]);

    const free = await get("/resources/R1/availability?start=30&end=40");
    expect(free.json()).toEqual({ available: true, conflicts: [] });
  });

  it.each([
    ["a missing end", "?start=19"],
    ["a non-numeric start", "?start=x&end=2"],
    ["a repeated start", "?start=1&start=2&end=5"],
    ["start after end", "?start=20&end=10"],
    ["an empty start", "?start=&end=5"],
    ["an exponent start", "?start=1e1&end=20"],
    ["a hex start", "?start=0x10&end=20"],
  ])("rejects %s with 422", async (_name, query) => {
    const res = await get(`/resources/R1/availability${query}`);
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe("invalid_data");
  });

  it("returns 404 for an unknown resource", async () => {
    const res = await get("/resources/R9/availability?start=1&end=2");
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe("resource_not_found");
  });
});
