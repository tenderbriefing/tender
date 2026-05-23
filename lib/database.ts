import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  startAfter,
  Timestamp,
  serverTimestamp,
  DocumentSnapshot,
  QueryConstraint
} from 'firebase/firestore'
import { db } from './firebase'

// Export db for use in services
export { db }
import { Tender, Booking, Submission, Message, Rating, Notification } from './types'
import { UserProfile } from './auth'

// Collection references
export const collections = {
  users: collection(db, 'users'),
  tenders: collection(db, 'tenders'),
  bookings: collection(db, 'bookings'),
  submissions: collection(db, 'submissions'),
  messages: collection(db, 'messages'),
  ratings: collection(db, 'ratings'),
  notifications: collection(db, 'notifications'),
}

// Helper function to convert Firestore timestamps to Date objects
export const convertTimestamps = (data: any): any => {
  if (!data) return data
  
  const converted = { ...data }
  
  // Convert Firestore Timestamps to Date objects
  Object.keys(converted).forEach(key => {
    if (converted[key] instanceof Timestamp) {
      converted[key] = converted[key].toDate()
    }
  })
  
  return converted
}

// User operations
export const createUser = async (userData: Omit<UserProfile, 'uid' | 'createdAt' | 'updatedAt'>) => {
  const docRef = await addDoc(collections.users, {
    ...userData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return docRef.id
}

export const updateUser = async (uid: string, userData: Partial<UserProfile>) => {
  const userRef = doc(db, 'users', uid)
  await updateDoc(userRef, {
    ...userData,
    updatedAt: serverTimestamp(),
  })
}

export const getUser = async (uid: string): Promise<UserProfile | null> => {
  const userRef = doc(db, 'users', uid)
  const userSnap = await getDoc(userRef)
  
  if (userSnap.exists()) {
    return convertTimestamps({ uid, ...userSnap.data() }) as UserProfile
  }
  return null
}

// Tender operations
export const createTender = async (tenderData: Omit<Tender, 'id' | 'createdAt' | 'updatedAt'>) => {
  const docRef = await addDoc(collections.tenders, {
    ...tenderData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return docRef.id
}

export const updateTender = async (tenderId: string, tenderData: Partial<Tender>) => {
  const tenderRef = doc(db, 'tenders', tenderId)
  await updateDoc(tenderRef, {
    ...tenderData,
    updatedAt: serverTimestamp(),
  })
}

export const getTender = async (tenderId: string): Promise<Tender | null> => {
  const tenderRef = doc(db, 'tenders', tenderId)
  const tenderSnap = await getDoc(tenderRef)
  
  if (tenderSnap.exists()) {
    return convertTimestamps({ id: tenderId, ...tenderSnap.data() }) as Tender
  }
  return null
}

export const getTenders = async (constraints: QueryConstraint[] = []): Promise<Tender[]> => {
  const q = query(collections.tenders, ...constraints)
  const querySnapshot = await getDocs(q)
  
  return querySnapshot.docs.map(doc => 
    convertTimestamps({ id: doc.id, ...doc.data() }) as Tender
  )
}

export const getActiveTenders = async (): Promise<Tender[]> => {
  return getTenders([
    where('status', '==', 'active'),
    orderBy('briefingDate', 'asc')
  ])
}

export const getTendersByCategory = async (category: string): Promise<Tender[]> => {
  return getTenders([
    where('category', '==', category),
    where('status', '==', 'active'),
    orderBy('briefingDate', 'asc')
  ])
}

export const getTendersByLocation = async (location: string): Promise<Tender[]> => {
  return getTenders([
    where('location', '==', location),
    where('status', '==', 'active'),
    orderBy('briefingDate', 'asc')
  ])
}

// Booking operations
export const createBooking = async (bookingData: Omit<Booking, 'id' | 'createdAt' | 'updatedAt'>) => {
  const docRef = await addDoc(collections.bookings, {
    ...bookingData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return docRef.id
}

export const updateBooking = async (bookingId: string, bookingData: Partial<Booking>) => {
  const bookingRef = doc(db, 'bookings', bookingId)
  await updateDoc(bookingRef, {
    ...bookingData,
    updatedAt: serverTimestamp(),
  })
}

export const getBooking = async (bookingId: string): Promise<Booking | null> => {
  const bookingRef = doc(db, 'bookings', bookingId)
  const bookingSnap = await getDoc(bookingRef)
  
  if (bookingSnap.exists()) {
    return convertTimestamps({ id: bookingId, ...bookingSnap.data() }) as Booking
  }
  return null
}

export const getBookingsByEntrepreneur = async (entrepreneurId: string): Promise<Booking[]> => {
  const q = query(
    collections.bookings,
    where('entrepreneurId', '==', entrepreneurId),
    orderBy('createdAt', 'desc')
  )
  const querySnapshot = await getDocs(q)
  
  return querySnapshot.docs.map(doc => 
    convertTimestamps({ id: doc.id, ...doc.data() }) as Booking
  )
}

export const getBookingsByConnector = async (connectorId: string): Promise<Booking[]> => {
  const q = query(
    collections.bookings,
    where('connectorId', '==', connectorId),
    orderBy('createdAt', 'desc')
  )
  const querySnapshot = await getDocs(q)
  
  return querySnapshot.docs.map(doc => 
    convertTimestamps({ id: doc.id, ...doc.data() }) as Booking
  )
}

export const getAvailableBookings = async (): Promise<Booking[]> => {
  const q = query(
    collections.bookings,
    where('status', '==', 'pending'),
    orderBy('createdAt', 'desc')
  )
  const querySnapshot = await getDocs(q)
  
  return querySnapshot.docs.map(doc => 
    convertTimestamps({ id: doc.id, ...doc.data() }) as Booking
  )
}

// Submission operations
export const createSubmission = async (submissionData: Omit<Submission, 'id'>) => {
  const docRef = await addDoc(collections.submissions, {
    ...submissionData,
    submissionDate: serverTimestamp(),
  })
  return docRef.id
}

export const updateSubmission = async (submissionId: string, submissionData: Partial<Submission>) => {
  const submissionRef = doc(db, 'submissions', submissionId)
  await updateDoc(submissionRef, submissionData)
}

export const getSubmission = async (submissionId: string): Promise<Submission | null> => {
  const submissionRef = doc(db, 'submissions', submissionId)
  const submissionSnap = await getDoc(submissionRef)
  
  if (submissionSnap.exists()) {
    return convertTimestamps({ id: submissionId, ...submissionSnap.data() }) as Submission
  }
  return null
}

export const getSubmissionsByBooking = async (bookingId: string): Promise<Submission[]> => {
  const q = query(
    collections.submissions,
    where('bookingId', '==', bookingId)
  )
  const querySnapshot = await getDocs(q)
  
  return querySnapshot.docs.map(doc => 
    convertTimestamps({ id: doc.id, ...doc.data() }) as Submission
  )
}

// Message operations
export const createMessage = async (messageData: Omit<Message, 'id'>) => {
  const docRef = await addDoc(collections.messages, {
    ...messageData,
    timestamp: serverTimestamp(),
    read: false,
  })
  return docRef.id
}

export const getMessagesByBooking = async (bookingId: string): Promise<Message[]> => {
  const q = query(
    collections.messages,
    where('bookingId', '==', bookingId),
    orderBy('timestamp', 'asc')
  )
  const querySnapshot = await getDocs(q)
  
  return querySnapshot.docs.map(doc => 
    convertTimestamps({ id: doc.id, ...doc.data() }) as Message
  )
}

export const markMessageAsRead = async (messageId: string) => {
  const messageRef = doc(db, 'messages', messageId)
  await updateDoc(messageRef, { read: true })
}

// Rating operations
export const createRating = async (ratingData: Omit<Rating, 'id' | 'createdAt'>) => {
  const docRef = await addDoc(collections.ratings, {
    ...ratingData,
    createdAt: serverTimestamp(),
  })
  return docRef.id
}

export const getRatingsByUser = async (userId: string): Promise<Rating[]> => {
  const q = query(
    collections.ratings,
    where('rateeId', '==', userId),
    orderBy('createdAt', 'desc')
  )
  const querySnapshot = await getDocs(q)
  
  return querySnapshot.docs.map(doc => 
    convertTimestamps({ id: doc.id, ...doc.data() }) as Rating
  )
}

export const getAverageRating = async (userId: string): Promise<number> => {
  const ratings = await getRatingsByUser(userId)
  if (ratings.length === 0) return 0
  
  const sum = ratings.reduce((acc, rating) => acc + rating.rating, 0)
  return sum / ratings.length
}

// Notification operations
export const createNotification = async (notificationData: Omit<Notification, 'id' | 'createdAt'>) => {
  const docRef = await addDoc(collections.notifications, {
    ...notificationData,
    read: false,
    createdAt: serverTimestamp(),
  })
  return docRef.id
}

export const getNotificationsByUser = async (userId: string): Promise<Notification[]> => {
  const q = query(
    collections.notifications,
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(50)
  )
  const querySnapshot = await getDocs(q)
  
  return querySnapshot.docs.map(doc => 
    convertTimestamps({ id: doc.id, ...doc.data() }) as Notification
  )
}

export const markNotificationAsRead = async (notificationId: string) => {
  const notificationRef = doc(db, 'notifications', notificationId)
  await updateDoc(notificationRef, { read: true })
}

// Search and filtering utilities
export const searchTenders = async (searchTerm: string): Promise<Tender[]> => {
  // Note: Firestore doesn't support full-text search natively
  // This is a basic implementation - consider using Algolia for production
  const tenders = await getActiveTenders()
  
  return tenders.filter(tender => 
    tender.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tender.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tender.organization.toLowerCase().includes(searchTerm.toLowerCase())
  )
}

export const getConnectorsByLocation = async (location: string): Promise<UserProfile[]> => {
  const q = query(
    collections.users,
    where('userType', '==', 'connector'),
    where('location', '==', location)
  )
  const querySnapshot = await getDocs(q)
  
  return querySnapshot.docs.map(doc => 
    convertTimestamps({ uid: doc.id, ...doc.data() }) as UserProfile
  )
}
