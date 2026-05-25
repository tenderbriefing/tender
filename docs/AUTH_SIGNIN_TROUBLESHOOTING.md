# Sign-in troubleshooting (Firebase Auth)

If users see **"Failed to sign in. Please try again."** on https://www.tenderbriefing.co.za/auth/signin, check the following.

## 1. Authorized domains (most common on custom domain)

Firebase Console → **Authentication** → **Settings** → **Authorized domains**

Ensure these are listed:

- `localhost` (local dev)
- `www.tenderbriefing.co.za`
- `tenderbriefing.co.za`
- `tenderbriefing-34679.web.app`
- `tenderbriefing-34679.firebaseapp.com`

Without `www.tenderbriefing.co.za`, Firebase returns `auth/unauthorized-domain`.

## 2. Email / password

- Use the email you registered with (check for typos).
- Password is case-sensitive.
- New Firebase projects return **invalid email or password** for both wrong email and wrong password (no separate “user not found”).

## 3. Profile document

After Auth succeeds, the app reads `users/{uid}` in Firestore. If that document is missing, you will see **Profile not found** (not the generic sign-in error). Re-register via `/auth/role-selection` or ask admin to restore the profile.

## 4. API key restrictions

Google Cloud Console → **APIs & Services** → **Credentials** → Browser key used by Firebase.

HTTP referrers should include:

- `https://www.tenderbriefing.co.za/*`
- `https://tenderbriefing.co.za/*`
- `https://tenderbriefing-34679.web.app/*`

## 5. Email/password provider enabled

Firebase Console → **Authentication** → **Sign-in method** → **Email/Password** → **Enabled**.

## Verify in browser

Open DevTools → **Network** → filter `identitytoolkit` → attempt sign-in:

| Status | Meaning |
|--------|---------|
| 200 | Auth OK — if UI still fails, check Firestore `users` doc |
| 400 `INVALID_LOGIN_CREDENTIALS` | Wrong email or password |
| 403 | API key or domain restriction |
