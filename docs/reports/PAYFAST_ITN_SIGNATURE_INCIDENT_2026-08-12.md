# PayFast ITN signature rejection — incident certification

**Reference:** `TB-REQ-req-1786562638424-6nlcb3`  
**Date:** 2026-08-12  
**Starting production:** `tenderbriefing-00109-h6m` / SHA `7d2ee4506473d265b592cafaa50c6d11ccf37506`

## Executive verdict

Customer paid **R249.00** via PayFast (Google Pay). PayFast status **COMPLETE** (`pf_payment_id` **320990497**). TenderBriefing remained **pending** because ITN signature verification incorrectly **skipped empty fields**, causing HTTP **400** `Invalid ITN signature` on every PayFast retry. Request was **authoritatively reconciled** after PayFast `process/query` confirmation. Root-cause fix + regression tests shipped in this hotfix.

## Evidence

| Check | Result |
|-------|--------|
| PayFast `process/query/320990497` | `COMPLETE`, amount `24900`, m_payment_id `TB-REQ-req-1786562638424-6nlcb3` |
| PayFast daily history | `FUNDS_RECEIVED` CREDIT R249.00 GOOGLEPAY |
| ITN posts to `/api/webhooks/payfast` | Yes (5× ~21:43–21:47Z) |
| ITN HTTP result | **400** `Invalid ITN signature` |
| notify_url reachable | Yes (public POST returns signature error without auth) |
| Secrets present in Cloud Run | merchant id/key/passphrase mounted; mode `live` |

## Root cause

`verifyItnSignature` skipped empty values (checkout rules). PayFast ITN signatures **include** empty custom fields. Legitimate COMPLETE ITNs failed local MD5 check before PayFast server validate.

## Reconciliation

- Path: `reconcileAuthoritativePayfastPayment` → PayFast process/query → `markRequestPaid` → audit `payment_reconciled`
- Result: `paymentStatus=paid`, `payfastPaymentId=320990497`, workflow `request_paid` **completed once**; second reconcile **duplicate/idempotent**

## System-wide scan

PayFast history 2026-07-29 → 2026-08-13: **one** `TB-REQ-*` FUNDS_RECEIVED row (this incident). Other pending attendance docs had **no** matching PayFast COMPLETE evidence.
