# Founder User Intelligence — Rollout

Feature flag: `founder_user_intelligence`  
Env: `FOUNDER_USER_INTELLIGENCE_ENABLED` + `NEXT_PUBLIC_FOUNDER_USER_INTELLIGENCE`  
Allowlist: `FOUNDER_EMAIL_ALLOWLIST=info@tenderbriefing.co.za`

Founder Dashboard V2 (this branch): Overview / SMEs / Youth Agents / Briefings / Settings.
Set `FOUNDER_DASHBOARD_V2=false` and `NEXT_PUBLIC_FOUNDER_DASHBOARD_V2=false` to restore the previous Home + User Intelligence chrome. User Intelligence remains at `/founder/user-intelligence`. Technical ops stay under `/admin`.

## Suggested sequence

1. Local: enable flags in `.env.local`, run `node scripts/founder-user-intelligence-qa.js`
2. Deploy Firestore rules + indexes (without enabling flag in Cloud Run)
3. Grant `founderAccess: true` on founder user (script already does this in QA)
4. Enable flags in Cloud Run for production pilot (founder only)
5. Validate: SME/Agent lists, network, geography, action centre, detail drawer
6. Privacy/security review
7. Controlled wider activation (still founder-only)

## Manual Founder validation

1. Sign in as `info@tenderbriefing.co.za`
2. Open `/founder/user-intelligence`
3. Confirm SMEs and Youth Agents appear in **separate** tabs
4. Confirm ordinary admin (`ops-smoke-admin@…`) is denied
5. Confirm SME / Youth Agent accounts cannot open the route
6. Open an SME detail drawer — timeline may be empty until events accumulate
7. Save a tender as an SME — verify `productEvents` gains `tender_saved`
8. Sign in — verify `user_logged_in` event

## Do not

- Push/deploy/enable globally without explicit authority
- Mix SME and Youth Agent rows into one undifferentiated table as the primary UX
