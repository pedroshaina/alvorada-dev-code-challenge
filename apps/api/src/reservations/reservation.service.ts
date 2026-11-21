import { findResource } from "../resources/resource.data.js";
import type { Resource } from "../resources/resource.types.js";
import { failureResult, successResult } from "../shared/result.js";
import type { Result } from "../shared/result.types.js";
import type { ReservationRepository } from "./reservation.repository.js";
import type {
  Availability,
  AvailabilityQuery,
  CancelResult,
  CreateReservationInput,
  ListFilter,
  Reservation,
} from "./reservation.types.js";
import { byId, invalidIntervalResult } from "./reservation.utils.js";

export class ReservationService {
  constructor(
    private readonly resources: readonly Resource[],
    private readonly repo: ReservationRepository,
  ) {}

  private hasResource(id: string): boolean {
    return findResource(this.resources, id) !== undefined;
  }

  private unknownResource<T>(id: string): Result<T> {
    return failureResult("resource_not_found", `Resource ${id} does not exist.`);
  }

  async create({ id, resource, start, end }: CreateReservationInput): Promise<Result<Reservation>> {
    if (start >= end) return invalidIntervalResult();

    if (!this.hasResource(resource)) return this.unknownResource(resource);

    return this.repo.transaction(async (repo): Promise<Result<Reservation>> => {
      if (await repo.findById(id)) {
        return failureResult("id_already_used", `The id ${id} was already used by another reservation.`);
      }

      const conflicts = await repo.findActiveOverlapping(resource, start, end);
      if (conflicts.length > 0) {
        return failureResult("conflict", `${resource} is already reserved during [${start}, ${end}).`, {
          conflicts: conflicts.sort(byId),
        });
      }

      const reservation: Reservation = { id, resource, start, end, status: "active" };
      await repo.insert(reservation);
      return successResult(reservation);
    });
  }

  async cancel(id: string): Promise<Result<CancelResult>> {
    return this.repo.transaction(async (repo): Promise<Result<CancelResult>> => {
      const existing = await repo.findById(id);
      if (!existing) return failureResult("reservation_not_found", `Reservation ${id} does not exist.`);
      if (existing.status === "canceled") return successResult({ result: "already_canceled", reservation: existing });
      return successResult({ result: "canceled", reservation: await repo.markCanceled(id) });
    });
  }

  async checkAvailability({ resource, start, end }: AvailabilityQuery): Promise<Result<Availability>> {
    if (start >= end) return invalidIntervalResult();

    if (!this.hasResource(resource)) return this.unknownResource(resource);

    const conflicts = (await this.repo.findActiveOverlapping(resource, start, end)).sort(byId);
    return successResult({ available: conflicts.length === 0, conflicts });
  }

  async list(filter: ListFilter): Promise<Result<Reservation[]>> {
    const { resource } = filter;
    if (resource !== undefined && !this.hasResource(resource)) return this.unknownResource(resource);

    return successResult((await this.repo.list(filter)).sort(byId));
  }

  async get(id: string): Promise<Result<Reservation>> {
    const found = await this.repo.findById(id);
    return found ? successResult(found) : failureResult("reservation_not_found", `Reservation ${id} does not exist.`);
  }
}
