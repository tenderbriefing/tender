# Youth Agent Banking Profile + Manual EFT — Engineering Certification

**Branch:** `feat/ya-banking-profile-manual-eft`  
**Base:** `392ae6496ff3c03ee00ce08f07f9c060b98d1924` (PR #57 monthly EFT)  
**Scope:** One-time YA banking profile; immutable batch banking snapshots; Founder Record EFT with amount validation

---

## Executive Verdict

**READY FOR FOUNDER APPROVAL TO MERGE**

Youth Agents capture banking details once on `/agent/workspace/profile`. Monthly batches snapshot those details. Founder records external EFT (reference + amount + date); liabilities settle atomically. No banking API / automated EFT.

---

## Architecture

| Piece | Design |
|-------|--------|
| Collection | `youthAgentBankingProfiles/{uid}` |
| History | `youthAgentBankingProfileHistory` on each update |
| API | `GET/PUT /api/agent/banking` (YA own; masked on GET) |
| Snapshot | `bankingSnapshot` on `youthAgentPayoutBatches` at generation |
| Settlement | `amountPaidCents` must equal `grossEarningsCents` |

---

## Security

- Client writes denied on banking profiles + history
- YA read own profile only; SME/anonymous denied
- History: admin read only
- Full account numbers not returned on YA GET; not logged in audit events

---

## Workflow

YA adds bank once → R200 accrues → Generate monthly batch (snapshots bank) → Founder EFT externally → Record EFT → batch paid + jobs settled

Missing bank: earnings continue; batch flagged **Missing bank details**; Record EFT blocked until profile complete (then snapshot attached at settlement).

---

## Migration

Forward-only. No backfill. Existing agents add banking when they open profile. Legacy batches without snapshots remain readable.
