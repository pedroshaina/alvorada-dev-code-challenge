# API reference

The API listens on `http://localhost:3000` (`PORT` overrides it). All bodies are JSON.

| Call                                              | Success                                                         | Errors                                                                                 |
| ------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `GET /resources`                                  | 200 resources (R1, R2, R3)                                      | —                                                                                      |
| `POST /reservations` `{id, resource, start, end}` | 201 reservation                                                 | 422 `invalid_data` · 404 `resource_not_found` · 409 `id_already_used` · 409 `conflict` |
| `POST /reservations/:id/cancel`                   | 200 `{ result: "canceled" \| "already_canceled", reservation }` | 404 `reservation_not_found`                                                            |
| `GET /resources/:id/availability?start=&end=`     | 200 `{ available, conflicts }`                                  | 422 · 404                                                                              |
| `GET /reservations?status=&resource=`             | 200 reservations sorted by id                                   | 422 · 404                                                                              |
| `GET /reservations/:id`                           | 200 reservation                                                 | 404                                                                                    |

Errors look like `{ "error": { "code": "conflict", "message": "...", "details": { "conflicts": [...] } } }`.

Responses that don't come from a specific endpoint use the same envelope:

| Situation                                        | Status    | `code`           |
| ------------------------------------------------ | --------- | ---------------- |
| Unknown route                                    | 404       | `not_found`      |
| Malformed URL encoding, or a path value too long | 400 / 414 | `bad_request`    |
| Unexpected server error (details are logged)     | 500       | `internal_error` |

A `Content-Type: application/json` header with an empty body is treated as no body.

## Input rules

- `id`: 1–64 letters, digits, `_` or `-`.
- `start` and `end`: integers in the 32-bit range, with `start < end`.
- Unknown body fields are rejected with `invalid_data`.

## Order of checks on create

1. Request shape (types, id format, unknown fields) → 422 `invalid_data`
2. `start < end` → 422 `invalid_data`
3. The resource exists → 404 `resource_not_found`
4. The id was never used → 409 `id_already_used`
5. No overlap with an active reservation on the same resource → 409 `conflict`

A rejected request changes nothing.
