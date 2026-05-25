# TenderBriefing Agent (Native)

Expo React Native field app for **Youth Agents**. Connects to production TenderBriefing mobile APIs at `https://www.tenderbriefing.co.za`.

This folder is separate from the Next.js web app — it does not replace the PWA or web dashboards.

## Requirements

- Node.js 18+
- npm
- [Expo Go](https://expo.dev/go) on your phone (development), or Android Studio / Xcode for device builds

## Setup

```bash
cd mobile-agent-app
cp .env.example .env
```

Fill `.env` with **public** Firebase client keys (same values as the web app `NEXT_PUBLIC_FIREBASE_*`). Never commit `.env`.

```bash
npm install
npx expo start
```

Scan the QR code with Expo Go (Android) or the Camera app (iOS).

## Environment variables

| Variable | Description |
|----------|-------------|
| `EXPO_PUBLIC_API_BASE_URL` | API host (default production) |
| `EXPO_PUBLIC_FIREBASE_*` | Firebase web SDK config |

## Screens

1. **Login** — Firebase email/password, persistent session  
2. **Dispatch** — jobs, accept/decline, payout, distance, urgency  
3. **Briefing detail** — tender info, AI summary, navigation, GPS/report CTAs  
4. **Check-in** — GPS, accuracy, geofence feedback  
5. **Report upload** — text, photos, voice notes  
6. **Earnings** — payouts and history  
7. **Performance** — tier, reliability, attendance, fraud flags  
8. **Profile** — agent info, WhatsApp, logout  

## API authentication

All requests use:

```
Authorization: Bearer <Firebase ID token>
```

Implemented in `src/api/client.ts`.

## Offline queue

`src/offline/queue.ts` queues check-ins, check-outs, reports, and uploads in AsyncStorage. Items sync via `/api/mobile/v1/offline-sync` and direct mobile endpoints when back online.

## Run on device

### Android (Expo Go)

```bash
npm run android
```

### iOS (Expo Go, macOS)

```bash
npm run ios
```

### Production-like testing

Point `.env` at production Firebase + API URL. Sign in with a **youth-agent** test account.

## Build APK (EAS)

1. Install EAS CLI: `npm i -g eas-cli`
2. `eas login`
3. `eas build:configure`
4. `eas build -p android --profile preview`

For Play Store: use `production` profile, app signing, privacy policy, and location/camera/mic declarations matching `app.json` permissions.

## QA

```bash
npm run typecheck
npm run lint
```

From repo root:

```bash
npm run mobile:agent:qa
```

## Testing checklist

- [ ] Login with youth-agent account  
- [ ] Dispatch list loads  
- [ ] Accept / decline assignment  
- [ ] Briefing detail + AI summary  
- [ ] GPS check-in / check-out (grant location)  
- [ ] Photo upload (camera permission)  
- [ ] Voice note record + upload  
- [ ] Report submit  
- [ ] Earnings + performance screens  
- [ ] Offline queue (airplane mode → action → online sync)  
- [ ] Push permission prompt (foundation)  

## Play Store next steps

1. Register `co.za.tenderbriefing.agent` in Google Play Console  
2. Configure EAS production builds + signing  
3. Add store listing, screenshots, data safety (location, camera, audio)  
4. Wire FCM server key to backend push registration (`/api/push/register-token`)  
5. Internal testing track → closed pilot → production  
