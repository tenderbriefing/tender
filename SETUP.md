# TenderConnect Setup Guide

This guide will help you set up TenderConnect for development and deployment.

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/tenderbriefing/tender.git
cd tenderbriefing
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Setup

Copy the environment template and fill in your values:

```bash
cp env.example .env.local
```

### 4. Firebase Setup

#### Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project"
3. Enter project name: `tenderconnect` (or your preferred name)
4. Enable Google Analytics (optional)
5. Create project

#### Configure Authentication

1. In Firebase Console, go to "Authentication" > "Sign-in method"
2. Enable "Email/Password" provider
3. Optionally enable Google and Facebook providers

#### Setup Firestore Database

1. Go to "Firestore Database"
2. Click "Create database"
3. Choose "Start in test mode" (we'll update rules later)
4. Select a location close to your users

#### Setup Storage

1. Go to "Storage"
2. Click "Get started"
3. Choose "Start in test mode"
4. Select the same location as Firestore

#### Get Firebase Configuration

1. Go to Project Settings (gear icon)
2. Scroll down to "Your apps"
3. Click "Add app" > Web app
4. Register app with name "TenderConnect"
5. Copy the configuration object

#### Update Environment Variables

```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### 5. Stripe Setup (Optional for Development)

1. Create account at [Stripe](https://stripe.com)
2. Get your test keys from Dashboard > Developers > API keys
3. Add to environment variables:

```env
STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key
STRIPE_SECRET_KEY=sk_test_your_secret_key
```

### 6. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🔧 Development Workflow

### Project Structure

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
│   ├── database.ts        # Database operations
│   ├── firebase.ts        # Firebase configuration
│   └── types.ts           # TypeScript type definitions
└── public/                # Static assets
```

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run export` - Export static files
- `npm run deploy` - Deploy to Firebase

### Code Style

- Use TypeScript for all new files
- Follow the existing component structure
- Use Tailwind CSS for styling
- Follow the established naming conventions

## 🚀 Deployment

### Firebase Hosting Setup

1. Install Firebase CLI:
```bash
npm install -g firebase-tools
```

2. Login to Firebase:
```bash
firebase login
```

3. Initialize Firebase in your project:
```bash
firebase init hosting
```

4. Select your Firebase project
5. Set public directory to `out`
6. Configure as single-page app: `Yes`
7. Set up automatic builds: `No` (we'll use GitHub Actions)

### GitHub Actions Setup

1. Go to your GitHub repository
2. Navigate to Settings > Secrets and variables > Actions
3. Add the following secrets:

```
FIREBASE_SERVICE_ACCOUNT
FIREBASE_API_KEY
FIREBASE_AUTH_DOMAIN
FIREBASE_PROJECT_ID
FIREBASE_STORAGE_BUCKET
FIREBASE_MESSAGING_SENDER_ID
FIREBASE_APP_ID
STRIPE_PUBLISHABLE_KEY
STRIPE_SECRET_KEY
```

#### Get Firebase Service Account Key

1. Go to Firebase Console > Project Settings > Service accounts
2. Click "Generate new private key"
3. Download the JSON file
4. Copy the entire JSON content to the `FIREBASE_SERVICE_ACCOUNT` secret

### Deploy

#### Manual Deployment

```bash
npm run deploy
```

#### Automatic Deployment

Push to the `main` branch to trigger automatic deployment via GitHub Actions.

## 🔐 Security Rules

The project includes Firestore and Storage security rules. Deploy them:

```bash
firebase deploy --only firestore:rules
firebase deploy --only storage:rules
```

## 📊 Database Schema

### Collections

- **users**: User profiles and authentication data
- **tenders**: Tender listings and information
- **bookings**: Booking requests and status
- **submissions**: Connector submissions and reviews
- **messages**: User communications
- **ratings**: User ratings and feedback
- **notifications**: System notifications

### Sample Data

You can add sample data using the Firebase Console or by creating a script in the `scripts/` directory.

## 🧪 Testing

### Running Tests

```bash
npm test
```

### Test Coverage

```bash
npm run test:coverage
```

## 🐛 Troubleshooting

### Common Issues

1. **Firebase connection errors**: Check your environment variables
2. **Build errors**: Ensure all dependencies are installed
3. **Authentication issues**: Verify Firebase Auth is enabled
4. **Database permission errors**: Check Firestore security rules

### Getting Help

- Check the [Firebase Documentation](https://firebase.google.com/docs)
- Review the [Next.js Documentation](https://nextjs.org/docs)
- Open an issue in the GitHub repository

## 📝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

---

For more detailed information, see the [README.md](README.md) file.
