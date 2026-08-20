# TenderBriefing — Google Indexing & Technical SEO Certification

**Programme:** PR #44 — Google Indexing & Technical SEO Recovery (Final Release Certification)  
**Date:** 2026-08-20  
**Branch:** `fix/google-indexing-seo-recovery`  
**PR:** https://github.com/tenderbriefing/tender/pull/44  
**Starting SHA:** `29e5ea486ce52f9edcb7cb67ea4e50a15ffbb18d`  
**Prior certified SHA:** `6fafbab`  
**Final SHA:** `e73fb1b`  
**Verdict:** **PASS WITH CONDITIONS**

---

## 1. Executive Verdict

**PASS WITH CONDITIONS**

PR #44 establishes a production-safe SEO architecture where:

- Invalid tenders return genuine HTTP **404** (no soft-404 shells at HTTP 200).
- Closed compulsory briefings remain **indexable historical records** at HTTP 200.
- **`/tenders` and programmatic browse pages** server-render crawlable `<a href="/tenders/{id}">` links in initial HTML.
- Catalogue queries remain **bounded** (single paginated read per SSR request).
- Event JSON-LD describes **compulsory briefings only**, omitted when data is insufficient.
- Private routes remain **noindex** / robots-disallowed.

**Conditions:**
1. Playwright e2e requires `npx playwright install` in CI/local before `seo-crawlability.spec.ts` runs (unit HTML tests pass as substitute).
2. Post-deploy GSC validation on Soft 404 samples (2–4 week recrawl window).
3. Monitor sitemap volume against segmentation trigger (§16).

---

## 2. Soft 404 Root Cause

| Cause | Detail |
|-------|--------|
| **Primary** | Expired compulsory briefings returned HTTP **404** while Google retained previously indexed URLs. |
| **Secondary** | Client-rendered `/tenders/[id]` showed “not found” UI at HTTP **200** on API failure. |
| **Tertiary** | `/tenders` and programmatic browse pages had **no tender links in initial HTML** (CSR-only after hydration). |

---

## 3. Tender Lifecycle Implementation

| State | HTTP | Index | Catalogue | Detail page |
|-------|------|-------|-----------|-------------|
| Active compulsory | 200 | yes | yes | yes |
| Closed compulsory | 200 | yes | no (live list) | yes (historical) |
| Invalid / empty | 404 | no | no | no |

- `isPlatformVisibleToViewer` — live catalogue cut-off (briefing datetime).
- `isPublicDetailVisibleToViewer` — detail + sitemap historical records.
- `tenderHasUsefulHistoricalContent()` — rejects empty shells (404).

---

## 4. `/tenders` SSR Status

**Implemented.**

- Server page calls `getCatalogueInitialPage()` — **one** `listTenderBriefingsPage` read (`pageSize: 40`, `scanBudget: 160`).
- `TenderCatalogueStaticList` renders crawlable table + mobile links in initial HTML.
- `TenderOpportunitiesClient` hydrates filters, sort, pagination, polling with same initial data.
- SSR list hidden after hydration; interactive UI takes over (progressive enhancement).

---

## 5. Programmatic Browse SSR Status

**Implemented** for all 7 existing pages:

- `/tenders/gauteng`, `/western-cape`, `/kwazulu-natal`
- `/tenders/construction`, `/ict`, `/security-services`, `/cleaning-services`

Each page:
- Async server component fetches via `getProgrammaticBrowseTenders()`.
- Province slugs push `province` filter to storage; category slugs filter in-memory on bounded page.
- `ProgrammaticTenderStaticList` renders crawlable links server-side.
- Deterministic canonical per slug via `buildProgrammaticMetadata()`.

---

## 6. No-JavaScript Crawlability Result

| Test | Result |
|------|--------|
| `tests/unit/seoCrawlability.test.ts` — `renderToStaticMarkup` link assertions | **PASS** |
| `tests/e2e/seo-crawlability.spec.ts` — Playwright JS disabled | **BLOCKED** (browsers not installed locally) |

Unit tests verify `href="/tenders/{id}"` in static HTML for catalogue and programmatic list components.

---

## 7. Query Bounds / Performance Safeguards

| Page / function | Reads | Limits |
|-----------------|-------|--------|
| `getCatalogueInitialPage()` | 1× `listTenderBriefingsPage` | pageSize 40, scanBudget 160 |
| `getProgrammaticBrowseTenders()` | 1× paginated read | scanBudget 160, returns ≤12 |
| Closed tender related links | 1× `getCatalogueInitialPage()` | pageSize 40 (not 2000 scan) |
| Sitemap `getIndexableTenders()` | Up to 25 pages × 80 | cap 2000 records, slice 5000 URLs |
| `/api/tender-briefings` | Unchanged | pageSize 40 default |

`tests/unit/hotPathSafeguard.test.ts` guards catalogue SSR against full-catalogue scan loops.

---

## 8. Historical Tender Quality Policy

