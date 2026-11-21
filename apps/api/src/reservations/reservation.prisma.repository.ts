import type { Prisma, PrismaClient, Reservation as ReservationRow } from "../generated/prisma/client.js";
import type { ReservationRepository } from "./reservation.repository.js";
import type { ListFilter, Reservation } from "./reservation.types.js";

const toReservation = ({ id, resource, start, end, status }: ReservationRow): Reservation => ({
  id,
  resource,
  start,
  end,
  status,
});

export class PrismaReservationRepository implements ReservationRepository {
  constructor(private readonly prisma: PrismaClient | Prisma.TransactionClient) {}

  transaction<T>(work: (repository: ReservationRepository) => Promise<T>): Promise<T> {
    // A transaction client cannot open another transaction, so nested work joins the current one.
    if (!("$transaction" in this.prisma)) return work(this);
    return this.prisma.$transaction((tx) => work(new PrismaReservationRepository(tx)));
  }

  async findById(id: string): Promise<Reservation | null> {
    const row = await this.prisma.reservation.findUnique({ where: { id } });
    return row ? toReservation(row) : null;
  }

  async findActiveOverlapping(resource: string, start: number, end: number): Promise<Reservation[]> {
    const rows = await this.prisma.reservation.findMany({
      where: { resource, status: "active", start: { lt: end }, end: { gt: start } },
    });
    return rows.map(toReservation);
  }

  async list(filter: ListFilter): Promise<Reservation[]> {
    const rows = await this.prisma.reservation.findMany({ where: filter });
    return rows.map(toReservation);
  }

  async insert(reservation: Reservation): Promise<void> {
    await this.prisma.reservation.create({ data: reservation });
  }

  async markCanceled(id: string): Promise<Reservation> {
    const row = await this.prisma.reservation.update({ where: { id }, data: { status: "canceled" } });
    return toReservation(row);
  }
}
