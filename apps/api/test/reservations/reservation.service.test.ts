import { beforeEach, describe, expect, it } from "vitest";
import { ReservationService } from "../../src/reservations/reservation.service.js";
import type { Reservation } from "../../src/reservations/reservation.types.js";
import { RESOURCES } from "../../src/resources/resource.data.js";
import type { Result } from "../../src/shared/result.types.js";
import { InMemoryReservationRepository } from "./reservation.in-memory.repository.js";

let repo: InMemoryReservationRepository;
let service: ReservationService;

beforeEach(() => {
  repo = new InMemoryReservationRepository();
  service = new ReservationService(RESOURCES, repo);
});

function book(id: string, resource: string, start: number, end: number) {
  return service.create({ id, resource, start, end });
}

async function mustBook(id: string, resource: string, start: number, end: number) {
  const r = await book(id, resource, start, end);
  expect(r.ok).toBe(true);
}

function errorCode<T>(r: Result<T>) {
  return r.ok ? undefined : r.error.code;
}

const ids = (rs: Reservation[]) => rs.map((r) => r.id);

describe("create", () => {
  it.each([
    ["start equal to end", 20, 20],
    ["start after end", 21, 20],
  ])("RULE-1: %s is rejected", async (_name, start, end) => {
    const r = await book("A", "R1", start, end);
    expect(r).toEqual({
      ok: false,
      error: {
        code: "invalid_data",
        message: "The request data is invalid.",
        details: { issues: [{ path: "end", message: "start must be before end" }] },
      },
    });
    expect(repo.snapshot()).toEqual([]);
  });

  it("creates an active reservation", async () => {
    const r = await book("A", "R1", 10, 20);
    expect(r).toEqual({ ok: true, value: { id: "A", resource: "R1", start: 10, end: 20, status: "active" } });
  });

  it("RULE-2: booking starting exactly at another's end is accepted", async () => {
    await mustBook("A", "R1", 10, 20);
    await mustBook("B", "R1", 20, 30);
    await mustBook("Z", "R1", 0, 10);
  });

  it("RULE-2: overlapping intervals conflict", async () => {
    await mustBook("A", "R1", 10, 20);
    await mustBook("B", "R1", 20, 30);

    const r = await book("C", "R1", 19, 21);
    expect(errorCode(r)).toBe("conflict");
    expect(r.ok ? [] : ids((r.error.details as { conflicts: Reservation[] }).conflicts)).toEqual(["A", "B"]);

    for (const [start, end] of [
      [12, 15],
      [10, 20],
      [5, 35],
    ] as const) {
      expect(errorCode(await book("C", "R1", start, end))).toBe("conflict");
    }
  });

  it("RULE-3: same interval on a different resource is accepted", async () => {
    await mustBook("A", "R1", 10, 20);
    await mustBook("B", "R2", 10, 20);
  });

  it("RULE-3: a canceled reservation does not block", async () => {
    await mustBook("A", "R1", 10, 20);
    await service.cancel("A");
    await mustBook("B", "R1", 10, 20);
  });

  it("RULE-4: unknown resource is rejected and nothing is created", async () => {
    const r = await book("A", "R9", 10, 20);
    expect(errorCode(r)).toBe("resource_not_found");
    expect(repo.snapshot()).toEqual([]);
  });

  it("RULE-5: a rejected id can be used later", async () => {
    await mustBook("A", "R1", 10, 20);
    await mustBook("B", "R1", 20, 30);
    expect(errorCode(await book("C", "R1", 19, 21))).toBe("conflict");
    await mustBook("C", "R2", 19, 21);
  });

  it("RULE-6: a canceled id cannot be reused", async () => {
    await mustBook("A", "R1", 10, 20);
    await service.cancel("A");
    expect(errorCode(await book("A", "R2", 50, 60))).toBe("id_already_used");
  });

  it("RULE-7: canceling frees the slot", async () => {
    await mustBook("A", "R1", 10, 20);
    await service.cancel("A");
    await mustBook("D", "R1", 10, 20);
  });

  describe("validation order: earlier check wins", () => {
    it("invalid interval beats unknown resource", async () => {
      expect(errorCode(await book("A", "R9", 20, 10))).toBe("invalid_data");
    });

    it("unknown resource beats used id", async () => {
      await mustBook("A", "R1", 10, 20);
      expect(errorCode(await book("A", "R9", 10, 20))).toBe("resource_not_found");
    });

    it("used id beats overlap", async () => {
      await mustBook("A", "R1", 10, 20);
      expect(errorCode(await book("A", "R1", 10, 20))).toBe("id_already_used");
    });
  });
});

