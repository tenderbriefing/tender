# TenderBriefing — Youth Agent Authentication Repair Certification

**Date (UTC):** 2026-08-20  
**Branch:** `fix/youth-agent-authentication`  
**Stop:** No merge/deploy unless release gates + human approval permit.

---

## 1. Executive Verdict

**PASS WITH CONDITIONS**

Root causes of the reported 401 / Identity Toolkit 400 loops / redirect mismatch are fixed in code with tests green. Conditions: no real production Youth Agent credentials were available in this environment to prove live `/api/agent/workspace/assignments` = 200; workspace feature flag / pilot UID must still be provisioned for production YA access (403 `WORKSPACE_DISABLED` when fail-closed).

## 2. Root Cause

### Assignment endpoint 401
1. **Auth race:** `authFetch` attached Bearer only if `auth.currentUser` was already set — workspace pages could fire before `onAuthStateChanged` restored the session → middleware 401 (missing token).
2. **No single token refresh:** expired ID tokens produced permanent 401 loops without one forced `getIdToken(true)` retry.
3. **Wrong-role collapsed to 401:** `verifyApiUser` returned `null` for SME on YA routes, indistinguishable from unauthenticated.
4. **Post-login redirect bug:** `WorkspaceGate` sent `?next=` but sign-in reads `?redirect=` — agents bounced after login and re-hit protected APIs without a clean session handoff.

### Firebase 400 errors / repeated auth requests
1. **Signup orphan recovery** called `signInWithEmailAndPassword` after `createUserWithEmailAndPassword` failed with `email-already-in-use`. Wrong password → both Identity Toolkit endpoints returned 400 (looked like a signup/signin loop).
2. Duplicate submits were possible under rapid double-click before React state disabled the button (no synchronous lock).

### CSP
GA/Firebase Analytics beacons to `stats.g.doubleclick.net` were blocked by `connect-src` (secondary noise; not the YA 401 cause).

## 3. Authentication Architecture (repaired)

```
Browser Firebase Auth (AuthProvider / onAuthStateChanged)
  → waitForAuthUser + getIdToken (authFetch; one forced refresh on 401)
  → Authorization: Bearer <Firebase ID token>
  → middleware edge JWT verify (same project id resolution as Admin)
  → verifyApiUserDetailed (Admin verifyIdToken + Firestore users/{uid}.userType)
  → assertYouthAgentWorkspaceAccess (feature flag / pilot UIDs)
  → workspaceService.listAssignments(verified uid)
```

- Identity: verified Firebase ID token only (never query UID / client role).
- Role: Firestore `userType` only.
- Auth vs authz: missing/invalid/expired/profile → **401 UNAUTHENTICATED**; wrong role → **403 FORBIDDEN**; flag deny → **403 WORKSPACE_DISABLED**.

## 4. Files Changed

- `lib/api/authenticatedFetch.ts` — wait for auth; one 401 refresh
- `lib/auth/verifyApiUser.ts` — detailed reasons; 401 vs 403
- `lib/auth/apiGuards.ts` — use detailed verify
- `lib/auth/verifyFirebaseIdTokenEdge.ts` — align project id resolution with Admin
- `lib/auth.ts` — signup/login single-attempt; remove signup→signin loop
- `lib/auth/errors.ts` — safer user-facing messages
- `lib/agent/workspace/clientApi.ts` — surface status/reason
- `app/api/agent/workspace/assignments/route.ts` (+ `[requestId]`)
- `app/api/agent/workspace/route.ts`
- `components/agent/workspace/WorkspaceGate.tsx` — `redirect=` fix
- `app/auth/signin/page.tsx` / `app/auth/signup/page.tsx` — submit locks
- `next.config.js` — CSP `stats.g.doubleclick.net`
- Tests: unit + Playwright `tests/e2e/youth-agent-auth.spec.ts`

## 5. Security Controls Preserved

- No auth removal from YA APIs
- No query-param UID trust
- No client role trust
- No Admin SDK in client
- No production auth bypass / E2E stub in production builds
- Fail-closed workspace flag unchanged

## 6. Firebase Configuration Findings

- Canonical project in code/deploy: **`tenderbriefing-34679`**
- Client fallback + Cloud Run `FIREBASE_PROJECT_ID` align
- Edge JWT and Admin now prefer `FIREBASE_PROJECT_ID` then `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- Email/Password provider is required (Firebase Console). Code cannot enable providers; `auth/operation-not-allowed` surfaces a clear message if disabled.

## 7. CSP Fix

**Yes** — added only `https://stats.g.doubleclick.net` to `connect-src`. No `*`, no bare `https:`.

## 8. Tests

| Gate | Result |
|------|--------|
| Typecheck | PASS |
| Lint | PASS (pre-existing ConnectorMatching warning) |
| Unit/integration | **52 files / 325 tests PASS** |
| Build | PASS (`NEXT_PUBLIC_E2E_AUTH_STUB_ALLOWED=1` for Playwright) |
| Playwright YA auth + submit-evidence | **9 passed** |

## 9. Production Smoke

**Not executed** — no legitimate production Youth Agent credentials in this environment.

Required human smoke after merge/deploy:

1. Sign in at `/auth/signin` as Youth Agent  
2. Open `/agent/workspace/assignments`  
3. Confirm Network: `GET /api/agent/workspace/assignments` → **200** with Bearer  
4. Logout → revisit → redirected to sign-in; API without token → **401**

Also confirm Cloud Run has either `YOUTH_AGENT_WORKSPACE_ENABLED=true` or the agent UID in `YOUTH_AGENT_WORKSPACE_PILOT_UIDS` (otherwise authenticated YA correctly receives **403 WORKSPACE_DISABLED**).

## 10. Remaining Conditions

1. Production smoke with real YA account  
2. Pilot UID / global YAW flag provisioning for production workspace access  
3. Merge/deploy only under existing release governance  

## 11. Git

| Field | Value |
|-------|--------|
| Branch | `fix/youth-agent-authentication` |
| Starting SHA | `2067c7c` (master tip at branch creation) |
| Final SHA | _(set after commit)_ |
| PR | _(set after create)_ |
| Merge status | Not merged |
| Production SHA | Unchanged (not deployed) |

## 12. FINAL VERDICT

**PASS WITH CONDITIONS** — authentication reliability repaired and gated by tests; production PASS requires real YA smoke + workspace flag/pilot access.
