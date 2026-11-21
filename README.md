# Reservations without conflicts

Solution to **Case 02 — Reservas sem conflito** of the Alvorada Dev technical challenge.

Focus: Full-stack with emphasis on backend and tests

Specification: [`docs/spec.md`](docs/spec.md) · API reference: [`docs/api.md`](docs/api.md)

A team shares rooms and a projector. The API books a resource for a period of whole numbers `[start, end)`, refuses overlapping bookings on the same resource, cancels bookings, answers availability questions and lists reservations with their status.

## Requirements

- Docker with Compose, to run the app.
- Node 24 (see `.nvmrc`) and `pnpm`, for local development and the tests. `pnpm test` runs without Docker.

## Quick start

```bash
docker compose up -d --build       # Postgres, the API on http://localhost:3000 and the UI on http://localhost:8080
```

Open http://localhost:8080. The API applies the database migrations when it starts.

## Local development

```bash
pnpm install                       # also generates the Prisma client
cp .env.example apps/api/.env
docker compose up -d db            # Postgres only, on localhost:55432 (dev + e2e databases)
pnpm db:migrate
pnpm dev                           # API on http://localhost:3000, UI on http://localhost:5173
```

If the full stack is running, stop its API and UI first (`docker compose stop api web`), since the API uses the same port.

## Tests and checks

| Command          | What it does                                                           | Needs Docker |
| ---------------- | ---------------------------------------------------------------------- | ------------ |
| `pnpm test`      | Unit and integration tests (Vitest) against an in-memory repository    | no           |
| `pnpm test:e2e`  | Black-box HTTP requests (Bruno) against the real server and PostgreSQL | yes          |
| `pnpm lint`      | Biome: lint, formatting and import order                               | no           |
| `pnpm typecheck` | TypeScript across the API, the web app and the e2e runner              | no           |

`pnpm test:e2e` needs only the database (`docker compose up -d db`) and starts its own API. It uses its own database (`reservations_e2e`), so it never touches the data you create in the UI. It writes JUnit reports to `e2e-results/`.

You can also open `e2e/bruno` in the [Bruno](https://www.usebruno.com/) desktop app and run the requests by hand (environment `local`, with the API running on port 3000).

## How verification is enforced

| Layer                                                               | Runs against                                     | Checks                                                                              |
| ------------------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------- |
| **Unit** (`apps/api/test/reservations/reservation.service.test.ts`) | The service with an in-memory repository         | Every case rule, the order of checks, boundaries                                    |
| **Integration** (`apps/api/test/**/*.routes.test.ts`)               | The Fastify app via `app.inject`, in memory      | Every endpoint and status code, request validation, malformed input                 |
| **E2E** (`e2e/bruno/`)                                              | The running server and real PostgreSQL over HTTP | The case's own example and each rule, end to end, including the real Prisma queries |

### Rules and test coverage

Test names start with the rule they check, so each rule can be found in the test files and Bruno folders by its id.

| Rule                                                                                             | Integration | Unit | E2E |
| ------------------------------------------------------------------------------------------------ | ----------- | ---- | --- |
| RULE-1: A period must start before it ends (`start < end`)                                       | [X]         | [X]  | [X] |
| RULE-2: A reservation can start exactly when another ends (start is inclusive, end is exclusive) | [X]         | [X]  | [X] |
| RULE-3: Only active reservations of the same resource conflict                                   | [ ]         | [X]  | [X] |
| RULE-4: A rejected request creates nothing                                                       | [X]         | [X]  | [X] |
| RULE-5: A rejected attempt doesn't use up its id                                                 | [ ]         | [X]  | [X] |
| RULE-6: Ids are never reused, even after cancel                                                  | [X]         | [X]  | [X] |
| RULE-7: Canceling frees the slot                                                                 | [ ]         | [X]  | [X] |
| RULE-8: Canceling twice answers `already_canceled`, nothing changes                              | [X]         | [X]  | [X] |
| RULE-9: Canceling an unknown reservation is an error                                             | [X]         | [X]  | [X] |
| RULE-10: Availability lists active conflicts sorted by id                                        | [X]         | [X]  | [X] |
| RULE-11: Reservations are listed with their status                                               | [X]         | [X]  | [X] |

### Three tests worth reading

1. **Touching periods: `RULE-2: booking starting exactly at another's end is accepted`** (unit), plus `02-boundaries` (e2e).
   - **Setup:** book A `[10, 20)`, then B `[20, 30)` and Z `[0, 10)` on the same resource.
   - **Expected:** all three are accepted.
   - **Catches:** `<=` written instead of `<` in the overlap check, the classic off-by-one with half-open periods. The unit test catches it in the service, and the e2e scenario catches the same mistake in the SQL query.
2. **Cancel frees the slot but not the id: `RULE-7: canceling frees the slot`** and **`RULE-6: a canceled id cannot be reused`** (unit).
   - **Setup:** cancel A `[10, 20)`.
   - **Expected:** a new reservation D can take `[10, 20)`, but creating "A" again returns `id_already_used`.
   - **Catches:** implementing cancel as delete. That passes the first test and fails the second.
3. **A rejected attempt doesn't consume its id: `RULE-5: a rejected id can be used later`** (unit), plus `01-happy-path` (e2e).
   - **Setup:** try C `[19, 21)` on R1, then C `[19, 21)` on R2.
   - **Expected:** the first is a `conflict`, the second is accepted.
   - **Catches:** storing or reserving the id before every check has passed.

## Demo you can reproduce

**In the UI** (http://localhost:8080 with Docker Compose, or http://localhost:5173 with `pnpm dev`):

1. Reserve **A** on R1 `[10, 20)`, then **B** on R1 `[20, 30)`. Both are accepted. B starts exactly when A ends.
2. Type **C** on R1 with start 19 and end 21. Before you press anything, the form says _R1 is taken during [19, 21) by A [10, 20) and B [20, 30)._ and Reserve is disabled.
3. Switch the resource to **R2**. The form says it's free. Reserve C.
4. Cancel **A**, then press **Cancel again**: _A was already canceled. Nothing changed._
5. Try to reserve **A** again on R3 `[0, 5)`. The id is refused, because ids are never reused.

**Over HTTP:** the Bruno folder `e2e/bruno/01-happy-path` runs the case's own example step by step, with assertions.

## Main design choices

- **HTTP checks shape, the domain checks rules.** Zod schemas validate requests and pass typed input to the service. The service enforces the case's rules and returns results instead of throwing.
- **The repository sits behind an interface.** Prisma runs in production, and an in-memory implementation runs in the tests, so `pnpm test` is fast and needs no database.
- **Cancel is `POST /reservations/:id/cancel`, not `DELETE`.** Canceled reservations stay visible and keep their ids.

## Known limitations

- **Concurrent double-booking is not prevented.** Two simultaneous requests for overlapping periods could both pass the overlap check.
- **Unit and integration tests rely on an in-memory repository,** not the real database. Only the e2e suite runs against PostgreSQL.
- **Availability lives in the resources domain for simplicity.** In a real-world system it would most likely become its own domain referencing both resources and reservations.
- **Resources are a fixed list in code,** as the case asks. There is no way to add or remove resources.
- **There is no way to temporarily block resources,** for example to keep a room out of use for a period.
- **The UI has no automated tests.** It exists for the demo, and the API behind it is fully tested.

## Time spent

Around 4 hours.

## How AI was used and how the output was verified

I started by brainstorming a specification with an AI agent: what the goal was, which rules from the case had to be checked, and how verification would be achieved. A second AI agent then turned that spec into a 6-phase implementation plan, which I reviewed before any code was written.

I implemented the plan one phase at a time using an AI coding agent, and stopped at the end of each phase to review it before starting the next. Each phase was built test-first (TDD): a test was written and seen failing before the code that makes it pass. I stayed in the loop for every review, ran the test suites myself, and did my own checks through the UI against the real API and database.

To make sure the tests actually guard the code, some of them were checked by temporarily breaking the code they protect and confirming they fail.

## Two decisions I investigated

### 1. Not using property-based tests

- **What I wanted to check:** whether property-based testing would add real value on top of the test layers I already had. It was suggested as a way to generate random sequences of bookings and cancellations and check that rules like "no two active reservations overlap" always hold.
- **How I investigated:** I read about property-based testing and fast-check, the library proposed for it. Then I compared what it would cover with what my unit, integration and e2e tests already covered, rule by rule. I also checked whether the existing tests catch the kind of bug property tests are good at finding. For example, when I changed the overlap check from `<` to `<=` (the boundary bug), four unit tests failed.
- **What I concluded:** I left it out. The existing layers already cover every rule, and adding a new technique and library would make the solution harder to keep simple and explain. It's listed in the spec as considered and left out.

### 2. Choosing the e2e tool

- **What I wanted to check:** which tool to use for black-box tests against the running API. I wanted something similar to Postman, where each request and its expected response are easy to read.
- **How I investigated:** I compared a few options:
  - **Hurl:** clean plain-text tests, but a separate binary to install.
  - **Postman with Newman:** large JSON collections that are hard to review in git.
  - **Bruno:** a tool I had already used and could be installed via npm.

- **What I concluded:** I chose Bruno. Its requests are plain-text files that live in the repo, and reviewers can open the collection in the Bruno app and click through it. Learning that its CLI installs through npm like the rest of the stack, so there's nothing extra to set up, sealed the deal. The suite runs with `pnpm test:e2e`.
