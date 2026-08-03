# ADR 010: Briefing datetime as public catalogue cut-off

## Status

Accepted

## Decision

Public Tender Briefing listings (anonymous `/tenders`, SEO pages, sitemap, and
`GET /api/tender-briefings` for non-admins) hide tenders once their **briefing
datetime** is in the past, resolved in **Africa/Johannesburg**.

- Closing date / OCDS `status` continue to drive display “closed” UX and sync
  mapping; they are **not** the website removal trigger.
- Expired records are **not hard-deleted**; they remain in storage for admin/ops
  and private RFQ owners. Filtering is applied at list/detail visibility time
  via `filterPlatformVisible` / `isPlatformVisibleToViewer`.

## Consequences

- Past-briefing tenders return 404 on public detail routes.
- Public stats only count upcoming compulsory briefings.
- Admins still see past compulsory records for operations.
