# ADR-003: Legacy booking API retirement

**Status:** Accepted  
**Date:** 2026-07-31

## Decision

`/api/bookings` always returns HTTP 410 and is production-blocked in `apiRoutePolicy`. Authoritative API is `/api/attendance-requests` (+ PayFast payment routes).
