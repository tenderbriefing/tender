# TenderBriefing — Google Indexing & Technical SEO Certification

**Date:** 2026-08-20  
**Branch:** `fix/google-indexing-seo-recovery`  
**Starting SHA:** `29e5ea486ce52f9edcb7cb67ea4e50a15ffbb18d`  
**Final SHA:** `ae79d9abe6b3173ddf49ff66d9f5f266779698c9`  
**PR:** _(set after PR creation)_  
**Verdict:** **PASS WITH CONDITIONS**

---

## 1. Executive Verdict

**PASS WITH CONDITIONS**

TenderBriefing now separates **live catalogue visibility** from **historical tender detail indexing**. Expired compulsory briefings return HTTP 200 with substantive server-rendered content instead of hard 404s or client-side “not found” shells at HTTP 200. Invalid records return genuine 404. Sitemap, robots, metadata, canonicals, and noindex policies were hardened without changing unrelated business workflows.

**Conditions (post-deploy):**
1. Submit updated sitemap in Google Search Console and validate Soft 404 fix after recrawl (2–4 weeks).
2. URL Inspection on representative samples listed in §31.
3. Catalogue and programmatic browse pages remain partially client-rendered — monitor “Crawled – currently not indexed” after this deploy.

---

## 2. Root Cause of Soft 404s (~146)

| Cause | Mechanism |
|-------|-----------|
| **Primary** | Expired compulsory briefings were removed from public visibility at briefing cut-off and returned **HTTP 404**, while Google still held previously indexed URLs that had returned **HTTP 200** with thin or “not found” content. |
| **Secondary** | `/tenders/[id]` was a client component that rendered “Tender opportunity not found” at **HTTP 200** when the API fetch failed or raced the briefing cut-off. |
| **Tertiary** | Valid tender pages SSR’d only a loading spinner; crawlers saw thin HTML despite rich metadata. |

---

## 3. Soft 404 Remediation

- Introduced `isPublicDetailVisibleToViewer()` — compulsory public records remain on detail pages after briefing cut-off.
- Converted `/tenders/[id]` to a **server-rendered page** with `notFound()` for invalid records (genuine 404).
- Removed client-side “not found at 200” code path entirely.
- `TenderHero` and `TenderIntelligence` render in initial HTML (no `'use client'`).
- Empty compulsory records without title, number, description, summary, or documents → **404**.

---

## 4. noindex Audit

Documented in `lib/seo/indexingPolicy.ts`. Reinforced with metadata on:

| Route class | Mechanism |
|-------------|-----------|
| `/founder/**`, `/admin/**` | Existing `PRIVATE_ROUTE_ROBOTS` + robots disallow |
| `/agent/workspace/**` | Added `PRIVATE_ROUTE_ROBOTS` |
| `/agent/dashboard/**` | Existing |
| `/sme/**` workspace routes | robots disallow expanded |
| `/auth/signin/**` | New layout + robots disallow |
| `/settings/**` | New layout + robots disallow |
| `/tenders/[id]/request-agent` | New layout noindex |
| Missing tender/resource | `noIndex: true` in metadata |
| Global 404 | `app/not-found.tsx` with noindex |

**Intentionally indexable:** `/auth/signup`, marketing landings, `/tenders`, programmatic browse pages, historical tender detail pages.

---

## 5. Legitimate 404 Analysis (16 reported)

Correct 404 behaviour preserved for:

- Non-existent tender IDs
- Non-compulsory tenders (never public catalogue records)
- Private RFQs (anonymous access)
- Empty shell records without useful content
- Dev/test routes (middleware 404 in production)

These should **not** be “fixed” — ensure they stay out of sitemap and internal links.

---

## 6. Crawled – Not Indexed (43)

Likely contributors addressed systemically:

- Thin CSR-only HTML on tender detail → **fixed** (SSR content)
- Expired tender 404s → **fixed** (historical 200 pages)
- Duplicate/thin metadata → **improved** (unique titles with org + tender number)

Remaining contributors (monitor post-deploy):

- CSR catalogue at `/tenders` (links appear after hydration)
- Programmatic browse pages with zero live matches (valid but thin)
- Google quality assessment lag on previously soft-404 URLs

---

## 7. Discovered – Not Indexed (32)

Improvements:

- Sitemap now includes **historical + active** indexable compulsory tenders via `getIndexableTenders()`
- Closed tender pages link to **Related active tenders** and `/tenders`
- Internal links on detail pages remain in server HTML

Monitor crawl depth on large historical corpus after sitemap resubmit.

---

## 8. Canonical Audit

- Canonical base: `https://www.tenderbriefing.co.za` via `lib/seo/site.ts`
- Each indexable page sets `alternates.canonical` through `buildPageMetadata({ path })`
- Tender detail: self-referencing `/tenders/{id}`
- Apex → www **308** in middleware (existing)
- Static programmatic slugs (`/tenders/gauteng`) take precedence over dynamic `[id]`

No redirect loops introduced.

