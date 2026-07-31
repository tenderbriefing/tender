# ADR-006: Centralised runtime configuration

**Status:** Accepted  
**Date:** 2026-07-31

## Decision

Server configuration is validated through `lib/config/runtimeConfig.ts`. Production fails closed when required Firebase/PayFast env is missing. Hardcoded Firebase fallbacks are development-only.
