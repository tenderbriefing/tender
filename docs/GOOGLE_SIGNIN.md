# Google Sign-In — authorised domains & ops notes

Google authentication is enabled in Google Cloud Identity Platform / Firebase Authentication for project `tenderbriefing-34679`.

## Domains that must be authorised

Confirm in Firebase Console → Authentication → Settings → **Authorized domains**:

| Environment | Domain |
|-------------|--------|
| Production | `www.tenderbriefing.co.za` |
| Production (apex) | `tenderbriefing.co.za` |
| Firebase Hosting | `tenderbriefing-34679.web.app` |
| Firebase Hosting | `tenderbriefing-34679.firebaseapp.com` |
| Local development | `localhost` |

Cloud Run URL (`*.run.app`) is not required for end-user browser auth if traffic always goes through the custom domain.

## Providers

- Email/Password — must remain enabled
- Google — must remain enabled

## Application behaviour (summary)

- Sign-in: `/auth/signin` — Continue with Google + email/password
- SME registration: `/auth/signup?type=sme` — Google journey locks intended role to `sme` for **new** profiles only
- Youth Agent registration: `/auth/signup?type=youth-agent` — intended role `youth-agent` for **new** profiles only
- Existing profiles **never** change `userType` based on which page started Google Sign-In
- First-time Google users: `onboardingCompleted: false` → `/sme/onboarding` or `/agent/onboarding`
- Account conflict: `/auth/link-account` (password proof before linking)
- Admin / `founderAccess` cannot be granted via Google Sign-In

## Console changes

This repository does **not** claim to have modified Google Cloud Console settings unless an authenticated admin command was run and verified in the same change set.
