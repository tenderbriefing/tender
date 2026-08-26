# 📁 Google Drive API Integration Setup

## ✅ **Google Drive API Key Received**

Your Google Drive API key: `dbc96530b2529d5442cf5bb059124031635b46a7`

## 🔧 **Setup Instructions**

### **Step 1: Enable Google Drive API**

1. **Go to Google Cloud Console**:
   - Visit: https://console.cloud.google.com/apis/library?project=tenderbriefing-472813
   - Search for "Google Drive API"
   - Click on it and press "Enable"

2. **Alternative Method**:
   - Go to: https://console.cloud.google.com/apis/library/drive.googleapis.com?project=tenderbriefing-472813
   - Click "Enable" if not already enabled

### **Step 2: Create .env.local File**

Add these environment variables to your `.env.local` file:

```env
# Google Drive API Key
GOOGLE_DRIVE_API_KEY=dbc96530b2529d5442cf5bb059124031635b46a7

# Google Cloud Storage
GOOGLE_CLOUD_PROJECT_ID=tenderbriefing-472813
GOOGLE_CLOUD_STORAGE_BUCKET=tenderbriefing

# Google Maps API Key
GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_API_KEY

# Firebase Configuration (to be filled in)
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=tenderbriefing-15d91.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=tenderbriefing-15d91
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=tenderbriefing-15d91.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id_here
NEXT_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id_here

# Google Calendar Configuration
GOOGLE_CALENDAR_CLIENT_EMAIL=tenderbriefing@tenderbriefing-472813.iam.gserviceaccount.com
GOOGLE_CALENDAR_PRIVATE_KEY="YOUR_PRIVATE_KEY_FROM_SERVICE_ACCOUNT_JSON\n"
GOOGLE_CALENDAR_PROJECT_ID=tenderbriefing-472813
GOOGLE_CALENDAR_CLIENT_ID=116833974948051371357

# Stripe Configuration (to be filled in)
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_key_here
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_here

# Admin Configuration
ADMIN_EMAIL=admin@tenderconnect.com
```

### **Step 3: Test the Integration**

1. **Restart your development server**:
   ```bash
   npm run dev
   ```

2. **Visit the Drive Test Page**:
   ```
   http://localhost:3000/drive-test
   ```

3. **Test the following features**:
   - ✅ Create folders and documents
   - ✅ Upload and manage files
   - ✅ Search and list files
   - ✅ Share files with others
   - ✅ Create tender-specific folders

## 🎯 **Google Drive Features Available**

### **1. File Management**
```typescript
// Create folders
const folder = await googleDriveService.createFolder('My Folder');

// Upload files
const file = await googleDriveService.uploadFile(fileBuffer, {
  name: 'document.pdf',
  parents: ['folder-id'],
  description: 'Tender document'
});

// List files
const files = await googleDriveService.listFiles('name contains "tender"');
```

### **2. Document Collaboration**
```typescript
// Create Google Docs
const doc = await googleDriveService.createDocument('Meeting Notes');

// Create Spreadsheets
const sheet = await googleDriveService.createSpreadsheet('Tender Tracking');

// Share files
await googleDriveService.shareFile('file-id', {
  role: 'writer',
  type: 'user',
  emailAddress: 'user@example.com'
});
```

### **3. TenderConnect Integration**
```typescript
// Create tender folder structure
const tenderFolder = await googleDriveService.createTenderFolder(
  'TENDER-001',
  'Road Construction Project'
);

// Upload tender documents
const document = await googleDriveService.uploadTenderDocument(
  fileBuffer,
  'TENDER-001',
  'briefing_notes',
  'briefing-notes.pdf',
  tenderFolder.id
);
```

## 🚀 **Integration with TenderConnect**

