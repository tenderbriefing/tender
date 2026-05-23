#!/usr/bin/env node

/**
 * Firebase Push Notifications Setup Script
 * 
 * This script helps you set up Firebase Cloud Messaging for push notifications
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Firebase Push Notifications Setup\n');

// Check if Firebase CLI is installed
try {
  execSync('firebase --version', { stdio: 'ignore' });
  console.log('✅ Firebase CLI is installed');
} catch (error) {
  console.log('❌ Firebase CLI is not installed');
  console.log('Please install it with: npm install -g firebase-tools');
  process.exit(1);
}

// Check if user is logged in
try {
  execSync('firebase projects:list', { stdio: 'ignore' });
  console.log('✅ Firebase CLI is authenticated');
} catch (error) {
  console.log('❌ Firebase CLI is not authenticated');
  console.log('Please run: firebase login');
  process.exit(1);
}

console.log('\n📋 Setup Steps:');
console.log('1. Go to Firebase Console: https://console.firebase.google.com/');
console.log('2. Select project: tenderbriefing-15d91');
console.log('3. Go to Project Settings → Cloud Messaging');
console.log('4. In the "Web configuration" section, click "Generate key pair"');
console.log('5. Copy the VAPID key');
console.log('6. Add it to your .env.local file:');
console.log('   NEXT_PUBLIC_FIREBASE_VAPID_KEY=your-vapid-key-here');

console.log('\n🔧 Current Firebase Configuration:');
console.log('Project ID: tenderbriefing-15d91');
console.log('App ID: 1:812914997499:web:651a2217f574e8be05d85e');
console.log('Measurement ID: G-1GXKBNS6PG');

console.log('\n📱 Testing Push Notifications:');
console.log('1. Visit: https://tenderbriefing-15d91.web.app/features-test');
console.log('2. Click "Test Notification" button');
console.log('3. Allow notifications when prompted');

console.log('\n🎯 Next Steps:');
console.log('1. Get VAPID key from Firebase Console');
console.log('2. Add to .env.local file');
console.log('3. Test push notifications');
console.log('4. Deploy updated application');

console.log('\n✨ Setup complete! Follow the steps above to enable push notifications.');
