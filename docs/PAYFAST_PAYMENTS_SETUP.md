# PayFast payments — attendance support fee

TenderBriefing charges SMEs **R249.00** (`24900` cents / `249.00` ZAR) via **PayFast** when they request Youth Agent attendance at a compulsory tender briefing. Youth Agents only see requests after payment is confirmed (`paymentStatus: paid`). Legacy requests may use `not_required`.

Yoco has been retired; use PayFast only.

## 1. PayFast account

1. Sign up / log in at [https://www.payfast.co.za/](https://www.payfast.co.za/).
2. Complete merchant verification for **live** payments.
3. Settings → Integration: copy **Merchant ID** and **Merchant Key**.
4. Set a **Salt Passphrase** (Settings → Security / Account Information).

Sandbox (optional): [https://sandbox.payfast.co.za/](https://sandbox.payfast.co.za/) — separate merchant ID/key/passphrase. Set `PAYFAST_MODE=sandbox` to use sandbox process URL.

## 2. Environment variables

| Variable | Purpose |
|----------|---------|
| `PAYFAST_MERCHANT_ID` | Merchant ID |
| `PAYFAST_MERCHANT_KEY` | Merchant key |
| `PAYFAST_PASSPHRASE` | Salt passphrase (required for signed ITNs) |
| `PAYFAST_MODE` | `live` (default in Cloud Run) or `sandbox` |
| `NEXT_PUBLIC_ATTENDANCE_FEE_CENTS` | Default `24900` |
| `NEXT_PUBLIC_ATTENDANCE_FEE_LABEL` | Default `R249.00` |

## 3. ITN notify URL

Register / override notify URL:

```
https://www.tenderbriefing.co.za/api/webhooks/payfast
```

Cloud Run direct (fallback):

```
https://tenderbriefing-xzgs5uw5ta-bq.a.run.app/api/webhooks/payfast
```

Handler flow:

1. Verify MD5 ITN signature (with passphrase)
2. Re-POST payload to PayFast `eng/query/validate` (`VALID` required)
3. On `payment_status=COMPLETE`, mark attendance request `paid` using `custom_str1` (requestId) / `m_payment_id` (`TB-REQ-{id}`)
4. Dispatch `request_paid` workflow so agents can accept

Responds with plain `OK` (HTTP 200).

## 4. Secret Manager + Cloud Run

```bash
bash scripts/payfast-secret-manager-setup.sh
```

Or manually:

```bash
gcloud secrets create payfast-merchant-id --replication-policy=automatic --project=tenderbriefing-34679
gcloud secrets create payfast-merchant-key --replication-policy=automatic --project=tenderbriefing-34679
gcloud secrets create payfast-passphrase --replication-policy=automatic --project=tenderbriefing-34679

printf '%s' 'YOUR_MERCHANT_ID' | gcloud secrets versions add payfast-merchant-id --data-file=- --project=tenderbriefing-34679
printf '%s' 'YOUR_MERCHANT_KEY' | gcloud secrets versions add payfast-merchant-key --data-file=- --project=tenderbriefing-34679
printf '%s' 'YOUR_PASSPHRASE' | gcloud secrets versions add payfast-passphrase --data-file=- --project=tenderbriefing-34679
```

Grant the Cloud Run service account `secretAccessor` on each secret. Deploy via `cloudbuild.yaml` (already maps `PAYFAST_*`).

## 5. Checkout UX

1. SME creates attendance request → API returns PayFast `formAction` + signed `fields`
2. Browser auto-POSTs to `https://www.payfast.co.za/eng/process`
3. Success → `/sme/requests/payment-success?requestId=…`
4. Cancel → `/sme/requests/payment-cancelled?requestId=…` (retry via **Pay R249.00 with PayFast**)
5. ITN marks paid; agent notifications fire

## 6. When PayFast is not configured

| Behaviour | Detail |
|-----------|--------|
| Request creation | Still succeeds with `paymentStatus: pending` |
| API | `PAYFAST_NOT_CONFIGURED` |
| Agents | Cannot see/accept until paid (or admin override) |

## 7. Readiness

```bash
npm run payfast:readiness
```

## 8. Request fields

| Field | Value |
|-------|--------|
| `paymentProvider` | `payfast` |
| `paymentReference` | `TB-REQ-{requestId}` (= `m_payment_id`) |
| `payfastPaymentId` | PayFast `pf_payment_id` after ITN |
| `paymentStatus` | `pending` → `paid` |
