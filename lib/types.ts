export interface Tender {
  id: string;
  title: string;
  description: string;
  organization: string;
  location: string;
  briefingDate: Date;
  briefingTime: string;
  briefingVenue: string;
  submissionDeadline: Date;
  estimatedValue?: number;
  category: string;
  requirements: string[];
  contactPerson?: string;
  contactEmail?: string;
  contactPhone?: string;
  status: 'active' | 'closed' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

export interface Booking {
  id: string;
  tenderId: string;
  entrepreneurId: string;
  connectorId?: string;
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  paymentStatus: 'pending' | 'paid' | 'refunded';
  amount: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  briefingDate: Date;
  briefingTime: string;
  briefingVenue: string;
}

export interface Submission {
  id: string;
  bookingId: string;
  connectorId: string;
  audioFileUrl?: string;
  notes: string;
  attendanceProofUrl: string;
  submissionDate: Date;
  qualityScore?: number;
  reviewedBy?: string;
  reviewNotes?: string;
  status: 'submitted' | 'under_review' | 'approved' | 'rejected';
}

export interface Message {
  id: string;
  bookingId: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: Date;
  read: boolean;
}

export interface Rating {
  id: string;
  bookingId: string;
  raterId: string;
  rateeId: string;
  rating: number; // 1-5
  comment?: string;
  createdAt: Date;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'booking' | 'message' | 'rating' | 'system';
  read: boolean;
  createdAt: Date;
  data?: any; // Additional data for the notification
}

export interface ConnectorProfile {
  uid: string;
  skills: string[];
  experience: string;
  availability: {
    days: string[];
    timeSlots: string[];
  };
  rating: number;
  totalJobs: number;
  completedJobs: number;
  location: string;
  transport: 'own_vehicle' | 'public_transport' | 'walking';
  languages: string[];
  verified: boolean;
  verificationDocuments?: string[];
}

export interface EntrepreneurProfile {
  uid: string;
  companyName: string;
  companyType: string;
  industry: string;
  location: string;
  phoneNumber: string;
  website?: string;
  description?: string;
  totalBookings: number;
  rating: number;
}

export interface ScrapingJob {
  id: string;
  source: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  totalFound: number;
  newTenders: number;
  updatedTenders: number;
  errors: string[];
  result?: any;
}
