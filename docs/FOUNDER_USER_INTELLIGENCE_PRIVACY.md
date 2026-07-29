# Founder User Intelligence — Privacy & POPIA notes

## Purpose limitation
Product events and founder views exist to improve platform service delivery for SMEs and Youth Agents (onboarding support, coverage, engagement health). They are not for advertising resale.

## Data minimisation
- Metadata allow-list only (`lib/founder/eventSchema.ts`).
- Forbidden: passwords, tokens, bank data, ID numbers, raw form text, keystrokes.
- Geography: province/city aggregates; no residential GPS.
- Municipality not collected — not fabricated.

## Access
- Fail-closed flag `founder_user_intelligence` / `FOUNDER_USER_INTELLIGENCE_ENABLED`.
- Founder allowlist + `users.founderAccess`.
- Ordinary admins, SMEs, and Youth Agents cannot call `/api/founder/*`.
- Access attempts logged to `founderAccessLogs`.

## Retention
- Prefer aggregated `userActivitySummaries` and future `founderDailySummaries` for long-term analytics.
- Raw `productEvents` should be retained only as long as operationally necessary (configure deletion/TTL in a later phase).

## User rights
Support user-data deletion by removing `users`, role docs, `userActivitySummaries`, and related `productEvents` for the actor (ops runbook — Phase 2 automation).

## Disclosure
Update the public privacy policy before global activation to describe first-party product analytics used for service improvement.
