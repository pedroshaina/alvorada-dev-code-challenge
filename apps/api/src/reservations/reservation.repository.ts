import type { ListFilter, Reservation } from "./reservation.types.js";

export interface ReservationRepository {
  findById(id: string): Promise<Reservation | null>;
  findActiveOverlapping(resource: string, start: number, end: number): Promise<Reservation[]>;
  list(filter: ListFilter): Promise<Reservation[]>;
  insert(reservation: Reservation): Promise<void>;
  markCanceled(id: string): Promise<Reservation>;
  transaction<T>(work: (repository: ReservationRepository) => Promise<T>): Promise<T>;
}
