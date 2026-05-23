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
  createdAt: Date;
  updatedAt: Date;
}

export const signUp = async (
  email: string,
  password: string,
  displayName: string,
  userType: 'sme' | 'youth-agent' | 'admin',
  additionalData?: Partial<UserProfile>
) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    await updateProfile(user, { displayName });

    const userProfile: UserProfile = {
      uid: user.uid,
      email: user.email!,
      displayName,
      userType,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...additionalData,
    };

    await setDoc(doc(db, 'users', user.uid), userProfile);
    return { user, userProfile };
  } catch (error) {
    throw error;
  }
};

export const signIn = async (email: string, password: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Get user profile
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    const userProfile = userDoc.data() as UserProfile;
    
    return { user, userProfile };
  } catch (error) {
    throw error;
  }
};

export const logout = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    throw error;
  }
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
