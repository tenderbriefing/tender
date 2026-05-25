# TenderBriefing — Launch messaging templates

Copy-ready messages for SME invitations, Youth Agent recruitment, email, and WhatsApp follow-ups.  
Replace placeholders (`{{name}}`, `{{link}}`) before sending. Do not include secrets or internal URLs in public messages.

---

## SME invitation (WhatsApp)

```
Hi {{name}},

TenderBriefing helps South African SMEs never miss a *compulsory tender briefing*.

✅ Free tender discovery (official data, updated every 15 min)
✅ Request a verified Youth Agent to attend on your behalf
✅ Receive a structured briefing report for your bid team

Standard attendance support: R249 per briefing (pilot pricing).

Start here: {{link}}/sme/onboarding

Questions? Reply here or email support@tenderbriefing.co.za

— TenderBriefing Team
```

---

## Youth Agent recruitment (WhatsApp)

```
Hi {{name}},

Join the TenderBriefing Youth Agent network and earn by attending compulsory tender briefings for SMEs.

✅ Register free — build your reliability score
✅ Receive nearby dispatch opportunities
✅ Upload digital briefing reports after each session

We verify agents during pilot. Transport and professionalism matter.

Register: {{link}}/agent/onboarding

Code of conduct applies. More info: {{link}}/how-it-works

— TenderBriefing Operations
```

---

## Pilot launch email (SME / partner)

**Subject:** TenderBriefing pilot — compulsory briefing support for your bid team

**Body:**

Dear {{name}},

We are launching the TenderBriefing commercial pilot — a procurement intelligence platform that connects SMEs with verified Youth Agents for compulsory tender briefing attendance.

**What you get**
- Free access to live government tender opportunities with compulsory briefing filters
- Pay-per-briefing attendance support (R249 standard fee)
- Structured briefing reports after each session
- WhatsApp status updates when enabled

**Important:** TenderBriefing does not submit tenders on your behalf. Final submission remains your responsibility through official government channels.

**Next step:** Complete SME onboarding at {{link}}/sme/onboarding

Support: support@tenderbriefing.co.za | +27 10 013 3423

Regards,  
TenderBriefing Team  
https://www.tenderbriefing.co.za

---

## Follow-up message (WhatsApp / SMS)

```
Hi {{name}}, following up on TenderBriefing.

Have you found any compulsory briefings on the platform yet? If you share your province and sector, we can help you request your first attendance support.

Onboarding: {{link}}/sme/onboarding
Support: support@tenderbriefing.co.za
```

---

## Agent acceptance message (WhatsApp — after dispatch accept)

```
Hi {{agentName}},

You have accepted a briefing assignment on TenderBriefing.

Tender: {{tenderNumber}}
Briefing: {{briefingDate}} @ {{venue}}
SME: {{smeCompany}}

Please attend on time, follow venue rules, and upload your report within 24 hours of the session.

Dashboard: {{link}}/agent/dashboard

— TenderBriefing Dispatch
```

---

## Usage notes

| Channel | Tip |
|---------|-----|
| WhatsApp | Use approved Twilio templates in production; sandbox numbers must join sandbox first during pilot |
| Email | Send from support@tenderbriefing.co.za with clear POPIA footer linking to `/privacy` |
| Links | Production base: `https://www.tenderbriefing.co.za` |

---

*Internal only — update templates when pricing or refund policy is finalized.*
