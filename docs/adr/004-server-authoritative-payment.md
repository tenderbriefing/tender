# ADR-004: Server-authoritative payment states

**Status:** Accepted  
**Date:** 2026-07-31

## Decision

Payment status transitions only via server services processing verified PayFast ITN (or explicit admin tooling). Browser success/cancel pages never mark paid.
