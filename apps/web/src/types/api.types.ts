export type Resource = { id: string; name: string };

export type ReservationStatus = "active" | "canceled";

export type Reservation = {
  id: string;
  resource: string;
  start: number;
  end: number;
  status: ReservationStatus;
};

export type CreateReservationInput = { id: string; resource: string; start: number; end: number };

export type CancelResult = { result: "canceled" | "already_canceled"; reservation: Reservation };

export type Availability = { available: boolean; conflicts: Reservation[] };

export type ApiError = { code: string; message: string };

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };
