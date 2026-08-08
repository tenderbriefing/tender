# E2E authenticated secrets

Do **not** commit Firebase ID tokens.

## Optional local / CI secrets

| Secret | Purpose |
|--------|---------|
| `E2E_SME_TOKEN` | Bearer token for an SME test user |
| `E2E_AGENT_TOKEN` | Optional agent token |
| `E2E_ADMIN_TOKEN` | Optional admin token |
| `REQUIRE_E2E_AUTH` | When `true`, CI fails if `E2E_SME_TOKEN` is missing |

## GitHub Actions

1. Repo → Settings → Secrets and variables → Actions
2. Add `E2E_SME_TOKEN` (short-lived custom token or ID token from a dedicated QA SME)
3. Optionally set repository variable `REQUIRE_E2E_AUTH=true` on `master` only after the secret exists

Mint a token locally (never log it in CI artifacts):

```bash
# Use Firebase Auth REST or Admin SDK to mint a custom token, then exchange for ID token.
# Store only in Actions secrets.
```

Public Playwright gates always run without these secrets.
