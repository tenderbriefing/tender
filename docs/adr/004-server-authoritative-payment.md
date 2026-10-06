# ADR-004: Server-authoritative payment states

**Status:** Accepted  
**Date:** 2026-07-31  
**Production freeze:** P0 revenue boundary certified at SHA `dc2771db7088bf7d48299b05157d78565a6dcea7` (PR #105). See `docs/security/revenue-boundary.md`.

## Decision

Payment status transitions only via server services processing verified PayFast ITN (or explicit admin tooling). Browser success/cancel pages never mark paid.

Client SDK create of `attendanceRequests` is denied (`allow create: if false`). Canonical unpaid checkout is R349 / 34900 cents. Historical paid records (earlier commercial epochs) are not rewritten.
