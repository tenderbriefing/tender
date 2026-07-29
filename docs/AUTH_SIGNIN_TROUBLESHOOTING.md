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

## 6. Password reset / forgot password

Product UI:

- Sign-in: https://www.tenderbriefing.co.za/auth/signin → **Forgot password?**
- Request email: https://www.tenderbriefing.co.za/auth/forgot-password
- Custom completion (if action URL is customized): https://www.tenderbriefing.co.za/auth/reset-password

Firebase requirements:

1. **Email/Password** provider enabled (section 5).
2. Authorized domains include `www.tenderbriefing.co.za` and `tenderbriefing.co.za` (section 1). Without them, reset returns `auth/unauthorized-continue-uri` / `auth/unauthorized-domain`.
3. Firebase Console → **Authentication** → **Templates** → **Password reset** is enabled (default Firebase template is fine).
4. Optional branded handler: in the password-reset template, set the action URL to `https://www.tenderbriefing.co.za/auth/reset-password`. If left as the default `*.firebaseapp.com/__/auth/action` page, reset still works; after success users continue to `/auth/signin`.

Ops: trigger a reset email for a known account (does not print passwords):

```bash
node scripts/send-password-reset.js info@tenderbriefing.co.za
```

## Verify in browser

Open DevTools → **Network** → filter `identitytoolkit` → attempt sign-in:

| Status | Meaning |
|--------|---------|
| 200 | Auth OK — if UI still fails, check Firestore `users` doc |
| 400 `INVALID_LOGIN_CREDENTIALS` | Wrong email or password |
| 403 | API key or domain restriction |
