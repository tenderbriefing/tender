# TenderBriefing — Google Indexing & Technical SEO Certification

**Programme:** PR #44 — Google Indexing & Technical SEO Recovery (Final Release Certification)  
**Date:** 2026-08-20  
**Branch:** `fix/google-indexing-seo-recovery`  
**PR:** https://github.com/tenderbriefing/tender/pull/44  
**Starting SHA:** `29e5ea486ce52f9edcb7cb67ea4e50a15ffbb18d`  
**Prior certified SHA:** `6fafbab` / `0c2f5ec`  
**Final SHA:** `dfdfae6cc7804d33af6a5242f75fb067f169f380` (PR tip before merge)  
**Merge SHA:** `3f18f98a0710aa95968979e0361b0891c46a2b00`  
**Verdict:** **PASS WITH CONDITIONS** (pre-merge). **Production release:** see `docs/reports/GOOGLE_SEO_RECOVERY_PRODUCTION_CERTIFICATION.md` — **PASS WITH CONDITIONS** after merge `3f18f98` + deploy run `32345637700` + www smoke + Playwright re-verify (2/2 SEO, 18/23 full with 5 intentional skips).

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
- **Playwright no-JavaScript crawlability tests PASS** against a live production build.

**Conditions (post-merge / post-deploy — not merge blockers):**
1. After production deploy: resubmit sitemap and Validate Fix Soft 404 samples in Google Search Console (2–4 week recrawl window).
2. Monitor sitemap volume against segmentation trigger at ~4,000 indexable URLs.

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

**Implemented and browser-verified.**

- Server page calls `getCatalogueInitialPage()` — **one** `listTenderBriefingsPage` read (`pageSize: 40`, `scanBudget: 160`).
- `TenderCatalogueStaticList` renders crawlable table + mobile links in initial HTML.
- Playwright with `javaScriptEnabled: false` found live `href="/tenders/{id}"` links.
- Raw curl of production build HTML confirmed multiple tender detail links without JS.

---

## 5. Programmatic Browse SSR Status

**Implemented and browser-verified** for all 7 existing pages.

Playwright `/tenders/gauteng` (JS disabled): page heading, View/Browse all tenders CTAs, and crawlable tender detail links present when catalogue has Gauteng matches.

---

## 6. No-JavaScript Crawlability Result

| Test | Result |
|------|--------|
| `tests/unit/seoCrawlability.test.ts` — `renderToStaticMarkup` | **PASS** |
| `tests/e2e/seo-crawlability.spec.ts` — Playwright JS disabled | **PASS** (2/2) |
| Raw HTML curl `/tenders` | Multiple `/tenders/tb-*` links present |
| Raw HTML curl `/tenders/gauteng` | Multiple `/tenders/tb-*` links present |

Locator fix: Gauteng assertion uses role-based “View all tenders” / “Browse all tenders” (strict-mode safe when multiple `/tenders` nav links exist).

---

## 7. Query Bounds / Performance Safeguards

| Page / function | Reads | Limits |
|-----------------|-------|--------|
| `getCatalogueInitialPage()` | 1× `listTenderBriefingsPage` | pageSize 40, scanBudget 160 |
| `getProgrammaticBrowseTenders()` | 1× paginated read | scanBudget 160, returns ≤12 |
| Closed tender related links | 1× `getCatalogueInitialPage()` | pageSize 40 |
| Sitemap `getIndexableTenders()` | Up to 25 pages × 80 | cap 2000 records, slice 5000 URLs |

---

## 8–14. Architecture (unchanged from prior certification)

- Historical quality gate: `tenderHasUsefulHistoricalContent()`
- Canonicals: `/tenders`, `/tenders/{slug}`, `/tenders/{id}` self-referencing; filters not in URL
- Event JSON-LD: compulsory briefing only; omit if insufficient
- Sitemap: single file, 5000 URL cap; segmentation trigger ~4000
- Robots/noindex: founder, admin, agent workspace, settings, signin, request-agent
- Internal links: province/category/related active on detail pages

---

## 15. SEO Automated Tests

| File | Coverage |
|------|----------|
| `tests/unit/seoRecovery.test.ts` | Metadata, canonical, lifecycle, noindex |
| `tests/unit/seoCrawlability.test.ts` | SSR links, bounds, Event JSON-LD, canonicals |
| `tests/unit/publicTenderVisibility.test.ts` | Catalogue vs detail visibility |
| `tests/unit/hotPathSafeguard.test.ts` | Bounded catalogue SSR |
| `tests/e2e/seo-crawlability.spec.ts` | No-JS Playwright against live server |

---

## 16–25. QA Evidence (pre-merge)

| Gate | Result |
|------|--------|
| Typecheck | PASS |
| Lint | PASS (pre-existing unrelated hook warning) |
| Unit/integration tests | PASS (**266** tests) |
| Build | PASS |
| Targeted SEO Playwright | **PASS** — 2 executed, 2 passed, 0 failed, 0 skipped |
| Full Playwright suite | **PASS** — 23 executed, **18 passed**, **5 skipped**, **0 failed** |
| Playwright skips | Founder Dashboard V2 signed-in walkthrough (3) — needs founder auth; Authenticated workflows SME token (2) — optional secrets not set |
| Firestore emulator | Not affected — not run |
| qa:secrets-scan | PASS |
| qa:config | PASS |
| qa:route-retirement | PASS |
| qa:firestore-rules | PASS |
| qa:google-auth | PASS |

Browser install note: `npx playwright install chromium` hung on extract locally; `chromium-headless-shell` build **1148** was installed via curl from Playwright CDN and verified at `ms-playwright/chromium_headless_shell-1148/chrome-mac/headless_shell`. CI continues to use `npx playwright install chromium`.

---

## 26. Known Limitations

1. Category programmatic pages may show fewer matches when the first bounded page has no filter hits (by design).
2. Interactive catalogue filters remain client-side; canonical stays `/tenders`.
3. GSC Soft 404 / crawled-not-indexed recovery requires post-deploy recrawl time.
4. Authenticated Playwright walks remain optional without `E2E_*` secrets.

---

## 27. Search Console Post-Deployment Procedure

### Validate Fix
- **Soft 404** — sample previously expired tender URLs after 48h

### Resubmit
- `https://www.tenderbriefing.co.za/sitemap.xml`

### Monitor (not defects)
- Intentional noindex exclusions
- Legitimate 404s for invalid IDs
- Crawled / Discovered – not indexed (2–4 weeks)

### URL Inspection samples
1. Active tender from `/tenders`
2. Closed historical tender
3. `/tenders/invalid-id-000` (404)
4. `/tenders` (view source — confirm `<a href="/tenders/...">`)
5. `/tenders/gauteng`
6. `/agent/workspace/today` (noindex)

---

## 28. Release status (completed)

1. GitHub CI green on final PR tip `dfdfae6` — **done**.
2. **Merged PR #44** → master `3f18f98` at 2026-08-20T07:47:02Z — **done**.
3. Deployed via [Deploy TenderBriefing #32345637700](https://github.com/tenderbriefing/tender/actions/runs/32345637700) — **success**.
4. Production SEO smoke + Playwright re-verify — **done** (see production certification).
5. Remaining operator step: Search Console sitemap resubmit + Soft 404 Validate Fix.

---

**Separate from PR #43 (Briefing Intelligence).**  
**Production certification:** `docs/reports/GOOGLE_SEO_RECOVERY_PRODUCTION_CERTIFICATION.md`
