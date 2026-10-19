# Phase 19 — eTenders website source investigation

## Probed public endpoints (lawful GET only)

| Endpoint | Expected | Observed policy |
|----------|----------|-----------------|
| `https://www.etenders.gov.za/Home/PaginatedTenderOpportunities` | Structured opportunity list | Historically returns MVC error HTML — treated as `SOURCE_UNAVAILABLE` |
| `https://data.etenders.gov.za/Home/ReleasesFiles` | Transparency portal file index | HTML/JS portal — not a day-keyed stable JSON index by default |

## Ingest rules

1. Website data is labeled `ETENDERS_WEBSITE` / confidence `OFFICIAL_PUBLIC`.
2. Website data is **never** labeled as OCDS.
3. Records are ingested only when a verified public **structured tender-shaped** payload is returned.
4. HTML / MVC errors / empty bodies **do not invent** `websiteDiscoverableCount`.
5. No authentication bypass, CAPTCHA bypass, or rate-limit evasion.

## Parity implications

- Without a complete website discoverable universe, **FULL WEBSITE PARITY** cannot be certified.
- Day metrics may show `parityStatus=INCOMPLETE_WEBSITE_UNIVERSE` while OCDS reachable parity remains valid.