Indexable when **all** of:
- `isPublicDetailVisibleToViewer` (compulsory + public)
- `tenderHasUsefulHistoricalContent()` (title, number, scope, description, summary, or documents)

Otherwise → `notFound()` (404). No filler SEO text generated.

---

## 9. Canonical Implementation

| Route | Canonical |
|-------|-----------|
| `/tenders` | `https://www.tenderbriefing.co.za/tenders` |
| `/tenders/gauteng` etc. | Self-referencing `/tenders/{slug}` |
| `/tenders/{id}` | Self-referencing `/tenders/{id}` |
| Filter state | Client-localStorage only — **no URL query permutations** |

---

## 10. Structured Data Audit

| Schema | Usage |
|--------|-------|
| `WebSite` + `Organization` | Global layout — unchanged |
| `BreadcrumbList` | Tender detail, programmatic browse |
| `Event` | **Compulsory briefing/site meeting only** via `buildTenderBriefingEventJsonLd()` |

Event omitted when:
- Not compulsory
- Missing briefing date/time instant
- Missing location (venue, province, or meeting link)

Closed briefings: `EventPast` when briefing datetime passed.

---

## 11. Sitemap Status

- Single `sitemap.xml` — static, landings, programmatic, resources, indexable tenders.
- Cap: `SITEMAP_TENDER_URL_CAP` = 5000 (`lib/seo/sitemapPolicy.ts`).

---

## 12. Sitemap Scaling Trigger

Plan segmentation when:
- Indexable compulsory count exceeds **4,000** (80% of URL cap), OR
- `getIndexableTenders()` 2000-record scan misses eligible URLs, OR
- `slice(0, 5000)` truncates eligible records.

Future: `/sitemap.xml` → index with static, landings, active-tenders, historical-tenders segments.

---

## 13. Robots / noindex Status

Unchanged from prior certification + reinforced:
- `/founder/**`, `/admin/**`, `/agent/workspace/**`, `/settings`, `/auth/signin`, request-agent flow
- Documented in `lib/seo/indexingPolicy.ts`

---

## 14. Internal Linking

Tender detail pages include:
- `TenderDetailContextLinks` — province browse (when slug exists), category browse (when match), `/tenders`
- `RelatedActiveTenders` — closed tenders, bounded active catalogue page
- Breadcrumb JSON-LD

Crawl graph: Home → Tenders → Province/Category → Tender → Related Active Tender

---

## 15. SEO Automated Tests

| File | Coverage |
|------|----------|
| `tests/unit/seoRecovery.test.ts` | Metadata, canonical, lifecycle, noindex |
| `tests/unit/seoCrawlability.test.tsx` | SSR links, bounds, Event JSON-LD, canonicals |
| `tests/unit/publicTenderVisibility.test.ts` | Catalogue vs detail visibility |
| `tests/unit/hotPathSafeguard.test.ts` | Bounded catalogue SSR |
| `tests/e2e/seo-crawlability.spec.ts` | No-JS Playwright (requires browser install) |

---

## 16–25. QA Evidence

| Gate | Result |
|------|--------|
| Typecheck | PASS |
| Lint | PASS (pre-existing unrelated hook warning) |
| Unit/integration tests | PASS (266 tests) |
| Build | PASS |
| Playwright | BLOCKED locally (browser binary missing); spec added |
| Firestore emulator | Not affected — not run |
| qa:secrets-scan | PASS |
| qa:config | PASS |
| qa:route-retirement | PASS |
| qa:firestore-rules | PASS |
| qa:google-auth | PASS |

---

## 26. Known Limitations

1. Playwright e2e requires `npx playwright install` before CI/local e2e run.
2. Category programmatic pages may show fewer matches when first bounded page has no filter hits (by design — no unbounded scan).
3. Interactive catalogue filters remain client-side; canonical stays `/tenders`.
4. GSC recovery requires recrawl time after deploy.

---

## 27. Search Console Post-Deployment Procedure

### Validate Fix
- **Soft 404** — sample previously expired tender URLs after 48h

### Resubmit
- `https://www.tenderbriefing.co.za/sitemap.xml`

### Monitor (not defects)
- Intentional noindex exclusions
- Legitimate 404s for invalid IDs

### URL Inspection samples
1. Active tender from `/tenders`
2. Closed historical tender
3. `/tenders/invalid-id-000` (404)
4. `/tenders` (view page source — confirm `<a href="/tenders/...">`)
5. `/tenders/gauteng`
6. `/agent/workspace/today` (noindex)

---

## 28. Recommended Release Action

1. **Approve and merge PR #44** (explicit approval required).
2. Deploy to production.
3. Run `npx playwright install && npm run test:e2e -- tests/e2e/seo-crawlability.spec.ts` in CI.
4. Resubmit sitemap; validate Soft 404 fix on samples.
5. Monitor index coverage over 2–4 weeks.

---

**Separate from PR #43 (Briefing Intelligence). Do not merge or deploy without explicit approval.**
