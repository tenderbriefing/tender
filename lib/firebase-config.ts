// Firebase web app configuration (public client values — embedded in browser bundle)
// https://firebase.google.com/docs/web/setup#config-object

export const firebaseConfig = {
  apiKey: 'AIzaSyDk_QBzmOXJfdl4PPqycoKtecGu0ioCRuY',
  authDomain: 'tenderbriefing-34679.firebaseapp.com',
  projectId: 'tenderbriefing-34679',
  storageBucket: 'tenderbriefing-34679.firebasestorage.app',
  messagingSenderId: '9058655644',
  appId: '1:9058655644:web:fbd4b4a46102aa3dd73c59',
  measurementId: 'G-KDQ56R3P5S',
}

export const getFirebaseConfig = () => ({
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || firebaseConfig.apiKey,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || firebaseConfig.authDomain,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || firebaseConfig.projectId,
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || firebaseConfig.storageBucket,
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || firebaseConfig.messagingSenderId,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || firebaseConfig.appId,
  measurementId:
    process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || firebaseConfig.measurementId,
})
