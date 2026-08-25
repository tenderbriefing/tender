# ADR-001: PayFast as sole payment provider

**Status:** Accepted  
**Date:** 2026-07-31

## Context

Attendance booking requires collecting R349 (legacy R249 records remain historically valid). Legacy Yoco/Stripe paths created parallel architectures and confusion.

## Decision

PayFast is the only payment provider. Yoco routes proxy or return 410. Stripe is not integrated.

## Consequences

- One ITN webhook, one checkout builder, one fee constant.
- Client redirects are non-authoritative.
