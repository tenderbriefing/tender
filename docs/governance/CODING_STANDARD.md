# Coding Standard — Tender Briefing

## TypeScript

- Prefer TypeScript for new App Router / `lib` code.
- Do not add broad `@ts-ignore` / eslint-disable without justification.
- Backend `require()` JS is legacy; new logic belongs in typed modules when touching critical paths.

## Naming & structure

- `app/` routes, `components/` UI, `lib/` shared typed logic, `backend/` legacy services, `docs/` authority docs.
- Product vocabulary: Tender Briefing, Book an agent, Attendance request, SME requests, PayFast payment.

## Errors & logging

- Distinguish retryable vs terminal failures.
- Use `lib/observability/logger.ts` for critical workflows.
- User messages safe and actionable; no stack traces in production responses.

## Validation

- Prefer shared schemas/helpers for route params and payment/lifecycle inputs.
- Unknown privileged fields must not pass through client→Firestore.

## Testing

- Colocate unit tests under `tests/unit/**`.
- Name tests after behaviour (`paymentLifecycle.test.ts`).
- Never mock away the security boundary under test.

## Complexity & modules

- Keep functions focused; extract when reused (≥2 call sites).
- Module boundaries: payments, attendance lifecycle, access control, config, observability.

## Dependencies

- Add only with justification in PR/commit body.
- Remove unused deps when proven unused.

## Deprecation

- Retire with 410 / redirects / production route blocks.
- Delete only after import/string/route/docs/deploy reference search.
- Temporary migration code must have a removal ticket/ADR note.
