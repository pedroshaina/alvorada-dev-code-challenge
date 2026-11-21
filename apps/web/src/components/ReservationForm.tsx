import { type ReactNode, useEffect, useState } from "react";
import { isAbortError } from "../api/client.js";
import { createReservation } from "../api/reservations.js";
import { checkAvailability } from "../api/resources.js";
import type { Reservation, Resource } from "../types/api.types.js";
import { Period } from "./Period.js";

type Props = {
  resources: Resource[];
  onCreated: (reservation: Reservation) => void;
};

type Fields = { id: string; resource: string; start: string; end: string };

type Field = keyof Fields;

type Message = { tone: "ok" | "error" | "hint"; content: ReactNode; invalid?: Field[] };

// Demo aid: a resource the API doesn't know, so the video can show that error.
const UNKNOWN_RESOURCE: Resource = { id: "R9", name: "(demo: unknown)" };

const CHECK_DELAY_MS = 250;

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

const FILL_IN_FIELDS_MESSAGE: Message = {
  tone: "hint",
  content: "Fill in every field. The period is checked as you type.",
};

function joinWithAnd(items: ReactNode[]): ReactNode {
  return items.map((item, i) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: the list is rebuilt on every render, never reordered
    <span key={i}>
      {i === 0 ? "" : i === items.length - 1 ? " and " : ", "}
      {item}
    </span>
  ));
}

function availabilityMessage(resource: string, start: number, end: number, conflicts: Reservation[]): Message {
  if (conflicts.length === 0) {
    return {
      tone: "ok",
      content: (
        <>
          {resource} is free during <Period start={start} end={end} />.
        </>
      ),
    };
  }
  const who = conflicts.map((c) => (
    <span key={c.id}>
      {c.id} <Period start={c.start} end={c.end} />
    </span>
  ));
  return {
    tone: "error",
    content: (
      <>
        {resource} is taken during <Period start={start} end={end} /> by {joinWithAnd(who)}.
      </>
    ),
  };
}

export function ReservationForm({ resources, onCreated }: Props) {
  const [fields, setFields] = useState<Fields>({ id: "", resource: "", start: "", end: "" });
  const [checkAvailabilityMessage, setCheckAvailabilityMessage] = useState<Message>(FILL_IN_FIELDS_MESSAGE);
  const [outcome, setOutcome] = useState<Message | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const resource = fields.resource || resources[0]?.id || "";

  useEffect(() => {
    if (resource === "" || fields.start.trim() === "" || fields.end.trim() === "") {
      setCheckAvailabilityMessage(FILL_IN_FIELDS_MESSAGE);
      return;
    }
    const start = Number(fields.start);
    const end = Number(fields.end);
    if (!Number.isInteger(start) || !Number.isInteger(end)) {
      setCheckAvailabilityMessage({
        tone: "error",
        content: "Start and end must be whole numbers.",
        invalid: ["start", "end"],
      });
      return;
    }
    if (start >= end) {
      setCheckAvailabilityMessage({ tone: "error", content: "Start must be before end.", invalid: ["start", "end"] });
      return;
    }

    setCheckAvailabilityMessage({ tone: "hint", content: "Checking availability…" });
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const result = await checkAvailability(resource, start, end, controller.signal).catch((error) => {
        if (isAbortError(error)) return null;
        throw error;
      });
      // A field changed while this check was in flight; the next check replaces it.
      if (!result || controller.signal.aborted) return;
      if (result.ok) {
        setCheckAvailabilityMessage(availabilityMessage(resource, start, end, result.data.conflicts));
        return;
      }
      const unknown = result.error.code === "resource_not_found";
      setCheckAvailabilityMessage({
        tone: "error",
        content: unknown ? `${resource} is not a known resource.` : result.error.message,
        invalid: unknown ? ["resource"] : ["start", "end"],
      });
    }, CHECK_DELAY_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [resource, fields.start, fields.end]);

  function change(field: Field, value: string) {
    setFields({ ...fields, resource, [field]: value });
    setOutcome(null);
  }

  const id = fields.id.trim();
  const idProblem: Message | null =
    id !== "" && !ID_PATTERN.test(id)
      ? { tone: "error", content: "The id can only use letters, digits, - and _ (up to 64).", invalid: ["id"] }
      : null;
  const canReserve = id !== "" && !idProblem && checkAvailabilityMessage.tone === "ok" && !submitting;

  async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canReserve) return;
    setSubmitting(true);
    const result = await createReservation({ id, resource, start: Number(fields.start), end: Number(fields.end) });
    setSubmitting(false);

    if (!result.ok) {
      const idError = result.error.code === "id_already_used" || result.error.code === "invalid_data";
      return setOutcome({ tone: "error", content: result.error.message, invalid: idError ? ["id"] : [] });
    }

    const r = result.data;
    setFields({ id: "", resource, start: "", end: "" });
    setOutcome({
      tone: "ok",
      content: (
        <>
          Reserved. {r.id} holds {r.resource} for <Period start={r.start} end={r.end} />.
        </>
      ),
    });
    onCreated(r);
  }

  const message = outcome ?? idProblem ?? checkAvailabilityMessage;
  const invalid = (field: Field) => message.invalid?.includes(field) || undefined;

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="fields">
        <div className="field">
          <label htmlFor="reservation-id">Reservation id</label>
          <input
            type="text"
            id="reservation-id"
            autoComplete="off"
            value={fields.id}
            onChange={(e) => change("id", e.target.value)}
            aria-invalid={invalid("id")}
            aria-describedby="id-hint form-feedback"
          />
          <span className="hint" id="id-hint">
            Letters, digits, - and _
          </span>
        </div>
        <div className="field">
          <label htmlFor="reservation-resource">Resource</label>
          <select
            id="reservation-resource"
            value={resource}
            onChange={(e) => change("resource", e.target.value)}
            aria-invalid={invalid("resource")}
            aria-describedby="form-feedback"
          >
            {[...resources, UNKNOWN_RESOURCE].map((r) => (
              <option key={r.id} value={r.id}>
                {r.id} {r.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field narrow">
          <label htmlFor="reservation-start">Start</label>
          <input
            type="number"
            step="1"
            id="reservation-start"
            value={fields.start}
            onChange={(e) => change("start", e.target.value)}
            aria-invalid={invalid("start")}
            aria-describedby="form-feedback"
          />
        </div>
        <div className="field narrow">
          <label htmlFor="reservation-end">End</label>
          <input
            type="number"
            step="1"
            id="reservation-end"
            value={fields.end}
            onChange={(e) => change("end", e.target.value)}
            aria-invalid={invalid("end")}
            aria-describedby="form-feedback"
          />
        </div>
        <div className="submit">
          <button className="button" type="submit" disabled={!canReserve}>
            Reserve
          </button>
        </div>
      </div>
      <div className="feedback" id="form-feedback" aria-live="polite">
        <p className={`msg msg--${message.tone}`}>{message.content}</p>
      </div>
    </form>
  );
}
