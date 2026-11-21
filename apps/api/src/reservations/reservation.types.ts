export type ReservationStatus = "active" | "canceled";

export type Reservation = {
  id: string;
  resource: string;
  start: number;
  end: number;
  status: ReservationStatus;
};

export type CreateReservationInput = { id: string; resource: string; start: number; end: number };

export type AvailabilityQuery = { resource: string; start: number; end: number };

export type ListFilter = { status?: ReservationStatus; resource?: string };

export type CancelResult = { result: "canceled" | "already_canceled"; reservation: Reservation };

export type Availability = { available: boolean; conflicts: Reservation[] };
