# Firestore security rules — emulator IDOR matrix

Dynamic tests for `firestore.rules`, run against the real Firestore emulator
(never production) via [`@firebase/rules-unit-testing`](https://www.npmjs.com/package/@firebase/rules-unit-testing).

`tests/firestore/rules.idor.test.ts` exercises the rules as six identities —
unauthenticated, SME A, SME B, agent A, agent B, admin — against the
`users`, `attendanceRequests`, `briefingReports`, and `auditLogs`
collections, asserting the IDOR/privilege-escalation matrix below:

| # | Scenario | Expectation |
|---|----------|-------------|
| 1 | SME A reads/updates SME B's `attendanceRequests` doc | `assertFails` |
| 2 | SME sets `paymentStatus: 'paid'` on its own request | `assertFails` |
| 3 | SME sets `agentId` / `status: 'assigned'` on its own request | `assertFails` |
| 4 | Agent A updates a request it's not linked to, or a privileged field on one it is linked to | `assertFails` |
| 5 | Agent reads a request once notified (`notifiedAgents`) or assigned (`assignedAgentId`) | `assertSucceeds` |
| 6 | Non-admin (SME/agent), and even an admin *client*, writes `auditLogs` | `assertFails` (Admin SDK only) |
| 7 | Non-admin escalates `userType`/`role` on `users`, or edits another user's doc | `assertFails` |
| 8 | SME A reads SME B's `briefingReports` doc | `assertFails` |
| 9 | Unauthenticated client reads/creates `attendanceRequests` | `assertFails` |

Each `it()` also seeds its own uniquely-named (`randomUUID()`-suffixed)
fixture documents via `testEnv.withSecurityRulesDisabled(...)`, and
`afterEach` calls `testEnv.clearFirestore()`, so tests are isolated and can
be re-run/reordered safely.

## Prerequisites

1. **Java 11+** on `PATH` — the Firestore emulator (a JVM process) requires
   it. Check with `java -version`. Install via
   [Adoptium Temurin](https://adoptium.net/) or `brew install openjdk` on
   macOS, then make sure `java` resolves (e.g. add it to `PATH` or
   `sudo ln -sfn $(brew --prefix openjdk)/libexec/openjdk.jdk /Library/Java/JavaVirtualMachines/openjdk.jdk`).
2. `npm install` — installs `firebase-tools` and
   `@firebase/rules-unit-testing` (both devDependencies).
3. No `.env` / real credentials needed — the emulator runs entirely
   locally against the `demo-tenderbriefing` project id (a `demo-*` project
   id, per Firebase's own recommendation, guarantees the emulator never
   talks to production).

## Running

```bash
npm run test:firestore-rules-emulator
```

This runs:

```bash
firebase emulators:exec --only firestore --project demo-tenderbriefing \
  "vitest run tests/firestore --config vitest.firestore.config.ts"
```

`firebase emulators:exec` starts the Firestore emulator (port `8085`,
configured in `firebase.json` under `emulators.firestore.port`), waits for
it to be ready, runs the given command with `FIRESTORE_EMULATOR_HOST` set
in its environment, then tears the emulator down and forwards the exit
code — so this is CI-safe and self-contained.

The suite is intentionally kept in its own Vitest config
(`vitest.firestore.config.ts`, `include: ['tests/firestore/**/*.test.ts']`)
so it is never picked up by the regular `npm test` / `npm run test:watch`
unit-test run, which does not have an emulator available.

### Running the emulator by hand (debugging)

```bash
npx firebase emulators:start --only firestore --project demo-tenderbriefing
# in another terminal:
npx vitest run tests/firestore --config vitest.firestore.config.ts
```

The Emulator UI (if you want to poke at seeded documents while debugging)
is enabled in `firebase.json` and will print its URL on startup.

## Known blockers in this environment

- **Java is not installed** in this sandbox (`java -version` /
  `firebase emulators:exec` both fail with
  `Unable to locate a Java Runtime`), so the emulator — and therefore this
  entire suite — cannot actually execute here. The test file itself has
  been verified to import cleanly and to attempt to connect to
  `127.0.0.1:8085` (confirmed via `vitest run tests/firestore --config
  vitest.firestore.config.ts`, which fails only with `ECONNREFUSED`, i.e.
  it never gets far enough to need Java locally — the failure is purely
  "no emulator is listening"). Install Java per the Prerequisites section
  above to unblock a real run.
- Static-only equivalents of the same guardrails (no Java required) live
  in `scripts/firestore-rules-qa.js` (`npm run qa:firestore-rules`) — they
  regex-check `firestore.rules` structure and are a fast pre-emulator
  smoke check, but they cannot substitute for actually evaluating the
  rules engine the way this Vitest suite does.
