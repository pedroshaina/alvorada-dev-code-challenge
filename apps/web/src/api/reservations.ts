import type { CancelResult, CreateReservationInput, Reservation } from "../types/api.types.js";
import { request } from "./client.js";

export const listReservations = () => request<Reservation[]>("/reservations");

export const createReservation = (input: CreateReservationInput) =>
  request<Reservation>("/reservations", { method: "POST", body: JSON.stringify(input) });

export const cancelReservation = (id: string) =>
  request<CancelResult>(`/reservations/${encodeURIComponent(id)}/cancel`, { method: "POST" });
