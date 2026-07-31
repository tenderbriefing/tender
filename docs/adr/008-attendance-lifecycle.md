# ADR-008: Attendance lifecycle state machine

**Status:** Accepted  
**Date:** 2026-07-31

## Decision

Attendance workflow status and payment status transitions are defined in `lib/domain/attendanceLifecycle.ts` and `lib/domain/paymentLifecycle.ts`. Invalid transitions fail closed. Payment must be `paid` (or legacy `not_required`) before agent-visible dispatch.
