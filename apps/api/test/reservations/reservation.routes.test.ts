import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { RESOURCES } from "../../src/resources/resource.data.js";
import { InMemoryReservationRepository } from "./reservation.in-memory.repository.js";

let app: FastifyInstance;

beforeEach(() => {
  app = buildApp({ resources: RESOURCES, repository: new InMemoryReservationRepository() });
});

afterEach(() => app.close());

const valid = { id: "A", resource: "R1", start: 10, end: 20 };

function create(payload: object) {
  return app.inject({ method: "POST", url: "/reservations", payload });
}

function get(url: string) {
  return app.inject({ method: "GET", url });
}

function cancel(id: string) {
  return app.inject({ method: "POST", url: `/reservations/${id}/cancel` });
}

async function storedIds() {
  return (await get("/reservations")).json().map((r: { id: string }) => r.id);
}

describe("POST /reservations", () => {
  it("creates an active reservation", async () => {
    const res = await create(valid);
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ ...valid, status: "active" });
  });

  it("RULE-2: returns 409 conflict listing the conflicting reservations sorted by id", async () => {
    await create({ id: "B", resource: "R1", start: 20, end: 30 });
    await create(valid);
    const res = await create({ id: "C", resource: "R1", start: 19, end: 21 });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe("conflict");
    expect(res.json().error.details.conflicts.map((r: { id: string }) => r.id)).toEqual(["A", "B"]);
  });

  it("RULE-6: returns 409 id_already_used", async () => {
    await create(valid);
    const res = await create({ ...valid, resource: "R2" });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe("id_already_used");
  });

  it("RULE-4: returns 404 resource_not_found", async () => {
    const res = await create({ ...valid, resource: "R9" });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe("resource_not_found");
  });

  it("RULE-1: returns 422 when start is not before end", async () => {
    const res = await create({ ...valid, start: 20, end: 10 });
    expect(res.statusCode).toBe(422);
    expect(res.json()).toEqual({
      error: {
        code: "invalid_data",
        message: "The request data is invalid.",
        details: { issues: [{ path: "end", message: "start must be before end" }] },
      },
    });
  });

  it.each([
    ["a float time", { start: 10.5 }],
    ["a string time", { start: "10" }],
    ["a time above int32", { end: 2147483648 }],
    ["an empty id", { id: "" }],
    ["an id with a space", { id: "a b" }],
    ["a 65-char id", { id: "a".repeat(65) }],
    ["an unknown field", { begin: 1 }],
    ["a missing field", { resource: undefined }],
  ])("rejects %s with 422 and stores nothing", async (_name, patch) => {
    const res = await create({ ...valid, ...patch });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe("invalid_data");
    expect(await storedIds()).toEqual([]);
  });

  it("rejects a body that is not valid JSON with 422", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/reservations",
      headers: { "content-type": "application/json" },
      payload: "{",
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe("invalid_data");
  });

  it("rejects an empty JSON body with 422", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/reservations",
      headers: { "content-type": "application/json" },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe("invalid_data");
  });

  it("rejects a request with no body and no content-type with 422", async () => {
    const res = await app.inject({ method: "POST", url: "/reservations" });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe("invalid_data");
  });
});

describe("POST /reservations/:id/cancel", () => {
  it("RULE-8: cancels, then answers already_canceled", async () => {
    await create(valid);

    const first = await cancel("A");
    expect(first.statusCode).toBe(200);
    expect(first.json()).toEqual({ result: "canceled", reservation: { ...valid, status: "canceled" } });

    const second = await cancel("A");
    expect(second.statusCode).toBe(200);
    expect(second.json().result).toBe("already_canceled");
  });

  it("accepts a JSON content-type with no body", async () => {
    await create(valid);
    const res = await app.inject({
      method: "POST",
      url: "/reservations/A/cancel",
      headers: { "content-type": "application/json" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().result).toBe("canceled");
  });

  it("RULE-9: returns 404 reservation_not_found", async () => {
    const res = await cancel("NOPE");
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe("reservation_not_found");
  });

  it("returns 404 for an id that could never exist", async () => {
    const res = await cancel("A%20B");
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe("reservation_not_found");
  });
});

describe("GET /reservations", () => {
  it("RULE-11: lists reservations sorted by id with their status, and filters", async () => {
    await create({ id: "B", resource: "R2", start: 10, end: 20 });
    await create(valid);
    await cancel("A");

    const all = await get("/reservations");
    expect(all.statusCode).toBe(200);
    expect(all.json().map((r: { id: string; status: string }) => [r.id, r.status])).toEqual([
      ["A", "canceled"],
      ["B", "active"],
    ]);

    expect((await get("/reservations?status=canceled")).json().map((r: { id: string }) => r.id)).toEqual(["A"]);
    expect((await get("/reservations?resource=R2")).json().map((r: { id: string }) => r.id)).toEqual(["B"]);
  });

  it.each([
    ["a status in the wrong case", "?status=ACTIVE"],
    ["an unknown query parameter", "?foo=1"],
  ])("rejects %s with 422", async (_name, query) => {
    const res = await get(`/reservations${query}`);
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe("invalid_data");
  });

  it("returns 404 for an unknown resource filter", async () => {
    const res = await get("/reservations?resource=R9");
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe("resource_not_found");
  });
});

describe("GET /reservations/:id", () => {
  it("returns the reservation or 404", async () => {
    await create(valid);

    const found = await get("/reservations/A");
    expect(found.statusCode).toBe(200);
    expect(found.json()).toEqual({ ...valid, status: "active" });

    const missing = await get("/reservations/NOPE");
    expect(missing.statusCode).toBe(404);
    expect(missing.json().error.code).toBe("reservation_not_found");
  });
});