describe("cancel", () => {
  it("returns canceled and marks the reservation", async () => {
    await mustBook("A", "R1", 10, 20);
    const r = await service.cancel("A");
    expect(r).toEqual({
      ok: true,
      value: { result: "canceled", reservation: { id: "A", resource: "R1", start: 10, end: 20, status: "canceled" } },
    });
  });

  it("RULE-8: second cancel returns already_canceled and changes nothing", async () => {
    await mustBook("A", "R1", 10, 20);
    await service.cancel("A");
    const before = repo.snapshot();
    const r = await service.cancel("A");
    expect(r.ok && r.value.result).toBe("already_canceled");
    expect(repo.snapshot()).toEqual(before);
  });

  it("RULE-9: canceling an unknown id returns reservation_not_found", async () => {
    expect(errorCode(await service.cancel("NOPE"))).toBe("reservation_not_found");
  });
});

describe("checkAvailability", () => {
  it("RULE-10: availability lists only active conflicts sorted by id", async () => {
    await mustBook("Z", "R1", 0, 10);
    await mustBook("M", "R1", 10, 20);
    await mustBook("B", "R1", 20, 30);
    await service.cancel("M");

    const busy = await service.checkAvailability({ resource: "R1", start: 5, end: 25 });
    expect(busy.ok && busy.value.available).toBe(false);
    expect(busy.ok ? ids(busy.value.conflicts) : []).toEqual(["B", "Z"]);

    const free = await service.checkAvailability({ resource: "R1", start: 30, end: 40 });
    expect(free).toEqual({ ok: true, value: { available: true, conflicts: [] } });
  });

  it("RULE-10: availability rejects invalid interval / unknown resource", async () => {
    expect(errorCode(await service.checkAvailability({ resource: "R1", start: 20, end: 10 }))).toBe("invalid_data");
    expect(errorCode(await service.checkAvailability({ resource: "R1", start: 10, end: 10 }))).toBe("invalid_data");
    expect(errorCode(await service.checkAvailability({ resource: "R9", start: 10, end: 20 }))).toBe(
      "resource_not_found",
    );
  });

  it("does not change state", async () => {
    await mustBook("A", "R1", 10, 20);
    const before = repo.snapshot();
    await service.checkAvailability({ resource: "R1", start: 0, end: 100 });
    expect(repo.snapshot()).toEqual(before);
  });
});

describe("list and get", () => {
  it("RULE-11: list shows status and filters", async () => {
    await mustBook("B", "R2", 10, 20);
    await mustBook("A", "R1", 10, 20);
    await service.cancel("A");

    const all = await service.list({});
    expect(all.ok ? all.value.map((r) => [r.id, r.status]) : []).toEqual([
      ["A", "canceled"],
      ["B", "active"],
    ]);

    const canceled = await service.list({ status: "canceled" });
    expect(canceled.ok ? ids(canceled.value) : []).toEqual(["A"]);

    const onR2 = await service.list({ resource: "R2" });
    expect(onR2.ok ? ids(onR2.value) : []).toEqual(["B"]);

    expect(errorCode(await service.list({ resource: "R9" }))).toBe("resource_not_found");
  });

  it("get returns the reservation or reservation_not_found", async () => {
    await mustBook("A", "R1", 10, 20);
    const r = await service.get("A");
    expect(r.ok && r.value.id).toBe("A");
    expect(errorCode(await service.get("NOPE"))).toBe("reservation_not_found");
  });
});
