import type { ReservationRepository } from "../../src/reservations/reservation.repository.js";
import type { ListFilter, Reservation } from "../../src/reservations/reservation.types.js";
import { overlaps } from "../../src/reservations/reservation.utils.js";

export class InMemoryReservationRepository implements ReservationRepository {
  private readonly rows = new Map<string, Reservation>();

  async findById(id: string): Promise<Reservation | null> {
    const row = this.rows.get(id);
    return row ? { ...row } : null;
  }

  async findActiveOverlapping(resource: string, start: number, end: number): Promise<Reservation[]> {
    return [...this.rows.values()]
      .filter((r) => r.resource === resource && r.status === "active" && overlaps(r, { start, end }))
      .map((r) => ({ ...r }));
  }

  async list(filter: ListFilter): Promise<Reservation[]> {
    return [...this.rows.values()]
      .filter((r) => filter.status === undefined || r.status === filter.status)
      .filter((r) => filter.resource === undefined || r.resource === filter.resource)
      .map((r) => ({ ...r }));
  }

  async insert(reservation: Reservation): Promise<void> {
    this.rows.set(reservation.id, { ...reservation });
  }

  async markCanceled(id: string): Promise<Reservation> {
    const row = this.rows.get(id);
    if (!row) throw new Error(`reservation ${id} does not exist`);
    row.status = "canceled";
    return { ...row };
  }

  transaction<T>(work: (repository: ReservationRepository) => Promise<T>): Promise<T> {
    return work(this);
  }

  snapshot(): Reservation[] {
    return [...this.rows.values()].map((r) => ({ ...r }));
  }
}
