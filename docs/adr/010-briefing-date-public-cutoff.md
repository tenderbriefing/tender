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

## Feed timestamp semantics

The eTenders OCDS feed publishes **SA wall-clock times carrying a `Z`
designator**: an 11:00 SAST briefing arrives as `2026-08-12T11:00:00Z`, not as
`09:00Z`. The same shape applies to `tenderPeriod.endDate`, which is why closing
times cluster on `11:00Z`/`12:00Z` — the standard SA closing hours.

Therefore a briefing timestamp with no explicit UTC offset is resolved as SA wall
clock (`resolveBriefingDateTime`), and only an explicit `+02:00`-style offset is
trusted as a real instant. Reading these values as true UTC left the catalogue
two hours behind the briefing time shown on the tender card.

`briefingTime` is the wall clock displayed to users and is the authority for the
cut-off, so a tender leaves the catalogue exactly when its displayed briefing
time passes. Timestamp handling must never depend on the runtime timezone: the
sync container runs in UTC while browsers run in SAST.

## Consequences

- Past-briefing tenders return 404 on public detail routes.
- Public stats only count upcoming compulsory briefings.
- Admins still see past compulsory records for operations.
