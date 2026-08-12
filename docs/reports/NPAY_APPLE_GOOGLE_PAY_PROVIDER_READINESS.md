# Provider readiness — “nPay” Apple Pay / Google Pay

**Date (UTC):** 2026-08-12  
**Programme:** Additional wallet methods for R249 attendance payment  
**Executive verdict:** **FAIL** (blocked at Phase 0 — provider not positively identified)

## 1. What was searched

| Source | Result for “nPay” / NuPay / wallet credentials |
|--------|-----------------------------------------------|
| Application code (`backend/`, `lib/`, `app/`) | **No** payment provider named nPay / NuPay |
| `env.example`, `.env.local.example` | PayFast only (`PAYFAST_*`); no NPAY_* |
| GSM secrets (`tenderbriefing-34679`) | `payfast-merchant-id/key/passphrase` only; **no** nPay / NuPay / Yoco / Peach / Ozow / Stripe |
| `cloudbuild.yaml` secret mounts | PayFast + Resend + Twilio + Firebase; **no** nPay |
| Docs (`docs/`, ADR, acceptance) | Live rail = **PayFast**; Yoco **retired**; no nPay |
| Agent transcripts / prior certs | PayFast R249 CSP certification; Apple/Google noted as unavailable/not offered on PayFast hosted page in older pause note |

**Active production payment rail:** PayFast (`PAYFAST_MODE=live`), revision baseline `tenderbriefing-00109-h6m` / SHA `7d2ee45…`.

## 2. Candidate interpretations of “nPay” (not adopted)

| Candidate | Why not used as the integration target |
|-----------|----------------------------------------|
| **NuPay (Altron FinTech, SA)** — nupayments.co.za | Name is similar. Public ecommerce page describes an embedded portal for merchants with an **ABSA business account**. No TenderBriefing credentials, secrets, or API integration exist. Public pages reviewed do **not** document Apple Pay / Google Pay web wallet APIs for third-party apps. |
| **NuPay (Nubank / Brazil via Yuno)** | Different product (Brazil APM). Not SA ZAR merchant infrastructure for TenderBriefing. |
| **PayFast** | Production provider, **not** branded nPay. Does document Apple Pay (`ap`) and Google Pay (`gp`) on hosted checkout. |

Per programme rules: **do not assume** which of these the user meant, and **do not invent** APIs or credentials.

## 3. Authoritative docs consulted

| Provider | URL / artefact | Apple Pay | Google Pay | SA / ZAR | Web + webhook |
|----------|----------------|-----------|------------|----------|---------------|
| TenderBriefing repo | PayFast services, ITN route, CSP cert | N/A | N/A | ZAR R249 via PayFast | ITN verified |
| PayFast developers | https://developers.payfast.co.za/docs | Method code `ap` listed | Method code `gp` listed | SA gateway; ZAR | Hosted checkout + ITN |
| PayFast product | https://payfast.io/features/payment-methods/apple-pay/ | Dashboard enable; hosted page | — | SA | Merchant dashboard |
| PayFast product | https://payfast.io/features/payment-methods/google-pay/ | — | Dashboard enable; hosted page | SA | Merchant dashboard |
| NuPay ecommerce | https://www.nupayments.co.za/nupay-ecommerce | **Not documented** on page | **Not documented** on page | SA; ABSA account required | Portal / reporting; no public wallet API found |

## 4. Capability matrix for requested programme

| Requirement | nPay (as named) | PayFast (existing) |
|-------------|-----------------|--------------------|
| Positively identified in project | **No** | **Yes** |
| Merchant credentials in GSM | **No** | **Yes** |
| Apple Pay support (authoritative) | **Unknown / unsupported for this project** | Documented (`ap`); typically dashboard-enabled on hosted checkout |
| Google Pay support (authoritative) | **Unknown / unsupported for this project** | Documented (`gp`); typically dashboard-enabled on hosted checkout |
| SA merchant + ZAR | Unknown | **Yes** (live R249) |
| Server-side verification | Unknown | **Yes** (ITN + signature + validate) |
| Production ready for TenderBriefing | **No** | **Yes** (checkout page certified) |

## 5. Why implementation was not started

Phases 1–12 require a verified provider API/SDK, credentials, webhook contract, and Apple/Google merchant configuration. Starting code against an unidentified “nPay” would violate:

- “Do not invent APIs, SDKs, credentials…”
- “If the named provider cannot be positively identified … DO NOT fabricate an integration.”

PayFast already offers Apple Pay / Google Pay **on its hosted payment page** when those methods are enabled for the merchant account. That is a **merchant-dashboard configuration** path, not a new provider integration, and was **out of scope** while the named provider remains unidentified.

Observed on live PayFast engine during CSP cert (2026-08-12): card, Instant EFT, SnapScan, Zapper, Bank QR — **Apple Pay / Google Pay were not visible**, consistent with methods not enabled (or not eligible) on the merchant profile.

## 6. Minimum external actions (choose one path)

### Path A — Clarify provider (required before any “nPay” code)

1. Confirm exact legal/product name (e.g. NuPay Altron vs another brand).
2. Provide merchant account ID + production API credentials into GSM (names TBD by provider docs).
3. Provide official developer docs URL for web checkout + webhooks + Apple/Google Pay.
4. Complete Apple domain association / Google merchant setup as that provider requires.

### Path B — Enable wallets on **existing PayFast** (fastest for R249)

1. Log into PayFast Dashboard → payment methods.
2. Enable **Apple Pay** and **Google Pay** for the live merchant (`PAYFAST_MERCHANT_ID`).
3. Complete any PayFast/Apple domain verification PayFast requests for `www.tenderbriefing.co.za`.
4. Re-test hosted checkout from My Requests; confirm wallets appear for eligible devices.
5. No TenderBriefing code change required for basic hosted-page wallets (ITN already marks paid). Optional later: UX that deep-links `payment_method=ap|gp` if PayFast custom integration supports it.

### Path C — New PSP with first-class Apple/Google buttons

Select a documented SA PSP (e.g. Yoco online, Peach, etc.), provision credentials, then run the full architecture programme (provider-neutral payment intent, CSP, webhooks, certification). **Not started** without an explicit, credentialed provider.

## 7. Safety of current production

| Item | Status |
|------|--------|
| PayFast R249 checkout | Preserved; CSP `payment.payfast.io` certified |
| ITN as sole paid entitlement | Preserved |
| No fake Apple/Google buttons added | Yes |
| No fabricated nPay SDK | Yes |

## 8. Final programme verdict

**FAIL** — cannot implement or certify Apple Pay / Google Pay via “nPay” until the provider is positively identified and production credentials + authoritative wallet docs are available.

**Recommended immediate owner action:** Confirm whether you meant **(A)** NuPay/Altron, **(B)** enable Apple/Google on **PayFast**, or **(C)** another named PSP — then supply merchant access or GSM secrets accordingly.
