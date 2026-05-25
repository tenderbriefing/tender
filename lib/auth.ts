import {

  createUserWithEmailAndPassword,

  signInWithEmailAndPassword,

  signOut,

  onAuthStateChanged,

  User,

  updateProfile,

} from 'firebase/auth';

import { doc, setDoc, getDoc } from 'firebase/firestore';

import { auth, db } from './firebase';

import { normalizeAuthEmail } from './auth/errors';

import { sanitizeClientData } from './auth/sanitize';



export type AgentVerificationStatus = 'pending' | 'verified' | 'suspended';



export interface UserProfile {

  uid: string;

  email: string;

  displayName: string;

  userType: 'sme' | 'youth-agent' | 'admin';

  companyName?: string;

  contactPerson?: string;

  phoneNumber?: string;

  location?: string;

  province?: string;

  city?: string;

  csdNumber?: string;

  skills?: string[];

  categories?: string[];

  sectors?: string[];

  provincesOfInterest?: string[];

  availabilityRadiusKm?: number;

  transportAvailable?: boolean;

  preferredServiceAreas?: string[];

  verificationStatus?: AgentVerificationStatus;

  reliabilityScore?: number;

  missedBriefingCount?: number;

  completedBriefingCount?: number;

  acceptedBriefingCount?: number;

  rating?: number;

  totalJobs?: number;

  createdAt: string;

  updatedAt: string;

}



function nowIso() {

  return new Date().toISOString();

}



async function writeRoleProfile(uid: string, userType: UserProfile['userType'], profile: UserProfile) {

  const timestamp = nowIso();

  if (userType === 'sme') {

    await setDoc(

      doc(db, 'smes', uid),

      sanitizeClientData({

        id: uid,

        uid,

        email: profile.email,

        displayName: profile.displayName,

        companyName: profile.companyName || '',

        contactPerson: profile.contactPerson || profile.displayName,

        phoneNumber: profile.phoneNumber || '',

        province: profile.province || '',

        location: profile.location || '',

        categories: profile.categories || [],

        sectors: profile.sectors || profile.categories || [],

        provincesOfInterest: profile.provincesOfInterest || [],

        csdNumber: profile.csdNumber || '',

        userType: 'sme',

        createdAt: profile.createdAt,

        updatedAt: timestamp,

      }),

      { merge: true }

    );

    return;

  }



  if (userType === 'youth-agent') {

    await setDoc(

      doc(db, 'agents', uid),

      sanitizeClientData({

        id: uid,

        uid,

        email: profile.email,

        displayName: profile.displayName,

        name: profile.displayName,

        phoneNumber: profile.phoneNumber || '',

        province: profile.province || '',

        city: profile.city || '',

        location: profile.location || '',

        availabilityRadiusKm: profile.availabilityRadiusKm ?? 25,

        transportAvailable: profile.transportAvailable !== false,

        preferredServiceAreas: profile.preferredServiceAreas || [],

        verificationStatus: profile.verificationStatus || 'pending',

        verified: false,

        reliabilityScore: profile.reliabilityScore ?? 100,

        missedBriefingCount: profile.missedBriefingCount ?? 0,

        completedBriefingCount: profile.completedBriefingCount ?? 0,

        acceptedBriefingCount: profile.acceptedBriefingCount ?? 0,

        rating: profile.rating ?? 3,

        userType: 'youth-agent',

        availability: 'available',

        createdAt: profile.createdAt,

        updatedAt: timestamp,

      }),

      { merge: true }

    );

  }

}



export const signUp = async (

  email: string,

  password: string,

  displayName: string,

  userType: 'sme' | 'youth-agent' | 'admin',

  additionalData?: Partial<UserProfile>

) => {

  const normalizedEmail = normalizeAuthEmail(email);

  const userCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);

  const user = userCredential.user;



  await updateProfile(user, { displayName: displayName.trim() });



  const timestamp = nowIso();

  const userProfile: UserProfile = sanitizeClientData({

    uid: user.uid,

    email: normalizedEmail,

    displayName: displayName.trim(),

    userType,

    createdAt: timestamp,

    updatedAt: timestamp,

    ...additionalData,

  }) as UserProfile;



  await setDoc(doc(db, 'users', user.uid), userProfile);

  await writeRoleProfile(user.uid, userType, userProfile);



  return { user, userProfile };

};



export const signIn = async (email: string, password: string) => {
  const normalizedEmail = normalizeAuthEmail(email)
  const userCredential = await signInWithEmailAndPassword(auth, normalizedEmail, password)
  const user = userCredential.user

  let userProfile: UserProfile | null = null
  try {
    const userDoc = await getDoc(doc(db, 'users', user.uid))
    if (userDoc.exists()) {
      userProfile = userDoc.data() as UserProfile
    }
  } catch (error) {
    const err = error as Error & { code?: string }
    err.code = err.code || 'permission-denied'
    throw err
  }

  return { user, userProfile }
}



export const logout = async () => {

  await signOut(auth);

};



export const getCurrentUser = (): Promise<User | null> => {

  return new Promise((resolve) => {

    const unsubscribe = onAuthStateChanged(auth, (user) => {

      unsubscribe();

      resolve(user);

    });

  });

};



export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {

  try {

    const userDoc = await getDoc(doc(db, 'users', uid));

    if (userDoc.exists()) {

      return userDoc.data() as UserProfile;

    }

    return null;

  } catch (error) {

    console.error('Error getting user profile:', error);

    return null;

  }

};


