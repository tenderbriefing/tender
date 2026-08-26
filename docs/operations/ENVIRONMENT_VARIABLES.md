# Environment Variables — Tender Briefing

Never commit real secret values. Rotate via Google Secret Manager / hosting env.

**Legend — Deployed:** `Y` in Cloud Run via `cloudbuild.yaml` · `S` secret mount · `-` not deployed (local/optional) · `F` flag default off / absent

| Name | Purpose | Required | Secret? | Example | Cloud Run | Owner | Failure impact |
|------|---------|----------|---------|---------|-----------|-------|----------------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase web | prod | No | string | build/runtime | Frontend | Auth broken |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase web | prod | No | domain | build/runtime | Frontend | Auth broken |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase web / JWT aud | prod | No | project id | build/runtime | Platform | Auth/API broken |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Storage | prod | No | bucket | build/runtime | Frontend | Uploads fail |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase web config (legacy FCM sender id in client SDK) | optional | No | id | build/runtime | Frontend | None — push retired |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase web | prod | No | id | build/runtime | Frontend | Auth broken |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | Analytics | optional | No | G-… | - | Frontend | Analytics off |
| `NEXT_PUBLIC_SITE_URL` | Canonical site / PayFast URLs | prod | No | `https://www.tenderbriefing.co.za` | Y | Platform | Wrong return URLs |
| `NEXT_PUBLIC_ATTENDANCE_FEE_LABEL` | Display fee label | optional | No | string | - | Product | Label drift |
| `NEXT_PUBLIC_ATTENDANCE_FEE_CENTS` | Client display fee (advisory) | optional | No | int | - | Product | Label drift |
| `ATTENDANCE_FEE_CENTS` | Server charge amount | optional (defaults 34900) | No | int cents | - | Payments | Wrong fee if mis-set |
| `PAYFAST_MERCHANT_ID` | PayFast merchant | prod payments | Yes | string | S | Payments | Checkout fails |
| `PAYFAST_MERCHANT_KEY` | PayFast key | prod payments | Yes | string | S | Payments | Checkout fails |
| `PAYFAST_PASSPHRASE` | ITN/signature | prod payments | Yes | string | S | Payments | ITN reject |
| `PAYFAST_MODE` | `live` / sandbox | prod | No | `live` | Y | Payments | Wrong PayFast host |
| `PAYFAST_SANDBOX` | Legacy sandbox alias | optional | No | true/false | - | Payments | Prefer `PAYFAST_MODE` |
| `PAYFAST_MERCHANT_EMAIL` | Merchant profile email (same-account omit guard) | recommended prod | No | email | Y | Payments | Prefills buyer as merchant → PayFast 400 |
| `RESEND_API_KEY` | Transactional email (prefer sending-only key) | prod notify | Yes | string | S (`TENDERBRIEFING_API:latest` until rotated) | Comms | Emails skipped |
| `RESEND_FROM_EMAIL` | From address | optional | No | email | Y (`hello@tenderbriefing.co.za`) | Comms | Default from used |
| `TWILIO_ACCOUNT_SID` | WhatsApp outbound | prod notify | Yes | string | - (not mounted; fail-closed) | Comms | WhatsApp send skipped |
| `TWILIO_AUTH_TOKEN` | Twilio auth | prod notify | Yes | string | - (not mounted; fail-closed) | Comms | WhatsApp send skipped |
| `TWILIO_WHATSAPP_FROM` | Twilio WhatsApp from | prod notify | Yes | string | - (not mounted; fail-closed) | Comms | WhatsApp send skipped |
| `WHATSAPP_WEBHOOK_ENABLED` | Enable Meta WhatsApp webhook | optional | No | true/false | F (off) | Comms | 503 if route hit without config |
| `WHATSAPP_VERIFY_TOKEN` | Meta verify | if WhatsApp on | Yes | string | F | Comms | Verify fails |
| `WHATSAPP_APP_SECRET` | HMAC signature | prod WhatsApp | Yes | string | F | Comms | Unsigned rejected |
| `SYNC_SECRET` | Sync/automation auth | ops | Yes | string | S | Ops | Sync denied |
| `AUTOMATION_REQUEST_TIMEOUT_MS` | Cloud Run request ceiling mirror | prod | No | `300000` | Y | Ops | Budget misaligned |
| `AUTOMATION_SAFETY_MARGIN_MS` | Budget safety margin | prod | No | `20000` | Y | Ops | Late 504 risk |
| `AUTOMATION_BUDGET_MS` | Automation wall-clock budget | prod | No | `240000` | Y | Ops | Jobs starve / 504 |
| `OCDS_API_BASE` | eTenders OCDS base override | optional | No | URL | - | Ops | Falls back to official API |
| `SMOKE_TEST_PASSWORD` | Smoke scripts | CI/smoke only | Yes | string | - | QA | Smoke cannot run |
| `E2E_SME_TOKEN` | Playwright authenticated SME | optional CI | Yes | JWT | - | QA | Auth E2E skipped |
| `REQUIRE_E2E_AUTH` | Fail if E2E_SME_TOKEN missing | optional CI | No | true/false | - | QA | Auth E2E posture |
| `FOUNDER_USER_INTELLIGENCE_ENABLED` | Founder UI flag | optional | No | true/false | Y (`true`) | Founder | Feature hidden |
| `NEXT_PUBLIC_FOUNDER_USER_INTELLIGENCE` | Client mirror | optional | No | true/false | Y | Founder | UI hidden |
| `FOUNDER_EMAIL_ALLOWLIST` | Founder console emails | prod founder | No | email list | Y | Founder | Access denied |
| `FOUNDER_DASHBOARD_V2` | Founder Dashboard V2 shell | optional | No | true/false | - | Founder | `false` restores legacy Home + User Intelligence chrome |
| `NEXT_PUBLIC_FOUNDER_DASHBOARD_V2` | Client mirror for V2 shell | optional | No | true/false | - | Founder | Must match server flag for rollback |
| `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED` | Google Sign-In UI | optional | No | true/false | Y (`false`) | Auth | Google UI hidden |
| `PROCUREMENT_INTELLIGENCE_ENABLED` | PI Phase 1 global | optional (default false) | No | true/false | Y (`false`) | Product | Without pilot UIDs → 503 |
| `NEXT_PUBLIC_PROCUREMENT_INTELLIGENCE_ENABLED` | Advisory client mirror | optional (default false) | No | true/false | Y (`false`) | Product | Non-pilots see no panel |
| `PROCUREMENT_INTELLIGENCE_PILOT_UIDS` | Pilot Firebase UIDs | optional | Yes (GSM) | uid,uid | S | Product/Ops | Deny-all when empty + flag false |
| `YOUTH_AGENT_WORKSPACE_ENABLED` | YAW global | optional (default false) | No | true/false | F (absent) | Product | Workspace APIs 403 |
| `NEXT_PUBLIC_YOUTH_AGENT_WORKSPACE_ENABLED` | Advisory client mirror | optional (default false) | No | true/false | F | Product | Gate denial UI |
| `YOUTH_AGENT_WORKSPACE_PILOT_UIDS` | YAW pilot UIDs | optional | Yes (prefer GSM) | uid,uid | F | Product/Ops | Deny-all when empty + flag false |
| `BRIEFING_AUDIO_TRANSCRIPTION_ENABLED` | Async briefing audio transcription after evidence | optional (default false) | No | true/false | F | Product | Evidence still accepted; no Whisper jobs |
| `BRIEFING_AUDIO_CHUNKING_ENABLED` | Long-audio hybrid chunking (requires transcription + ffmpeg) | optional (default false) | No | true/false | F | Product | Short audio uses direct path; enable only after cert |
| `BRIEFING_AI_REPORT_GENERATION_ENABLED` | Meeting-minutes AI report after transcript | optional (default false) | No | true/false | F | Product | Transcript kept; no report jobs |
| `BRIEFING_REPORT_PROMPT_VERSION` | Prompt version stamp on generated reports | optional | No | v1 | - | Product | Defaults to v1 |
| `BRIEFING_INTELLIGENCE_PROVIDER` | `openai` or `mock` | optional | No | openai | - | Product | Mock for tests only |
| `BRIEFING_INTELLIGENCE_TRANSCRIBE_MODEL` | Whisper model | optional | No | whisper-1 | - | Product | Default whisper-1 |
| `BRIEFING_INTELLIGENCE_EXTRACT_MODEL` | Extraction model | optional | No | gpt-4o | - | Product | Default gpt-4o |
| `OPENAI_API_KEY` | OpenAI API (Whisper + extract) | if provider openai | Yes | sk-… | S | AI | Transcription/extract fails |
| `APP_URL` / `NEXT_PUBLIC_APP_URL` | Base URL for worker self-enqueue | prod if transcription on | No | https://… | Y | Platform | Jobs stay queued |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Admin SDK | prod | Yes | JSON | S | Platform | Server auth/Firestore broken |
| `FIREBASE_PROJECT_ID` | Admin project | prod | No | project id | Y | Platform | Admin SDK broken |
| `STORAGE_ADAPTER` | `firestore` / `json` | prod | No | `firestore` | Y | Platform | Wrong storage |

