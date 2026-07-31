# ADR-007: Structured audit logging

**Status:** Accepted  
**Date:** 2026-07-31

## Decision

Critical workflows emit structured logs via `lib/observability/logger.ts`. Privileged mutations also write append-only audit events (`auditLogs` client-write denied).
