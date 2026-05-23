# TenderConnect Deployment Guide

This guide covers deploying TenderConnect to Firebase Hosting with automatic deployments via GitHub Actions.

## 🚀 Prerequisites

- Firebase project set up
- GitHub repository
- Firebase CLI installed
- Node.js 18+ installed

## 📋 Pre-Deployment Checklist

### 1. Firebase Project Setup

- [ ] Firebase project created
- [ ] Authentication enabled (Email/Password)
- [ ] Firestore database created
- [ ] Storage enabled
- [ ] Firebase Hosting enabled

### 2. Environment Variables

Create a `.env.local` file with your Firebase configuration:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
STRIPE_PUBLISHABLE_KEY=pk_test_your_key
STRIPE_SECRET_KEY=sk_test_your_key
```

### 3. Security Rules

Deploy Firestore and Storage security rules:

```bash
firebase deploy --only firestore:rules
firebase deploy --only storage:rules
```

## 🔧 Manual Deployment

### 1. Build the Project

```bash
npm run build
```

### 2. Export Static Files

```bash
npm run export
```

### 3. Deploy to Firebase

```bash
firebase deploy
```

### 4. Deploy Specific Services

```bash
# Deploy only hosting
npm run deploy:hosting

# Deploy only Firestore rules
npm run deploy:firestore

# Deploy only Storage rules
npm run deploy:storage
```

## 🤖 Automatic Deployment with GitHub Actions

### 1. Set Up GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions

Add the following secrets:

#### Firebase Configuration
```
FIREBASE_API_KEY
FIREBASE_AUTH_DOMAIN
FIREBASE_PROJECT_ID
FIREBASE_STORAGE_BUCKET
FIREBASE_MESSAGING_SENDER_ID
FIREBASE_APP_ID
```

#### Stripe Configuration
```
STRIPE_PUBLISHABLE_KEY
STRIPE_SECRET_KEY
```

#### Firebase Service Account
```
FIREBASE_SERVICE_ACCOUNT
```

### 2. Get Firebase Service Account Key

1. Go to Firebase Console → Project Settings → Service accounts
2. Click "Generate new private key"
3. Download the JSON file
4. Copy the entire JSON content
5. Add it as the `FIREBASE_SERVICE_ACCOUNT` secret

### 3. Enable GitHub Actions

The workflow file is already configured in `.github/workflows/deploy.yml`. It will automatically:

- Run on pushes to `main` or `master` branch
- Install dependencies
- Run linter
- Build the project
- Deploy to Firebase Hosting

### 4. Test Deployment

1. Push changes to the `main` branch
2. Check the Actions tab in GitHub
3. Monitor the deployment progress
4. Visit your deployed site

## 🌐 Custom Domain Setup

### 1. Add Custom Domain in Firebase

1. Go to Firebase Console → Hosting
2. Click "Add custom domain"
3. Enter your domain name
4. Follow the verification steps

### 2. Update DNS Records

Add the required DNS records as shown in Firebase Console:

- A record pointing to Firebase IPs
- CNAME record for www subdomain

### 3. SSL Certificate

Firebase automatically provisions SSL certificates for custom domains.

## 📊 Monitoring and Analytics

### 1. Firebase Analytics

Enable Firebase Analytics in your project:

1. Go to Firebase Console → Analytics
2. Enable Google Analytics
3. Configure data collection

### 2. Performance Monitoring

Enable Firebase Performance Monitoring:

1. Go to Firebase Console → Performance
2. Enable Performance Monitoring
3. Monitor app performance

### 3. Error Reporting

Enable Firebase Crashlytics:

1. Go to Firebase Console → Crashlytics
2. Enable Crashlytics
3. Monitor app crashes and errors

## 🔒 Security Considerations

### 1. Environment Variables

- Never commit `.env.local` to version control
- Use different keys for development and production
- Rotate keys regularly

### 2. Firestore Security Rules

Review and test security rules:

```bash
firebase emulators:start --only firestore
```

### 3. Authentication

- Enable only necessary authentication providers
- Configure authorized domains
- Set up email verification

### 4. Storage Security

- Implement proper storage rules
- Validate file types and sizes
- Use signed URLs for sensitive files

## 🚨 Troubleshooting

### Common Issues

#### Build Failures

```bash
# Clear Next.js cache
rm -rf .next
npm run build
```

#### Firebase Connection Issues

- Verify environment variables
- Check Firebase project configuration
- Ensure proper authentication

#### Deployment Failures

- Check Firebase CLI version
- Verify project permissions
- Review deployment logs

### Debug Commands

```bash
# Check Firebase project
firebase projects:list

# Check current project
firebase use

# View deployment logs
firebase hosting:channel:list
```

## 📈 Performance Optimization

### 1. Image Optimization

- Use Next.js Image component
- Implement lazy loading
- Optimize image formats

### 2. Code Splitting

- Use dynamic imports
- Implement route-based splitting
- Optimize bundle size

### 3. Caching

- Configure proper cache headers
- Use Firebase Hosting caching
- Implement service worker

## 🔄 Rollback Strategy

### 1. Firebase Hosting Rollback

```bash
# List previous releases
firebase hosting:releases:list

# Rollback to previous release
firebase hosting:rollback
```

### 2. Database Rollback

- Use Firestore backup/restore
- Implement data migration scripts
- Test rollback procedures

## 📝 Maintenance

### Regular Tasks

- [ ] Update dependencies
- [ ] Review security rules
- [ ] Monitor performance
- [ ] Backup database
- [ ] Update documentation

### Monitoring

- Set up alerts for errors
- Monitor performance metrics
- Track user analytics
- Review security logs

## 🆘 Support

For deployment issues:

1. Check Firebase Console logs
2. Review GitHub Actions logs
3. Consult Firebase documentation
4. Open an issue in the repository

---

**Note**: This deployment guide assumes you're using Firebase Hosting. For other hosting providers, adjust the deployment steps accordingly.
