import { useEffect, useState } from "react";
import { cancelReservation, listReservations } from "./api/reservations.js";
import { listResources } from "./api/resources.js";
import { ReservationForm } from "./components/ReservationForm.js";
import { type Notice, ReservationsTable } from "./components/ReservationsTable.js";
import type { Reservation, ReservationStatus, Resource } from "./types/api.types.js";

export type StatusFilter = "all" | ReservationStatus;

export function App() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [resourcesError, setResourcesError] = useState<string | null>(null);
  const [reservationsError, setReservationsError] = useState<string | null>(null);

  async function refresh() {
    const result = await listReservations();
    if (result.ok) setReservations(result.data);
    setReservationsError(result.ok ? null : result.error.message);
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: loads once on mount
  useEffect(() => {
    listResources().then((result) => (result.ok ? setResources(result.data) : setResourcesError(result.error.message)));
    refresh();
  }, []);

  function handleCreated() {
    setNotice(null);
    refresh();
  }

  async function handleCancel(id: string) {
    const result = await cancelReservation(id);
    if (!result.ok) {
      setNotice({ tone: "error", text: result.error.message });
    } else if (result.data.result === "canceled") {
      setNotice({ tone: "ok", text: `${id} canceled.` });
    } else {
      setNotice({ tone: "noop", text: `${id} was already canceled. Nothing changed.` });
    }
    refresh();
  }

  const loadError = resourcesError ?? reservationsError;
  const filteredReservations = filter === "all" ? reservations : reservations.filter((r) => r.status === filter);

  return (
    <main className="page">
      <header className="page-head">
        <h1>Reservations demo</h1>
        <p>
          Book a room or the projector for a period of whole numbers. A period <code>[start, end)</code> includes its
          start and stops just before its end, so <code>[10, 20)</code> and <code>[20, 30)</code> do not overlap.
        </p>
      </header>

      <div className="layout">
        <section className="area" aria-labelledby="h-form">
          <h2 id="h-form">New reservation</h2>
          <ReservationForm resources={resources} onCreated={handleCreated} />
        </section>

        <section className="area" aria-labelledby="h-list">
          <ReservationsTable
            reservations={filteredReservations}
            resources={resources}
            filter={filter}
            onFilterChange={setFilter}
            onCancel={handleCancel}
            notice={loadError ? { tone: "error", text: loadError } : notice}
          />
        </section>
      </div>
    </main>
  );
}
