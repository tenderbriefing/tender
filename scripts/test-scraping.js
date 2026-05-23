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

// Sample scraped tenders with compulsory briefings
const sampleScrapedTenders = [
  {
    title: 'Government Infrastructure Development - Compulsory Briefing Required',
    description: 'Construction and maintenance of public infrastructure including roads, bridges, and public buildings. A compulsory briefing session will be held to provide detailed information about the tender requirements and submission process. All interested parties are required to attend this briefing session.',
    organization: 'Department of Public Works',
    location: 'Johannesburg, Gauteng',
    briefingDate: new Date('2024-02-15'),
    briefingTime: '10:00 AM',
    briefingVenue: 'Johannesburg City Hall, Johannesburg, Gauteng',
    submissionDeadline: new Date('2024-03-01'),
    estimatedValue: 5000000,
    category: 'Construction',
    requirements: ['Valid CIDB registration', '5+ years experience', 'Financial capability', 'Valid tax clearance certificate', 'Company registration documents'],
    contactPerson: 'John Smith',
    contactEmail: 'procurement@publicworks.gov.za',
    contactPhone: '+27 11 123 4567',
    source: 'eTenders',
    sourceUrl: 'https://www.etenders.gov.za/tender/ET001001',
    isCompulsoryBriefing: true,
    briefingType: 'compulsory',
    status: 'active',
    scrapedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  },
  {
    title: 'Healthcare Technology Solutions - Compulsory Briefing Required',
    description: 'Implementation of digital health systems and medical equipment procurement. A compulsory briefing session will be held to provide detailed information about the tender requirements and submission process. All interested parties are required to attend this briefing session.',
    organization: 'Department of Health',
    location: 'Cape Town, Western Cape',
    briefingDate: new Date('2024-02-20'),
    briefingTime: '2:00 PM',
    briefingVenue: 'Cape Town Convention Centre, Cape Town, Western Cape',
    submissionDeadline: new Date('2024-03-15'),
    estimatedValue: 3000000,
    category: 'Technology',
    requirements: ['Healthcare IT certification', 'Medical device experience', 'Compliance with health regulations', 'Valid tax clearance certificate', 'Company registration documents'],
    contactPerson: 'Dr. Sarah Johnson',
    contactEmail: 'tenders@health.gov.za',
    contactPhone: '+27 21 987 6543',
    source: 'eTenders',
    sourceUrl: 'https://www.etenders.gov.za/tender/ET001002',
    isCompulsoryBriefing: true,
    briefingType: 'compulsory',
    status: 'active',
    scrapedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  },
  {
    title: 'Educational Technology Integration - Compulsory Briefing Required',
    description: 'Digital learning platforms and educational content development for schools. A compulsory briefing session will be held to provide detailed information about the tender requirements and submission process. All interested parties are required to attend this briefing session.',
    organization: 'Department of Education',
    location: 'Durban, KwaZulu-Natal',
    briefingDate: new Date('2024-02-25'),
    briefingTime: '9:00 AM',
    briefingVenue: 'Durban ICC, Durban, KwaZulu-Natal',
    submissionDeadline: new Date('2024-03-20'),
    estimatedValue: 2000000,
    category: 'Education',
    requirements: ['Educational technology experience', 'Teacher training programs', 'Multilingual content support', 'Valid tax clearance certificate', 'Company registration documents'],
    contactPerson: 'Prof. Michael Brown',
    contactEmail: 'contracts@education.gov.za',
    contactPhone: '+27 31 456 7890',
    source: 'eTenders',
    sourceUrl: 'https://www.etenders.gov.za/tender/ET001003',
    isCompulsoryBriefing: true,
    briefingType: 'compulsory',
    status: 'active',
    scrapedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  },
  {
    title: 'Transportation Infrastructure Upgrade - Compulsory Briefing Required',
    description: 'Modernization of public transportation systems and infrastructure. A compulsory briefing session will be held to provide detailed information about the tender requirements and submission process. All interested parties are required to attend this briefing session.',
    organization: 'Department of Transport',
    location: 'Pretoria, Gauteng',
    briefingDate: new Date('2024-03-01'),
    briefingTime: '11:00 AM',
    briefingVenue: 'Pretoria City Hall, Pretoria, Gauteng',
    submissionDeadline: new Date('2024-03-25'),
    estimatedValue: 7500000,
    category: 'Transportation',
    requirements: ['Transport engineering experience', 'Public sector experience', 'Environmental compliance', 'Valid tax clearance certificate', 'Company registration documents'],
    contactPerson: 'Ms. Lisa van der Merwe',
    contactEmail: 'admin@transport.gov.za',
    contactPhone: '+27 12 345 6789',
    source: 'eTenders',
    sourceUrl: 'https://www.etenders.gov.za/tender/ET001004',
    isCompulsoryBriefing: true,
    briefingType: 'compulsory',
    status: 'active',
    scrapedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  },
  {
    title: 'Renewable Energy Project - Compulsory Briefing Required',
    description: 'Solar and wind energy infrastructure development for rural communities. A compulsory briefing session will be held to provide detailed information about the tender requirements and submission process. All interested parties are required to attend this briefing session.',
    organization: 'Department of Energy',
    location: 'Bloemfontein, Free State',
    briefingDate: new Date('2024-03-05'),
    briefingTime: '1:00 PM',
    briefingVenue: 'Free State Convention Centre, Bloemfontein, Free State',
    submissionDeadline: new Date('2024-03-30'),
    estimatedValue: 12000000,
    category: 'Energy',
    requirements: ['Renewable energy expertise', 'Rural development experience', 'Environmental impact assessment', 'Valid tax clearance certificate', 'Company registration documents'],
    contactPerson: 'Mr. David Mthembu',
    contactEmail: 'procurement@energy.gov.za',
    contactPhone: '+27 51 234 5678',
    source: 'eTenders',
    sourceUrl: 'https://www.etenders.gov.za/tender/ET001005',
    isCompulsoryBriefing: true,
    briefingType: 'compulsory',
    status: 'active',
    scrapedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }
];

async function testScraping() {
  try {
    console.log('🧪 Testing tender scraping functionality...');

    // Add sample scraped tenders
    console.log('📋 Adding sample scraped tenders...');
    for (const tender of sampleScrapedTenders) {
      const docRef = await addDoc(collection(db, 'tenders'), tender);
      console.log(`✅ Added scraped tender: ${tender.title} (ID: ${docRef.id})`);
    }

    // Add a sample scraping job
    console.log('📊 Adding sample scraping job...');
    const scrapingJob = {
      source: 'eTenders',
      status: 'completed',
      startedAt: serverTimestamp(),
      completedAt: serverTimestamp(),
      totalFound: 15,
      newTenders: 5,
      updatedTenders: 3,
      errors: [],
      result: {
        success: true,
        tenders: sampleScrapedTenders.length,
        errors: []
      }
    };

    const jobRef = await addDoc(collection(db, 'scraping_jobs'), scrapingJob);
    console.log(`✅ Added scraping job: ${jobRef.id}`);

    console.log('🎉 Scraping test completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Check the dashboard to see the scraped tenders');
    console.log('2. Test the scraping API endpoints');
    console.log('3. Configure automatic scraping schedule');

  } catch (error) {
    console.error('❌ Error testing scraping:', error);
    process.exit(1);
  }
}

// Run the test
testScraping();
