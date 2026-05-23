const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, serverTimestamp } = require('firebase/firestore');

// Firebase configuration - replace with your config
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Sample data
const sampleTenders = [
  {
    title: 'Government Infrastructure Development',
    description: 'Construction and maintenance of public infrastructure including roads, bridges, and public buildings.',
    organization: 'Department of Public Works',
    location: 'Johannesburg, Gauteng',
    briefingDate: new Date('2024-02-15'),
    briefingTime: '10:00 AM',
    briefingVenue: 'Johannesburg City Hall',
    submissionDeadline: new Date('2024-03-01'),
    estimatedValue: 5000000,
    category: 'Construction',
    requirements: ['Valid CIDB registration', '5+ years experience', 'Financial capability'],
    contactPerson: 'John Smith',
    contactEmail: 'john.smith@publicworks.gov.za',
    contactPhone: '+27 11 123 4567',
    status: 'active',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  },
  {
    title: 'Healthcare Technology Solutions',
    description: 'Implementation of digital health systems and medical equipment procurement.',
    organization: 'Department of Health',
    location: 'Cape Town, Western Cape',
    briefingDate: new Date('2024-02-20'),
    briefingTime: '2:00 PM',
    briefingVenue: 'Cape Town Convention Centre',
    submissionDeadline: new Date('2024-03-15'),
    estimatedValue: 3000000,
    category: 'Technology',
    requirements: ['Healthcare IT certification', 'Medical device experience', 'Compliance with health regulations'],
    contactPerson: 'Dr. Sarah Johnson',
    contactEmail: 'sarah.johnson@health.gov.za',
    contactPhone: '+27 21 987 6543',
    status: 'active',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  },
  {
    title: 'Educational Technology Integration',
    description: 'Digital learning platforms and educational content development for schools.',
    organization: 'Department of Education',
    location: 'Durban, KwaZulu-Natal',
    briefingDate: new Date('2024-02-25'),
    briefingTime: '9:00 AM',
    briefingVenue: 'Durban ICC',
    submissionDeadline: new Date('2024-03-20'),
    estimatedValue: 2000000,
    category: 'Education',
    requirements: ['Educational technology experience', 'Teacher training programs', 'Multilingual content support'],
    contactPerson: 'Prof. Michael Brown',
    contactEmail: 'michael.brown@education.gov.za',
    contactPhone: '+27 31 456 7890',
    status: 'active',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  },
  {
    title: 'Transportation Infrastructure Upgrade',
    description: 'Modernization of public transportation systems and infrastructure.',
    organization: 'Department of Transport',
    location: 'Pretoria, Gauteng',
    briefingDate: new Date('2024-03-01'),
    briefingTime: '11:00 AM',
    briefingVenue: 'Pretoria City Hall',
    submissionDeadline: new Date('2024-03-25'),
    estimatedValue: 7500000,
    category: 'Transportation',
    requirements: ['Transport engineering experience', 'Public sector experience', 'Environmental compliance'],
    contactPerson: 'Ms. Lisa van der Merwe',
    contactEmail: 'lisa.vandermerwe@transport.gov.za',
    contactPhone: '+27 12 345 6789',
    status: 'active',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  },
  {
    title: 'Renewable Energy Project',
    description: 'Solar and wind energy infrastructure development for rural communities.',
    organization: 'Department of Energy',
    location: 'Bloemfontein, Free State',
    briefingDate: new Date('2024-03-05'),
    briefingTime: '1:00 PM',
    briefingVenue: 'Free State Convention Centre',
    submissionDeadline: new Date('2024-03-30'),
    estimatedValue: 12000000,
    category: 'Energy',
    requirements: ['Renewable energy expertise', 'Rural development experience', 'Environmental impact assessment'],
    contactPerson: 'Mr. David Mthembu',
    contactEmail: 'david.mthembu@energy.gov.za',
    contactPhone: '+27 51 234 5678',
    status: 'active',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }
];

const sampleUsers = [
  {
    email: 'admin@tenderconnect.com',
    displayName: 'Admin User',
    userType: 'admin',
    companyName: 'TenderConnect',
    phoneNumber: '+27 11 999 8888',
    location: 'Johannesburg, Gauteng',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  },
  {
    email: 'entrepreneur@example.com',
    displayName: 'John Entrepreneur',
    userType: 'entrepreneur',
    companyName: 'Tech Solutions Ltd',
    phoneNumber: '+27 11 123 4567',
    location: 'Johannesburg, Gauteng',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  },
  {
    email: 'connector@example.com',
    displayName: 'Sarah Connector',
    userType: 'connector',
    phoneNumber: '+27 11 987 6543',
    location: 'Cape Town, Western Cape',
    skills: ['Documentation', 'Communication', 'Business Analysis'],
    rating: 4.8,
    totalJobs: 15,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }
];

async function initializeDatabase() {
  try {
    console.log('🚀 Initializing TenderConnect database...');

    // Add sample tenders
    console.log('📋 Adding sample tenders...');
    for (const tender of sampleTenders) {
      const docRef = await addDoc(collection(db, 'tenders'), tender);
      console.log(`✅ Added tender: ${tender.title} (ID: ${docRef.id})`);
    }

    // Add sample users
    console.log('👥 Adding sample users...');
    for (const user of sampleUsers) {
      const docRef = await addDoc(collection(db, 'users'), user);
      console.log(`✅ Added user: ${user.displayName} (ID: ${docRef.id})`);
    }

    console.log('🎉 Database initialization completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Set up Firebase Authentication');
    console.log('2. Configure Firestore security rules');
    console.log('3. Set up Firebase Storage');
    console.log('4. Test the application');

  } catch (error) {
    console.error('❌ Error initializing database:', error);
    process.exit(1);
  }
}

// Run the initialization
initializeDatabase();
