# TenderConnect

**The Uber of Tender Briefings** - Connecting entrepreneurs with reliable individuals to attend tender briefings on their behalf.

## 🚀 Overview

TenderConnect is an innovative online platform that solves the challenges faced by entrepreneurs in attending tender briefings while empowering unemployed youth. The platform acts as a bridge between entrepreneurs who need briefing attendance and reliable individuals who can provide this service.

## ✨ Key Features

### For Entrepreneurs
- **Tender Listings**: Regularly updated database of tenders with comprehensive information
- **Connector Booking**: Easy booking system to request connector services
- **Secure Payments**: Integrated payment gateway for hassle-free transactions
- **Quality Assurance**: Rigorous quality control for all submitted materials
- **Real-time Updates**: Track booking status and receive notifications

### For Connectors (Youth)
- **Job Opportunities**: Access to flexible, income-generating work
- **Skill Development**: Professional experience in business documentation
- **Verified Platform**: Secure and trustworthy environment
- **Rating System**: Build reputation through quality work
- **Flexible Schedule**: Work on your own terms

### Platform Features
- **Mobile-Friendly**: Responsive design for all devices
- **Secure Messaging**: Private communication between users
- **Rating & Feedback**: Accountability and continuous improvement
- **Admin Dashboard**: Comprehensive platform management
- **Quality Control**: Review system for all submissions

## 🛠️ Technology Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS, Headless UI
- **Authentication**: Firebase Auth
- **Database**: Firestore
- **File Storage**: Firebase Storage
- **Payments**: Stripe
- **Deployment**: Firebase Hosting

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Firebase project
- Stripe account

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

Admins can also use **Run Sync Now** on `/admin/dashboard` (Firebase admin auth).

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
- 📞 Landline: +27 10 013 3423
- 📱 WhatsApp: +27 61 5253 476
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

**TenderConnect** - Empowering entrepreneurs, creating opportunities for youth, and revolutionizing the tender briefing process.