Pilot enablement: `docs/runbooks/PROCUREMENT_INTELLIGENCE_FLAGS.md`.  
Youth Agent Workspace: `docs/runbooks/YOUTH_AGENT_WORKSPACE_FLAGS.md`.  
PayFast: `docs/runbooks/PAYFAST.md`.

## Intentionally disabled in production

| Capability | Mechanism |
|------------|-----------|
| Youth Agent Workspace | Env absent → fail-closed |
| Procurement Intelligence | Flags `false`; pilot UIDs in GSM only |
| Briefing audio transcription | `BRIEFING_AUDIO_TRANSCRIPTION_ENABLED` absent/`false` → evidence upload only |
| Briefing AI report generation | `BRIEFING_AI_REPORT_GENERATION_ENABLED` absent/`false` → transcript only, no minutes PDF |
| Google Auth UI | `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=false` |
| Meta WhatsApp webhook | Not enabled; Twilio outbound separate |

## Communications secrets (production scale closure)

WhatsApp remains **fail-closed** until an operator creates/mounts GSM secrets and adds them to Cloud Run `--set-secrets`. Expected names: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`. Do not invent credentials.

Resend production currently mounts `RESEND_API_KEY=TENDERBRIEFING_API:latest` (full-access). Create a sending-only API key in the Resend dashboard, store it in GSM, and point `RESEND_API_KEY` at that secret. Keep `RESEND_FROM_EMAIL=hello@tenderbriefing.co.za` and the verified domain.

## Rotation

1. Create new secret version in Secret Manager.
2. Update Cloud Run / Cloud Build mount.
3. Redeploy.
4. Invalidate old version after smoke pass.
