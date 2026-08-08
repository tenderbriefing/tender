# TenderBriefing

South African tender briefing platform for SMEs: discover eTenders opportunities, book a verified Youth Agent to attend compulsory briefings, and receive a structured briefing report. Fixed fee via PayFast.

## Overview

TenderBriefing connects SMEs who need briefing attendance with Youth Agents who provide on-the-ground attendance, proof, and reporting. The live booking path is **attendance requests** (not the retired Connector booking flow).

## Key Features

### For SMEs
- **Tender Opportunities**: Browse and filter live tender briefings
- **Book an agent**: Request attendance with PayFast checkout (fixed fee)
- **My Requests**: Track assignment, attendance, and briefing reports
- **Workspace**: Save/follow tenders, provinces, and departments

### For Youth Agents
- **Available Assignments**: Accept/decline dispatch via `/jobs` and agent dashboard
- **Field mobile flows**: Check-in, media, briefing submission
- **Earnings & performance**: Track completed briefings

### Platform
- Firebase Auth + Firestore
- PayFast payments + ITN webhooks
- Admin operations, dispatch, procurement intelligence
- Cloud Run + Firebase Hosting proxy deploy

## Technology Stack

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS
- **Auth**: Firebase Auth
- **Database / storage**: Firestore, Firebase Storage
- **Payments**: PayFast
- **Deploy**: Cloud Run (`cloudbuild.yaml`) + Firebase Hosting proxy

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- Firebase project
- PayFast merchant credentials (for payments)

### Enterprise governance

- Constitution: `docs/governance/ENGINEERING_CONSTITUTION.md`
- Release gates: `docs/governance/RELEASE_STANDARD.md`
- Security: `docs/governance/SECURITY_STANDARD.md`
- ADRs: `docs/adr/`
- Env vars: `docs/operations/ENVIRONMENT_VARIABLES.md`
- Rollback: `docs/runbooks/ROLLBACK.md`
- PayFast: `docs/runbooks/PAYFAST.md`

### Verification

```bash
npm run typecheck
npm run lint
npm test
npm run qa:firestore-rules
npm run qa:google-auth
```

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/tenderbriefing/tender.git
   cd tenderbriefing
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.local.example .env.local
   ```
   Prefer `STORAGE_ADAPTER=firestore` for local work that mirrors production. See `docs/PAYFAST_PAYMENTS_SETUP.md` for payment setup and `docs/CI_CD_SETUP.md` for deploy.

4. **Run locally**
   ```bash
   npm run dev
   ```

5. **Typecheck**
   ```bash
   npm run typecheck
   ```

> **Note:** Many root-level `*_SETUP.md` guides still describe older TenderConnect / Stripe / project-ID setups. Prefer `README.md`, `docs/`, and `.env.local.example` as the source of truth.

---

<details>
<summary>Legacy README sections (historical — may be outdated)</summary>

The remainder of this file retains older setup notes. Treat conflicting claims (Stripe, Connector booking, static export, Vercel) as superseded by the sections above.

3. **Environment Setup**
   ```bash
   cp env.example .env.local
   ```
   
   Fill in your environment variables:
   ```env
   # Firebase Configuration
   NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

   # Stripe Configuration
   STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key
   STRIPE_SECRET_KEY=sk_test_your_secret_key
   ```

4. **Firebase project (production)**

   | Field | Value |
   |-------|-------|
   | Project name | tenderbriefing |
   | Project ID | `tenderbriefing-34679` |
   | Project number | 9058655644 |

   - Enable Firestore (deploy rules): `firebase deploy --only firestore --project tenderbriefing-34679`
   - Download Admin SDK key: Firebase Console → Project settings → Service accounts → **Generate new private key**
   - Save as `service-account.json` in the project root (see `service-account.json.example`)
   - Never commit `service-account.json` or `.env.local`

5. **Install dependencies**
   ```bash
   cd "/Users/billionaire/Desktop/Tender briefing"
   npm install firebase-admin
   ```

6. **Environment**
   ```bash
   cp .env.local.example .env.local
   ```

   Required for Firestore:
   ```env
   STORAGE_ADAPTER=firestore
   FIREBASE_PROJECT_ID=tenderbriefing-34679
   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
   OPENAI_API_KEY=
   ```

7. **Run the app**
   ```bash
   npm run dev
   ```

   Or explicitly:
   ```bash
   STORAGE_ADAPTER=firestore GOOGLE_APPLICATION_CREDENTIALS="./service-account.json" npm run dev
   ```

8. **Firestore connection test**
   ```bash
   node scripts/test-firestore.js
   ```

9. **Sync live eTenders OCDS data**
   ```bash
   curl -X POST http://localhost:3000/api/sync/run \
     -H "Content-Type: application/json" \
     -d '{"force":true}'
   ```

   Or via CLI:
   ```bash
   npm run sync:firestore
   ```

10. **Verify storage & health**
    ```bash
    STORAGE_ADAPTER=firestore npm run verify:storage
    curl http://localhost:3000/api/health/firestore
    curl http://localhost:3000/api/tender-briefings
    curl http://localhost:3000/api/sync/status
    ```

11. **Open the app** — [http://localhost:3000](http://localhost:3000)

## Automatic production sync (Cloud Run + Scheduler)

TenderBriefing syncs from the official **eTenders OCDS API** into Firestore on a schedule. No manual `curl` required in production.

### Environment variables (Cloud Run)

| Variable | Value |
|----------|--------|
| `STORAGE_ADAPTER` | `firestore` |
| `FIREBASE_PROJECT_ID` | `tenderbriefing-34679` |
| `GOOGLE_APPLICATION_CREDENTIALS` | `/secrets/service-account.json` (mounted secret) **or** `FIREBASE_SERVICE_ACCOUNT_JSON` |
| `SYNC_SECRET` | Strong random string (required in production) |
| `NODE_ENV` | `production` |
| `PORT` | `8080` |

Add to `.env.local` for local testing:

```env
SYNC_SECRET=change-this-secure-value
```

### Deploy to Cloud Run

```bash
cd "/Users/billionaire/Desktop/Tender briefing"

