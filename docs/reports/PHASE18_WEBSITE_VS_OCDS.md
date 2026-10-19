# Phase 18 — Website vs OCDS investigation

## Official machine-readable sources confirmed

| Source | URL | Role |
|--------|-----|------|
| OCDS Release API | `https://ocds-api.etenders.gov.za/api/OCDSReleases` | Primary TenderBriefing ingest |
| Transparency Portal bulk downloads | `https://data.etenders.gov.za/Home/ReleasesFiles` | Monthly JSON/CSV/XLSX (human portal; JS-rendered table) |
| OCP Data Registry | `https://data.open-contracting.org/en/publication/143` | Derived yearly dumps from NT publication |

## Website structured feed

| Candidate | Result |
|-----------|--------|
| `www.etenders.gov.za/Home/PaginatedTenderOpportunities` | **Broken** — returns MVC view error (not JSON) |
| Opportunity detail `Home/opportunity?id={n}` | Often 404 for IDs that exist in OCDS |
| Additional public JSON feed powering the website UI | **Not confirmed** in Phase 17/18 audits without auth bypass |

## Conclusion

1. **OCDS parity ≠ eTenders website parity.**
2. No stable, lawful, documented public machine-readable website feed was found that exposes opportunities missing from OCDS.
3. Bulk Transparency Portal files are a legitimate **secondary official** source for monthly recovery, but Phase 18 does not enable them by default because day-keyed file URLs are not published as a stable index. Set `OCDS_BULK_ENABLED=true` and `OCDS_BULK_BASE_URL` only when a verified pattern exists.
4. TenderBriefing must not claim “exact eTenders catalogue” from OCDS-only reconciliation.

## Terms

National Treasury publication policy: data is a subset of public procurement shared with NT; public beta quality disclaimer applies. License: Creative Commons BY 4.0 / PDDL (via OCP registry notes).
