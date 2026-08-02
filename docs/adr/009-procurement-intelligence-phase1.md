# ADR-009: Procurement Intelligence Phase 1

**Status:** Accepted  
**Date:** 2026-07-31

## Decision

Ship Phase 1 as a fail-closed, flag-gated, deterministic decision-support layer on tender detail pages, reusing existing tender models and SME profile fields. Do not claim win probability or definitive eligibility.

## Consequences

- Pilot via env flags without global enablement.
- Extends tender UX progressively; existing listing/detail remain functional when disabled.