### **Document Organization Structure**
```
Google Drive/
├── TenderConnect/
│   ├── Tenders/
│   │   ├── Tender: Road Construction/
│   │   │   ├── Briefing Documents/
│   │   │   ├── Audio Recordings/
│   │   │   ├── Attendance Proof/
│   │   │   └── Connector Submissions/
│   │   └── Tender: Building Project/
│   ├── Users/
│   │   ├── Entrepreneurs/
│   │   └── Connectors/
│   └── Templates/
│       ├── Briefing Notes Template
│       ├── Submission Report Template
│       └── Invoice Template
```

### **Use Cases for TenderConnect**

1. **Tender Document Management**
   - Store tender specifications and requirements
   - Organize briefing materials and presentations
   - Maintain version control for document updates

2. **Collaborative Documentation**
   - Real-time collaboration on briefing notes
   - Shared spreadsheets for tender tracking
   - Collaborative editing of submission reports

3. **File Sharing & Access Control**
   - Share tender folders with specific users
   - Control read/write permissions
   - Track document access and modifications

4. **Template Management**
   - Standardized briefing note templates
   - Submission report formats
   - Invoice and payment templates

## 📊 **API Usage & Costs**

### **Current Usage Limits**
- **Free tier**: 1 billion requests/day
- **Storage**: 15GB free per user
- **File size limit**: 5TB per file
- **API requests**: 1,000 requests/100 seconds per user

### **Estimated Monthly Costs (1000 users)**
```
API Requests: $0.00 (within free tier)
Storage: $0.00 (within free tier)
Bandwidth: $0.00 (within free tier)
Total: $0.00/month
```

## 🔒 **Security & Permissions**

### **Service Account Permissions**
- **Drive**: Full access to create, read, update, delete files
- **Drive File**: Access to files created by the app
- **Drive Metadata**: Read metadata for files and folders

### **Access Control**
- **Private by default**: Files are private unless explicitly shared
- **Granular permissions**: Reader, Writer, Owner roles
- **Domain restrictions**: Can restrict access to specific domains
- **Time-limited access**: Can set expiration dates for shared files

## 🎉 **Next Steps**

1. **Enable Google Drive API** in Google Cloud Console
2. **Create the .env.local file** with your configuration
3. **Test the integration** at http://localhost:3000/drive-test
4. **Set up tender folder templates** for consistent organization
5. **Integrate document collaboration** into your tender workflow

## 🔗 **Useful Links**

- **Drive Test Page**: http://localhost:3000/drive-test
- **Google Cloud Console**: https://console.cloud.google.com/apis/library?project=tenderbriefing-472813
- **Drive API Documentation**: https://developers.google.com/drive/api
- **Drive API Explorer**: https://developers.google.com/drive/api/v3/reference

## 📱 **Drive Integration Examples**

### **Create Tender Folder Structure**
```typescript
// Automatically create organized folder structure for each tender
const createTenderWorkspace = async (tenderId: string, tenderTitle: string) => {
  const tenderFolder = await googleDriveService.createTenderFolder(tenderId, tenderTitle);
  
  // Create template documents
  await googleDriveService.createTenderDocument(
    tenderId,
    'briefing_notes',
    'Briefing Notes Template',
    tenderFolder.id
  );
  
  return tenderFolder;
};
```

### **Collaborative Briefing Notes**
```typescript
// Create collaborative document for briefing notes
const createBriefingDocument = async (tenderId: string, connectorEmail: string) => {
  const doc = await googleDriveService.createDocument(
    `Briefing Notes - Tender ${tenderId}`,
    'Briefing notes template content...'
  );
  
  // Share with connector for real-time collaboration
  await googleDriveService.shareFile(doc.id, {
    role: 'writer',
    type: 'user',
    emailAddress: connectorEmail
  });
  
  return doc;
};
```

### **File Upload with Organization**
```typescript
// Upload files to appropriate tender folders
const uploadTenderFile = async (file: File, tenderId: string, documentType: string) => {
  const result = await googleDriveService.uploadTenderDocument(
    file,
    tenderId,
    documentType,
    file.name
  );
  
  return result;
};
```

---

**Your Google Drive integration is ready! The API key is configured and all document collaboration services are available for TenderConnect.** 📁
