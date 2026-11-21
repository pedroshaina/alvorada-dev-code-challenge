# Reservations without conflicts — specification

How the solution to [Case 02 — Reservas sem conflito](https://github.com/Alvorada-Dev/desafios-tecnicos/blob/main/casos/02-reservas-de-recursos.md) was envisioned and planned before and during the build.

**Goal:** an HTTP API that books shared resources (rooms, equipment) over integer time periods without conflicts, plus a small demo UI.

## Rules

Test names start with the rule ID they check.

| ID      | Rule                                                                                                                  |
| ------- | --------------------------------------------------------------------------------------------------------------------- |
| RULE-1  | A period must start strictly before it ends (`start < end`).                                                          |
| RULE-2  | Periods are half-open, `[start, end)`. A booking ending at 20 frees the resource at 20.                               |
| RULE-3  | Overlap is forbidden only between **active** reservations of the **same** resource.                                   |
| RULE-4  | An unknown resource, invalid data or a taken slot is rejected with an explanation, and nothing is created.            |
| RULE-5  | A rejected attempt does not use up its id.                                                                            |
| RULE-6  | The id of a created reservation is never reused, even after it is canceled.                                           |
| RULE-7  | Canceling frees the slot.                                                                                             |
| RULE-8  | Canceling an already-canceled reservation returns `already_canceled` (the case's `ja_cancelada`) and changes nothing. |
| RULE-9  | Canceling an unknown reservation returns an error.                                                                    |
| RULE-10 | An availability query returns whether the period is free and the conflicting **active** reservations, sorted by id.   |
| RULE-11 | Reservations can be listed with their status (active or canceled).                                                    |

The case's worked example is the main acceptance scenario:

- A `[10,20)` and B `[20,30)` on R1 are accepted.
- C `[19,21)` on R1 is rejected because of A and B.
- C `[19,21)` on R2 is accepted.
- After A is canceled, R1 is free at `[10,20)`, but the id A stays taken.

## Scope

**In:** the rules above over HTTP, persistence in PostgreSQL, a demo UI, and reproducible tests.

**Out:**

- authentication, payment, recurring bookings, calendars and timezones
- blocking a resource for a period
- concurrent double-booking (one operation at a time is assumed)
- automated UI tests
- property-based testing

## API

| Call                                              | Success                                                         | Errors                                                                                                                     |
| ------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `GET /resources`                                  | 200 list of resources (fixed: R1, R2, R3)                       | —                                                                                                                          |
| `POST /reservations` `{id, resource, start, end}` | 201 reservation                                                 | 422 `invalid_data` · 404 `resource_not_found` · 409 `id_already_used` · 409 `conflict` (with the conflicting reservations) |
| `POST /reservations/:id/cancel`                   | 200 `{ result: "canceled" \| "already_canceled", reservation }` | 404 `reservation_not_found`                                                                                                |
| `GET /resources/:id/availability?start=&end=`     | 200 `{ available, conflicts }`                                  | 422 `invalid_data` · 404 `resource_not_found`                                                                              |
| `GET /reservations?status=&resource=`             | 200 reservations sorted by id                                   | 422 `invalid_data` · 404 `resource_not_found`                                                                              |
| `GET /reservations/:id`                           | 200 reservation                                                 | 404 `reservation_not_found`                                                                                                |

- **Error body:** `{ error: { code, message, details? } }`. Clients rely on `code`.
- **Input:**
  - `id` is 1–64 letters, digits, `_` or `-`;
  - `start` and `end` are integers in the 32-bit range;
  - unknown fields are rejected.
- **Order of checks on create:** request shape → `start < end` → resource exists → id never used → no overlap. A request that is wrong in several ways always gets the same error.

## Architecture

**Stack:**

- TypeScript (Node 24, pnpm workspaces)
- API: Fastify, Zod, Prisma + PostgreSQL
- Docker Compose runs PostgreSQL, the API and the web app (nginx serving the build)
- Tests: Vitest; Bruno for the e2e suite
- Tooling: Biome
- Web: Vite + React

```
apps/api/
  src/
    app.ts                  wiring: Fastify, error handler, routes
    main.ts                 entry point (env, Prisma, listen)
    http/                   HTTP helpers: Result → response, Zod parsing, time schemas, error handler
    shared/                 Result type and helpers, error codes
    resources/              fixed resource list, GET /resources, availability route
    reservations/           types, schemas, routes, service, repository interface, Prisma repository
  prisma/                   schema.prisma + reservation.prisma + migrations
  test/                     unit + integration tests, in-memory repository
apps/web/src/               components/, api/, types/
e2e/bruno/                  black-box scenarios
scripts/run-e2e.ts          e2e runner
```

- **Validation is split:**
  - the HTTP layer checks that a request is well-formed (Zod) and passes typed input to the service;
  - the service enforces the case's rules.
- **The service returns results instead of throwing:** `{ ok: true, value } | { ok: false, error }`.
- **Storage sits behind a `ReservationRepository` interface:**
  - Prisma in production;
  - an in-memory implementation in the tests.
- **Overlap rule:** `existing.start < end AND existing.end > start` on active reservations of the same resource.
- **Availability sits in the resources domain for simplicity.** In a real-world system it would most likely become its own domain referencing both resources and reservations.
- **Create and cancel each run in one database transaction** (the repository's `transaction` method).
- **Canceled reservations are kept,** so their ids stay taken.

## Verification

| Layer           | What it runs against                                                        | Command         |
| --------------- | --------------------------------------------------------------------------- | --------------- |
| Unit            | The service with the in-memory repository                                   | `pnpm test`     |
| Integration     | The HTTP app via `app.inject`, with the in-memory repository                | `pnpm test`     |
| E2E (black-box) | The real server and PostgreSQL over HTTP, with declarative Bruno assertions | `pnpm test:e2e` |

**E2E runner:**

1. migrate the `reservations_e2e` database;
2. start one server;
3. empty the table before each scenario folder (`01-happy-path`, `02-boundaries`, `03-cancellation`, `04-validation`).

**Success criteria:**

- `pnpm test` passes on a fresh clone without Docker.
- `pnpm test:e2e` passes after `docker compose up -d db`.
- Repeated runs give identical results.
- Every rule has at least one unit test and one e2e request.

## Demo UI

One page with a reservation form and a reservations table.

- **The form checks availability as you type.** A taken period shows red text naming the conflicting reservations and disables Reserve.
- **Other errors** (reversed period, id already used, unknown resource) are shown as plain red text.
- **The table** lists reservations with an All / Active / Canceled filter and Cancel buttons.
- **Two demo aids:**
  - "Cancel again" on canceled rows, to show `already_canceled`;
  - an unknown resource option, R9.

A static mockup was produced and approved before the UI was implemented.

## Plan

1. **Domains:** workspace scaffold, the resources and reservations domains with an in-memory repository, unit tests.
2. **HTTP layer:** Fastify routes, request schemas, error mapping, integration tests.
3. **Persistence:** docker compose, Prisma schema and migration, Prisma repository, entry point.
4. **E2E:** Bruno scenarios and the runner against the e2e database.
5. **Demo UI:** mockup, approval, then the React app.
6. **Docs:** README with setup, rule-by-rule test coverage, highlighted tests, decisions and limitations.
