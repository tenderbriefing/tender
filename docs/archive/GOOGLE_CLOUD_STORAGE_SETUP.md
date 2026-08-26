# ☁️ Google Cloud Storage Integration Setup

## ✅ **Storage Bucket Configured**

Your Google Cloud Storage bucket is ready:
- **Bucket Name**: `tenderbriefing`
- **Project ID**: `tenderbriefing-472813`
- **Location**: EU (multiple regions)
- **Storage Class**: Standard
- **Encryption**: Google-managed
- **Public Access**: Not public (secure)

## 🔧 **Setup Instructions**

### **Step 1: Create .env.local File**

Add these environment variables to your `.env.local` file:

```env
# Google Cloud Storage (already configured via service account)
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

### **Step 2: Test the Integration**

1. **Restart your development server**:
   ```bash
   npm run dev
   ```

2. **Visit the Storage Test Page**:
   ```
   http://localhost:3000/storage-test
   ```

3. **Test the following features**:
   - ✅ File upload (drag & drop or click)
   - ✅ File listing and management
   - ✅ File metadata retrieval
   - ✅ Signed URL generation
   - ✅ Public/private access control
   - ✅ File deletion

## 🎯 **Google Cloud Storage Features Available**

### **1. File Upload & Management**
```typescript
// Upload any file type
const result = await googleCloudStorageService.uploadFile(fileBuffer, 'document.pdf');

// Upload with metadata
const result = await googleCloudStorageService.uploadFile(fileBuffer, 'image.jpg', {
  destination: 'uploads/images/image.jpg',
  metadata: {
    contentType: 'image/jpeg',
    metadata: {
      uploadedBy: 'user123',
      category: 'profile'
    }
  }
});
```

### **2. TenderConnect-Specific Uploads**
```typescript
// Upload tender documents
const result = await googleCloudStorageService.uploadTenderDocument(
  fileBuffer,
  'tender123',
  'briefing_notes',
  'briefing-notes.pdf'
);

// Upload user documents
const result = await googleCloudStorageService.uploadUserDocument(
  fileBuffer,
  'user456',
  'id_document',
  'id-card.jpg'
);

// Upload connector submissions
const result = await googleCloudStorageService.uploadConnectorSubmission(
  fileBuffer,
  'submission789',
  'audio',
  'briefing-recording.mp3'
);
```

### **3. File Access Control**
```typescript
// Generate signed URLs for secure access
const signedUrl = await googleCloudStorageService.generateSignedUrl(
  'documents/private-file.pdf',
  'read',
  new Date(Date.now() + 3600000) // 1 hour
);

// Make files public
const result = await googleCloudStorageService.makeFilePublic('public/image.jpg');

// Make files private
const result = await googleCloudStorageService.makeFilePrivate('private/document.pdf');
```

### **4. File Management**
```typescript
// List files with prefix
const files = await googleCloudStorageService.listFiles('tenders/', 50);

// Get file metadata
const metadata = await googleCloudStorageService.getFileMetadata('document.pdf');

// Delete files
const result = await googleCloudStorageService.deleteFile('old-file.pdf');
```

## 🚀 **Integration with TenderConnect**

### **File Organization Structure**
```
tenderbriefing/
├── tenders/
│   ├── {tenderId}/
│   │   ├── briefing_notes/
│   │   ├── audio_recording/
│   │   ├── attendance_proof/
│   │   └── other/
├── users/
│   ├── {userId}/
│   │   ├── profile_image/
│   │   ├── id_document/
│   │   ├── certificate/
│   │   └── other/
├── submissions/
│   ├── {submissionId}/
│   │   ├── audio/
│   │   ├── notes/
│   │   ├── proof/
│   │   └── other/
└── public/
    ├── images/
    ├── documents/
    └── media/
```

### **Use Cases for TenderConnect**

1. **Tender Documents**
   - Briefing notes and presentations
   - Tender specifications
   - Supporting documents

2. **User Documents**
   - Profile images
   - ID documents for verification
   - Certificates and qualifications

3. **Connector Submissions**
   - Audio recordings of briefings
   - Written notes and summaries
   - Attendance proof and photos

4. **Media Files**
   - Company logos
   - Marketing materials
   - Training videos

## 📊 **Storage Costs & Limits**

### **Pricing (EU Region)**
- **Storage**: $0.020 per GB per month
- **Class A Operations** (writes): $0.05 per 1,000 operations
- **Class B Operations** (reads): $0.004 per 1,000 operations
- **Network Egress**: $0.12 per GB (first 1TB free)

### **Estimated Monthly Costs (1000 users)**
```
Storage (10GB): $0.20
Operations (10,000): $0.50
Network: $0.00 (within free tier)
Total: $0.70/month
```

### **Storage Limits**
- **Maximum file size**: 5TB
- **Maximum bucket size**: No limit
- **Maximum objects per bucket**: No limit
- **Maximum objects per prefix**: No limit

## 🔒 **Security & Access Control**

### **Current Configuration**
- **Public Access**: Disabled (secure by default)
- **Encryption**: Google-managed keys
- **Access Control**: Uniform bucket-level access
- **Soft Delete**: 7 days retention

### **Security Best Practices**
1. **Use signed URLs** for temporary access
2. **Implement proper IAM roles** for service accounts
3. **Enable audit logging** for compliance
4. **Use lifecycle policies** for cost optimization
5. **Regular security reviews** of access patterns

## 🎉 **Next Steps**

1. **Create the .env.local file** with your configuration
2. **Test the integration** at http://localhost:3000/storage-test
3. **Integrate file uploads** into your tender submission forms
4. **Set up file organization** for different document types
5. **Implement access controls** for sensitive documents

## 🔗 **Useful Links**

- **Storage Test Page**: http://localhost:3000/storage-test
- **Google Cloud Console**: https://console.cloud.google.com/storage/browser/tenderbriefing;tab=objects?project=tenderbriefing-472813
- **Storage Documentation**: https://cloud.google.com/storage/docs
- **Node.js Client**: https://cloud.google.com/storage/docs/reference/libraries#client-libraries-install-nodejs

## 📱 **File Upload Component Usage**

```tsx
import FileUpload from '@/components/ui/FileUpload'

// General file upload
<FileUpload
  onUpload={(file, result) => console.log('Uploaded:', result)}
  onError={(error) => console.error('Upload failed:', error)}
  accept="image/*,application/pdf"
  maxSize={10}
/>

// Tender document upload
<FileUpload
  uploadType="tender-document"
  tenderId="tender123"
  documentType="briefing_notes"
  onUpload={(file, result) => console.log('Tender document uploaded:', result)}
  accept=".pdf,.doc,.docx"
  maxSize={25}
/>

// User document upload
<FileUpload
  uploadType="user-document"
  userId="user456"
  documentType="id_document"
  onUpload={(file, result) => console.log('User document uploaded:', result)}
  accept="image/*"
  maxSize={5}
/>
```

---

**Your Google Cloud Storage integration is ready! The bucket is configured and all file management services are available for TenderConnect.** ☁️
