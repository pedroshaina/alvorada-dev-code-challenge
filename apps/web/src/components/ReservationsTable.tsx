import type { StatusFilter } from "../App.js";
import type { Reservation, Resource } from "../types/api.types.js";
import { Period } from "./Period.js";

export type Notice = { tone: "ok" | "noop" | "error"; text: string };

type Props = {
  reservations: Reservation[];
  resources: Resource[];
  filter: StatusFilter;
  onFilterChange: (filter: StatusFilter) => void;
  onCancel: (id: string) => void;
  notice: Notice | null;
};

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "canceled", label: "Canceled" },
];

export function ReservationsTable({ reservations, resources, filter, onFilterChange, onCancel, notice }: Props) {
  const nameOf = (id: string) => resources.find((r) => r.id === id)?.name ?? "";

  return (
    <>
      <div className="list-head">
        <h2 id="h-list">Reservations</h2>
        <fieldset className="filter">
          <legend>Show</legend>
          <div className="segments">
            {FILTERS.map(({ value, label }) => (
              <label key={value}>
                <input
                  type="radio"
                  name="status"
                  value={value}
                  checked={filter === value}
                  onChange={() => onFilterChange(value)}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      {notice && (
        <p className={`notice notice--${notice.tone}`} role="status">
          {notice.text}
        </p>
      )}

      {reservations.length === 0 && filter === "all" ? (
        <div className="empty">
          <p>No reservations yet</p>
          <p>Fill in New reservation and press Reserve. It will show up here.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Id</th>
                <th scope="col">Resource</th>
                <th scope="col">Period</th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {reservations.length === 0 && (
                <tr>
                  <td className="none" colSpan={5}>
                    No {filter} reservations.
                  </td>
                </tr>
              )}
              {reservations.map((r) => (
                <tr key={r.id} className={r.status === "canceled" ? "is-canceled" : undefined}>
                  <td className="id">{r.id}</td>
                  <td className="res">
                    <span className="mono">{r.resource}</span>
                    <span className="name">{nameOf(r.resource)}</span>
                  </td>
                  <td className="period">
                    <Period start={r.start} end={r.end} />
                  </td>
                  <td>
                    <span className={`status ${r.status}`}>{r.status}</span>
                  </td>
                  <td className="action">
                    {r.status === "active" ? (
                      <button
                        className="button quiet"
                        type="button"
                        aria-label={`Cancel reservation ${r.id}`}
                        onClick={() => onCancel(r.id)}
                      >
                        Cancel
                      </button>
                    ) : (
                      <button
                        className="button quiet faint"
                        type="button"
                        aria-label={`Cancel reservation ${r.id} again`}
                        onClick={() => onCancel(r.id)}
                      >
                        Cancel again
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
