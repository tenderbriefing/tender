# TenderBriefing — Google SEO Recovery Production Certification

**Date:** 2026-08-20  
**Programme:** PR #44 Google Indexing & Technical SEO Recovery  
**Final production verdict:** **PASS WITH CONDITIONS**

---

## 1. Final Verdict

**PASS WITH CONDITIONS**

PR #44 is merged and deployed to production. Live www verification confirms crawlable SSR catalogue links, historical closed tenders at HTTP 200, genuine 404 for invalid IDs, correct robots/noindex on private routes, and a clean public sitemap. Playwright no-JS crawlability re-verified locally after Chromium browser install.

**Post-release conditions (Search Console — not code defects):**
1. Resubmit `https://www.tenderbriefing.co.za/sitemap.xml` in Google Search Console.
2. URL Inspection on representative samples; Validate Fix Soft 404 after Google can retrieve corrected URLs.
3. Monitor Crawled/Discovered-not-indexed for 2–4 weeks.
4. Plan sitemap segmentation before ~4,000 indexable tender URLs.

---

## 2–6. Release Identifiers

| Item | Value |
|------|-------|
| **PR** | [#44](https://github.com/tenderbriefing/tender/pull/44) |
| **Final PR head SHA** | `dfdfae6cc7804d33af6a5242f75fb067f169f380` |
| **Merge SHA (master)** | `3f18f98a0710aa95968979e0361b0891c46a2b00` |
| **Merged at** | 2026-08-20T07:47:02Z |
| **Production SHA** | `3f18f98a0710aa95968979e0361b0891c46a2b00` |
| **Deploy workflow** | [Deploy TenderBriefing #32345637700](https://github.com/tenderbriefing/tender/actions/runs/32345637700) — **success** |
| **Deploy started** | 2026-08-20T07:47:25Z |
| **Cloud Build (africa-south1)** | `548b5638-6490-4dda-8091-9aba31f307ca` — **SUCCESS** |
| **Container image tag** | `…/tenderbriefing/tenderbriefing:548b5638-6490-4dda-8091-9aba31f307ca` |
| **Production revision** | Cloud Run revision created by build `548b5638-…` (local `gcloud run describe` denied for active user account; deploy job + health verify job succeeded) |
| **GitHub CI (PR tip)** | [CI #32344583485](https://github.com/tenderbriefing/tender/actions/runs/32344583485) — all jobs **SUCCESS** (typecheck/lint/unit, Firestore emulator, build, Playwright) |
| **GitHub CI (master push)** | [CI #32345611467](https://github.com/tenderbriefing/tender/actions/runs/32345611467) — **SUCCESS** |
| **PR #43** | Untouched |

---

## 7–12. Quality Gates (re-verified 2026-08-20)

| Gate | Result |
|------|--------|
| **Targeted SEO Playwright** | **PASS** — 2 executed, **2 passed**, 0 failed, 0 skipped (`tests/e2e/seo-crawlability.spec.ts`, `javaScriptEnabled: false`) |
| **Full Playwright** | **PASS** — 23 executed, **18 passed**, **5 skipped**, **0 failed** |
| Playwright skips | Founder V2 signed-in (3) — needs founder auth; Authenticated SME token (2) — optional secrets unset |
| Browser install | `npx playwright install chromium` hung on extract; Chromium + headless-shell **1148** installed via CDN zip extract; CI path unchanged |
| Unit/integration | PASS (**266** on PR tip; architecture unchanged) |
| Build | PASS (CI + prior local) |
| Typecheck / Lint | PASS (CI) |
| QA/security gates | PASS (CI + deploy auth/firestore QA jobs) |

---

## 13–22. Production www verification (2026-08-20)

| Check | Result |
|-------|--------|
| **`/tenders`** | HTTP **200**; title catalogue; `robots=index,follow`; canonical `…/tenders`; **39** crawlable `/tenders/tb-*` links in raw HTML (no JS) |
| **`/tenders/gauteng`** | HTTP **200**; self-canonical; heading “Matching opportunities”; **12** SSR tender detail links in HTML |
| **Active tender** `tb-166207` | HTTP **200**; indexable; self-canonical; meaningful title; Event JSON-LD `EventScheduled`; BreadcrumbList; compulsory briefing Event name present |
| **Closed tender** `tb-156945` | HTTP **200**; visible “Tender closed”; historical content present; indexable; self-canonical; Related active tenders; EventPast; **no** visible soft-404 empty state (RSC payload may reference not-found module — not rendered) |
| **Invalid** `/tenders/invalid-id-000` | HTTP **404**; `robots=noindex`; not a fake 200 |
| **Canonicals** | Catalogue, Gauteng, active, closed — all self-referencing as designed |
| **Structured data** | Organization/WebSite global; BreadcrumbList + Event(briefing) on tender; EventPast when closed |
| **Sitemap** | HTTP **200**; **489** tender URLs; no `/admin|/founder|/agent|/sme|/api|/auth/signin` leaks |
| **Robots** | HTTP **200**; allows `/`; disallows private/ops/auth session routes; Sitemap + Host set |
| **Private `/founder`** | HTTP 200 shell with `robots=noindex, nofollow` (auth gate client-side; indexing blocked) |

---

## 23. Search Console actions (operator)

1. **Submit/resubmit** sitemap: `https://www.tenderbriefing.co.za/sitemap.xml`
2. **URL Inspection** (small set): active tender, closed historical (former Soft 404), `/tenders`, `/tenders/gauteng`, one new tender if available
3. **Validate Fix** Soft 404 only after corrected URLs retrieve successfully
4. **Do not** Validate Fix intentional noindex or legitimate 404s
5. Monitor Crawled/Discovered-not-indexed ~2–4 weeks

---

## 24. Remaining limitations

1. Catalogue filters remain client-localStorage (canonical stays `/tenders` — intentional).
2. Category programmatic pages may return fewer matches from one bounded page (by design).
3. Authenticated Playwright walks optional without secrets.
4. Local `gcloud run describe` not available under current CLI account — revision identity taken from successful deploy/build artifacts.
5. GSC metrics lag deploy by days/weeks.

---

## 25. Monitoring recommendation

- Track indexable compulsory tender count via catalogue summary aggregates.
- Plan sitemap index when approaching **~4,000** indexable URLs (see `lib/seo/sitemapPolicy.ts`).
- Watch Soft 404 and crawled-not-indexed trends after Validate Fix.

---

## Related certification

Pre-merge technical detail: `docs/reports/GOOGLE_INDEXING_SEO_CERTIFICATION.md`  
This document is the **production release** certification after merge + deploy + www smoke.
