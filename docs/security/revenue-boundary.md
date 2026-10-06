# Revenue boundary — certified security invariant

**Status:** Production-certified  
**Certified production SHA:** `dc2771db7088bf7d48299b05157d78565a6dcea7`  
**PR that closed P0:** [#105](https://github.com/tenderbriefing/tender/pull/105)  
**Cloud Run revision at certification:** `tenderbriefing-00178-9h9`  
**Canonical current briefing price:** **R349.00 / 34 900 cents** (`BRIEFING_PRICE_CENTS`)

This document freezes the client/server trust boundary for booking and payment money paths. Do not change production behaviour in the protected areas below without revenue-boundary regression testing and Founder/security re-certification.

---

## 1. Client / server trust boundary

| Actor | May create `attendanceRequests` | May set money fields |
|-------|--------------------------------|----------------------|
| Browser / client SDK (SME, YA, anonymous) | **No** | **No** |
| Next.js Route Handlers / Admin SDK (server) | **Yes** | **Yes** (verified ITN, explicit exemption API, admin tooling) |

**Rule:** Clients never invent payment entitlement. Server services stamp `paymentStatus`, fee snapshots, and PayFast verification fields.

---

## 2. Protected Firestore operations

Collection: `attendanceRequests`

- **`allow create: if false`** — all client creates denied; Admin SDK / API only.
- **Updates** must keep privileged money keys unchanged via `attendancePrivilegedKeysUnchanged()` (payment status, amounts, snapshots, PayFast fields, etc.).
- Youth Agents cannot escalate payment state on bookings they can otherwise touch for operational fields.

Static guard: `npm run qa:firestore-rules`  
Dynamic guard: `tests/firestore/rules.payment-authority.test.ts` (+ IDOR matrix)

---

## 3. Canonical pricing authority

| Constant / function | Module | Role |
|---------------------|--------|------|
| `BRIEFING_PRICE_CENTS` (= 34900) | `lib/domain/briefingPricing.ts` (+ `backend/constants/briefingPricing.js`) | Current commercial price |
| `resolveRequestChargeCents(request)` | same | Charge / ITN expected amount |
| `briefingPriceSnapshotFields()` | same | Stamps on **new** server creates |

**Unpaid / pending / failed / not_required (for charge purposes):** ignore client- or historically-injected fee snapshots; always charge **current** canonical cents.

**Paid:** trust stored snapshot for accounting (verified historical paid amounts from earlier commercial epochs remain truthful and are not rewritten).

Optional env override `ATTENDANCE_FEE_CENTS` is server-only; never accept client-supplied price as authority for unpaid checkout.

---

## 4. PayFast trust boundary

- Checkout amount comes from `resolveRequestChargeCents` on the server (`attendancePaymentService`), not from the browser.
- ITN marks `paid` only after signature + PayFast validate + amount checks against the same resolver.
- Browser success/cancel pages never write `paymentStatus: paid` (see ADR-004).

---

## 5. Exemption authority (`not_required`)

- Clients cannot create or update to `not_required`.
- Server create may set `not_required` only when an explicit trusted option is set (e.g. `allowPaymentExemption`) — never because the SME payload asked for it.

---

## 6. Historical-record policy

Do **not** migrate, rewrite, normalise, delete, or bulk-edit historical payment records solely because they contain:

- paid amounts from an earlier commercial epoch (below current `BRIEFING_PRICE_CENTS`)  
- `not_required`  
- `paid` / `declined`  
- older fee snapshots  

Historical documents retain historical truth. **Current unpaid** transactions use current trusted canonical pricing (R349 / 34900).

---

## 7. Regression-test expectations (CI)

Minimum permanent guards (already wired into CI; preserve, do not weaken):

| Invariant | Primary coverage |
|-----------|------------------|
| Client create denied | `rules.payment-authority.test.ts`, `firestore-rules-qa.js` |
| SME cannot forge `not_required` / fees / PayFast fields / unpaid→paid | `rules.payment-authority.test.ts` |
| YA cannot manipulate payment state | `rules.payment-authority.test.ts` |
| Unauthenticated create denied | `rules.payment-authority.test.ts` |
| Legitimate server booking stamps pending + R349 | `paymentAuthority.test.ts` |
| Checkout / corrupted unpaid snapshots → 34900 | `paymentAuthority.test.ts`, `briefingPricing.test.ts` |
| Forged SME exemption ignored | `paymentAuthority.test.ts` |
| Unpaid price matrix (0, 1, 100, prior-epoch cents, 34899, 34900, 999999, missing, malformed, negative) → 34900 | `briefingPricing.test.ts` |
| Paid historical snapshot retained | `briefingPricing.test.ts` / `paymentAuthority.test.ts` |

---

## 8. Change-control — re-certification triggers

Any change touching the following requires **revenue-boundary regression** (unit + Firestore emulator payment-authority suite + rules QA) before merge/deploy:

- booking / attendance request creation  
- `attendanceRequests` schema or Firestore rules  
- canonical pricing modules  
- PayFast checkout / ITN / confirm / reconcile  
- payment exemptions / `not_required`  
- payment status transitions  
- assignment ↔ payment coupling  
- payout authorization tied to paid bookings  

Also re-certify after any production incident that could reopen client money writes or unpaid charge bypass.

**Do not** reopen `attendanceRequests` client `create` to “fix” booking UX. Fix forward on the server path while keeping hardened rules.

---

## 9. Related docs

- `docs/adr/004-server-authoritative-payment.md`  
- `docs/runbooks/PAYFAST.md`  
- `tests/firestore/README.md`  
- `docs/governance/RELEASE_STANDARD.md` (payment integrity + this boundary)
