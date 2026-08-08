# Legacy quarantine

These modules are **not** on the production path. They remain only for historical
reference and should not be imported by `app/`, `backend/` (except explicit 410
stubs), or new features.

| Module | Former role | Replacement |
|--------|-------------|-------------|
| `bookingService.ts` | Mock tender bookings + assumed payment | `/api/attendance-requests` + PayFast |
| `automatedMatchingService.ts` | Connector auto-match | `liveDispatchService` / agent assignment |
| `connectorAvailabilityService.ts` | Connector availability | Agent assignment / mobile job APIs |
| `connectorMatching.ts` | Matching algorithm | Live dispatch |
| `yocoService.js` | Yoco payments | PayFast only (Yoco routes return 410) |

Production routes `/api/bookings`, `/api/matching`, `/api/connector-response`,
and `/api/payments/yoco/*` return **410**.
