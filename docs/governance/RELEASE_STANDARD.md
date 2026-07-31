# Release Standard — Tender Briefing

## Mandatory release gates

A commit is **release-candidate** only when all applicable gates pass.

| Gate | Command / evidence | Blocking |
|------|-------------------|----------|
| Type safety | `npm run typecheck` | Yes |
| Lint | `npm run lint` | Yes |
| Unit tests | `npm test` | Yes |
| Production build | `npm run build` | Yes (CI / pre-deploy) |
| Firestore rules QA | `npm run qa:firestore-rules` | Yes |
| Google auth QA | `npm run qa:google-auth` | Yes |
| Dependency audit | `npm audit --omit=dev` (review highs/criticals) | Conditional* |
| Secret scan | No `.env`, keys, or smoke passwords in git | Yes |
| Payment integrity | PayFast unit tests + readiness script when secrets present | Yes for payment changes |
| Config validation | Runtime config module / env docs | Yes |
| Rollback readiness | Documented last-good SHA + process | Yes |
| Performance | No unexplained major bundle regression | Review |
| Accessibility | Automated smoke on critical pages when configured | Review |

\*Known advisories on Next 14.0.4 / Firebase 9 may remain deferred with written justification until a staged upgrade lands.

## Deployment rules

1. Deploy only from the SHA that passed CI.
2. Do not deploy dirty local trees.
3. Prefer GitHub Actions `Deploy TenderBriefing` over ad-hoc local deploys.
4. After deploy: health check `/api/health/firestore` and production smoke plan.
5. This programme does **not** auto-deploy; human/release manager approval required for production.

## Rollback

See `docs/runbooks/ROLLBACK.md`.