---

## 9. Sitemap Audit

`app/sitemap.ts` includes:

- Homepage, catalogue, marketing pages, SEO landings, programmatic browse, resources
- Up to 5,000 **indexable** tender URLs (`getIndexableTenders()`)

Excludes:

- Private/auth/dashboard routes
- `/api/**`
- Non-compulsory / private / empty records
- `/tenders/[id]/request-agent`

---

## 10. Robots.txt Audit

Expanded disallow list for `/agent/workspace`, `/settings`, `/auth/signin`, SME onboarding/book-agent, `/jobs`.  
Allows public tender pages, sitemap, and Next.js assets.  
`Sitemap: https://www.tenderbriefing.co.za/sitemap.xml`

---

## 11. Tender Lifecycle Policy

| State | HTTP | Index | Sitemap | Behaviour |
|-------|------|-------|---------|-----------|
| **Active** | 200 | yes | yes | Full detail, agent booking available |
| **Closed / expired briefing** | 200 | yes | yes | “Tender closed” banner, historical content, related active links |
| **Invalid / never public** | 404 | no | no | `notFound()` — no fake 200 |

Catalogue list APIs and `/tenders` remain **live-only** (upcoming briefings).

---

## 12–18. Tender Behaviours

### Active tender
- HTTP 200, indexable, self-canonical, Event JSON-LD `EventScheduled`, full metadata

### Closed tender
- HTTP 200, indexable, closed metadata copy, `EventPast` JSON-LD, closed banner, related active tenders

### Invalid tender
- HTTP 404 via `notFound()`, noindex metadata if metadata phase runs, excluded from sitemap

---

## 19. Metadata Implementation

- Title pattern: `{Scope/Title} | {Organisation}` via `buildTenderPageTitle()`
- Description pattern: tender number, organisation, province, dates; closed variant for historical records
- Missing tenders: noindex

---

## 20. Structured Data

- Global `Organization` + `WebSite` (existing)
- Tender detail: `BreadcrumbList` + `Event` (status reflects closed/active)
- No fabricated Job/Product schema

---

## 21. Internal Linking

- Closed tender pages: `RelatedActiveTenders` + footer link to `/tenders`
- `TenderHero` back link, province/category preserved in content
- Catalogue CSR limitation noted as known follow-up

---

## 22. SEO Automated Tests

`tests/unit/seoRecovery.test.ts` — metadata, canonical, closed tender, noindex policy, invalid record detection  
`tests/unit/publicTenderVisibility.test.ts` — catalogue vs detail visibility split

---

## 23–29. QA Evidence

| Gate | Result |
|------|--------|
| Typecheck | PASS |
| Lint | PASS (pre-existing hook warning in unrelated file) |
| Unit/integration tests | PASS (253 tests) |
| Build | PASS |
| Playwright | Not run (no SEO e2e spec on master baseline) |
| Firestore emulator | Not run (no SEO-specific emulator tests) |
| qa:secrets-scan | PASS |
| qa:config | PASS |
| qa:route-retirement | PASS |
| qa:firestore-rules | PASS |
| qa:google-auth | PASS |

---

## 30. Known Limitations

1. `/tenders` catalogue remains client-rendered — tender links not in initial HTML.
2. Programmatic browse pages (`/tenders/gauteng`, etc.) CSR tender lists.
3. Sitemap capped at 5,000 tender URLs — segmented sitemaps not yet required.
4. GSC recovery requires recrawl time; historical 404 URLs may persist in reports temporarily.

---

## 31. Search Console Actions After Deployment

### Validate Fix
- **Soft 404** — after deploy + 48h, validate fix on sample expired tender URLs that previously 404’d

### Monitor (do not validate as defects)
- **Excluded by noindex** — `/admin`, `/founder`, `/agent/workspace`, `/auth/signin`, etc.
- **Not found (404)** — invalid tender IDs, non-compulsory records
- **Crawled / Discovered – not indexed** — recheck in 2–4 weeks

### Resubmit
- Sitemap: `https://www.tenderbriefing.co.za/sitemap.xml`

### URL Inspection samples
1. Active tender — any live compulsory briefing from `/tenders`
2. Closed tender — previously soft-404 expired briefing URL
3. Invalid tender — `/tenders/invalid-id-000`
4. Catalogue — `https://www.tenderbriefing.co.za/tenders`
5. Province page — `https://www.tenderbriefing.co.za/tenders/gauteng`
6. Private route — `https://www.tenderbriefing.co.za/agent/workspace/today` (expect noindex)

---

## 32. Recommended Next Action

1. Merge PR after approval.
2. Deploy to production.
3. Resubmit sitemap in GSC.
4. Validate Soft 404 fix with 5–10 sample URLs.
5. Follow-up PR (optional): SSR tender links on `/tenders` catalogue for crawl discovery.

---

**Certification author:** Cursor Agent (SEO recovery sprint)  
**Separate from:** PR #43 Briefing Intelligence — this branch created from `origin/master`.
