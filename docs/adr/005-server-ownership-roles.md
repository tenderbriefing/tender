# ADR-005: Server-side ownership and role enforcement

**Status:** Accepted  
**Date:** 2026-07-31

## Decision

All protected resources enforce ownership/role in API handlers (`verifyApiUser` + access helpers) and Firestore rules. Client claims of role/ownership are ignored.