# Build & deploy (see cloudbuild.yaml)
gcloud builds submit --config cloudbuild.yaml --project tenderbriefing-34679

# Or manual Docker deploy:
docker build -t tenderbriefing .
docker run -p 8080:8080 \
  -e PORT=8080 \
  -e NODE_ENV=production \
  -e STORAGE_ADAPTER=firestore \
  -e FIREBASE_PROJECT_ID=tenderbriefing-34679 \
  -e SYNC_SECRET=your-secret \
  -e GOOGLE_APPLICATION_CREDENTIALS=/secrets/service-account.json \
  -v $(pwd)/service-account.json:/secrets/service-account.json:ro \
  tenderbriefing
```

### Cloud Scheduler (every 15 minutes)

Replace `YOUR-CLOUD-RUN-URL` and `YOUR_SYNC_SECRET`:

```bash
gcloud scheduler jobs create http tenderbriefing-sync-every-15min \
  --schedule="*/15 * * * *" \
  --time-zone="Africa/Johannesburg" \
  --uri="https://YOUR-CLOUD-RUN-URL/api/sync/run" \
  --http-method=POST \
  --headers="Content-Type=application/json,x-sync-secret=YOUR_SYNC_SECRET" \
  --message-body='{"force":false}' \
  --project=tenderbriefing-34679 \
  --location=africa-south1
```

After this job is active, TenderBriefing **updates automatically every 15 minutes**.

### Manual production sync

```bash
curl -X POST https://YOUR-CLOUD-RUN-URL/api/sync/run \
  -H "Content-Type: application/json" \
  -H "x-sync-secret: YOUR_SYNC_SECRET" \
  -d '{"force":true}'
```

### Local development sync (no secret required)

```bash
npm run dev

curl -X POST http://localhost:3000/api/sync/run \
  -H "Content-Type: application/json" \
  -d '{"force":true}'
```

Admins can also use **Run sync** on the `/admin/dashboard` control centre (Firebase admin auth).

### Sync security

| Environment | `POST /api/sync/run` |
|-------------|----------------------|
| Development (`NODE_ENV` ≠ `production`) | Allowed without `x-sync-secret` |
| Production | Requires header `x-sync-secret: $SYNC_SECRET` or returns **401** |

## 📁 Project Structure

```
tenderconnect/
├── app/                    # Next.js 14 App Router
│   ├── auth/              # Authentication pages
│   ├── dashboard/         # User dashboard
│   ├── tenders/           # Tender listings
│   └── globals.css        # Global styles
├── components/            # React components
│   ├── auth/              # Authentication components
│   ├── dashboard/         # Dashboard components
│   ├── home/              # Homepage components
│   ├── layout/            # Layout components
│   ├── providers/         # Context providers
│   ├── tenders/           # Tender-related components
│   └── ui/                # Reusable UI components
├── lib/                   # Utility libraries
│   ├── auth.ts            # Authentication utilities
│   ├── firebase.ts        # Firebase configuration
│   └── types.ts           # TypeScript type definitions
└── public/                # Static assets
```

## 🔧 Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Code Style

- TypeScript for type safety
- ESLint for code quality
- Prettier for code formatting
- Tailwind CSS for styling

## 🚀 Deployment

### Firebase Hosting

1. **Install Firebase CLI**
   ```bash
   npm install -g firebase-tools
   ```

2. **Login to Firebase**
   ```bash
   firebase login
   ```

3. **Initialize Firebase**
   ```bash
   firebase init hosting
   ```

4. **Build and Deploy**
   ```bash
   npm run build
   firebase deploy
   ```

### Environment Variables for Production

Make sure to set up the following environment variables in your hosting platform:

- Firebase configuration variables
- Stripe keys (use live keys for production)
- Admin email configuration

## 📊 Database Schema

### Collections

- **users**: User profiles and authentication data
- **tenders**: Tender listings and information
- **bookings**: Booking requests and status
- **submissions**: Connector submissions and reviews
- **messages**: User communications
- **ratings**: User ratings and feedback
- **notifications**: System notifications

## 🔐 Security

- Firebase Authentication for user management
- Firestore security rules for data protection
- Stripe for secure payment processing
- Input validation and sanitization
- HTTPS enforcement

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

**Contact Information:**
- 📧 Email: support@tenderconnect.com
- 📱 WhatsApp: +27 72 070 8467
- 📍 Address: Maxwell Office Park, Magwa Crescent, Midrand, Gauteng

For support, email support@tenderconnect.com or contact us via WhatsApp.

## 🎯 Roadmap

- [ ] Mobile app development
- [ ] Advanced analytics dashboard
- [ ] Multi-language support
- [ ] Integration with government tender portals
- [ ] AI-powered matching algorithm
- [ ] Video briefing capabilities

## 🙏 Acknowledgments

- Firebase team for excellent documentation
- Next.js team for the amazing framework
- Tailwind CSS for the utility-first approach
- All contributors and early adopters

---

**TenderBriefing** — SME tender briefings with Youth Agent attendance.

</details>
