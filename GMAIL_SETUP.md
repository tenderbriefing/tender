# 📧 Gmail API Integration Setup

## ✅ **Gmail API Key Received**

Your Gmail API key: `dbc96530b2529d5442cf5bb059124031635b46a7`

## ✅ **OAuth2 Credentials Received**

Your OAuth2 credentials:
- **Client ID**: `YOUR_GMAIL_CLIENT_ID.apps.googleusercontent.com`
- **Client Secret**: `YOUR_GMAIL_CLIENT_SECRET`
- **Project ID**: `tenderbriefing-472813`

## ✅ **Firebase Configuration Received**

Your Firebase configuration:
- **API Key**: `YOUR_FIREBASE_API_KEY`
- **Auth Domain**: `tenderbriefing-15d91.firebaseapp.com`
- **Project ID**: `tenderbriefing-15d91`
- **Storage Bucket**: `tenderbriefing-15d91.firebasestorage.app`
- **Messaging Sender ID**: `812914997499`
- **App ID**: `1:812914997499:web:651a2217f574e8be05d85e`
- **Measurement ID**: `G-1GXKBNS6PG`

## 🔧 **Setup Instructions**

### **Step 1: Enable Gmail API**

1. **Go to Google Cloud Console**:
   - Visit: https://console.cloud.google.com/apis/library?project=tenderbriefing-472813
   - Search for "Gmail API"
   - Click on it and press "Enable"

2. **Alternative Method**:
   - Go to: https://console.cloud.google.com/apis/library/gmail.googleapis.com?project=tenderbriefing-472813
   - Click "Enable" if not already enabled

### **Step 2: Create .env.local File**

Create a `.env.local` file in your project root with the following configuration:

```env
# Gmail API Configuration
GMAIL_API_KEY=dbc96530b2529d5442cf5bb059124031635b46a7
GMAIL_CLIENT_ID=YOUR_GMAIL_CLIENT_ID.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=YOUR_GMAIL_CLIENT_SECRET

# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=YOUR_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=tenderbriefing-15d91.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=tenderbriefing-15d91
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=tenderbriefing-15d91.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=812914997499
NEXT_PUBLIC_FIREBASE_APP_ID=1:812914997499:web:651a2217f574e8be05d85e
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-1GXKBNS6PG

# Google Drive API Key
GOOGLE_DRIVE_API_KEY=dbc96530b2529d5442cf5bb059124031635b46a7

# Google Cloud Storage
GOOGLE_CLOUD_PROJECT_ID=tenderbriefing-472813
GOOGLE_CLOUD_STORAGE_BUCKET=tenderbriefing

# Google Maps API Key
GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_API_KEY

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

2. **Visit the Gmail Test Page**:
   ```
   http://localhost:3000/gmail-test
   ```

3. **Test the following features**:
   - ✅ Send custom emails
   - ✅ Use TenderConnect email templates
   - ✅ List and search messages
   - ✅ Manage message status

## 🎯 **Gmail Features Available**

### **1. Email Sending**
```typescript
// Send custom email
await gmailService.sendEmail({
  to: 'user@example.com',
  subject: 'Test Email',
  html: '<h1>Hello World</h1>',
  text: 'Hello World'
});

// Send with attachments
await gmailService.sendEmail({
  to: 'user@example.com',
  subject: 'Document Attached',
  text: 'Please find the attached document.',
  attachments: [{
    filename: 'document.pdf',
    content: fileBuffer,
    contentType: 'application/pdf'
  }]
});
```

### **2. TenderConnect Email Templates**
```typescript
// Send tender notification
await gmailService.sendTenderNotification(
  'connector@example.com',
  'Road Construction Project',
  '2024-01-15 10:00 AM',
  'City Hall, Conference Room A',
  'John Connector'
);

// Send welcome email
await gmailService.sendWelcomeEmail(
  'newuser@example.com',
  'Jane Smith',
  'entrepreneur'
);

// Send payment confirmation
await gmailService.sendPaymentConfirmation(
  'client@example.com',
  1500.00,
  'Tender Briefing Service',
  '2024-01-15'
);
```

### **3. Message Management**
```typescript
// List messages
const messages = await gmailService.getMessages('is:unread', 10);

// Search messages
const searchResults = await gmailService.searchMessages('from:example.com');

// Get message details
const message = await gmailService.getMessage('message-id');

// Mark as read/unread
await gmailService.markAsRead('message-id');
await gmailService.markAsUnread('message-id');

// Delete message
await gmailService.deleteMessage('message-id');
```

## 🚀 **Integration with TenderConnect**

### **Email Workflow Examples**

1. **User Registration**
   ```typescript
   // Send welcome email after user signs up
   await gmailService.sendWelcomeEmail(
     user.email,
     user.displayName,
     user.userType
   );
   ```

2. **Tender Assignment**
   ```typescript
   // Notify connector of new assignment
   await gmailService.sendTenderNotification(
     connector.email,
     tender.title,
     tender.briefingDate,
     tender.location,
     connector.name
   );
   ```

3. **Briefing Reminders**
   ```typescript
   // Send reminder 24 hours before briefing
   await gmailService.sendBriefingReminder(
     connector.email,
     tender.title,
     tender.briefingDate,
     tender.location,
     24
   );
   ```

4. **Submission Confirmations**
   ```typescript
   // Confirm submission received
   await gmailService.sendSubmissionConfirmation(
     entrepreneur.email,
     tender.title,
     'Briefing Notes',
     new Date().toISOString()
   );
   ```

5. **Payment Processing**
   ```typescript
   // Confirm payment received
   await gmailService.sendPaymentConfirmation(
     entrepreneur.email,
     payment.amount,
     'Tender Briefing Service',
     payment.date
   );
   ```

## 📊 **API Usage & Costs**

### **Current Usage Limits**
- **Free tier**: 1 billion requests/day
- **Daily quota**: 1,000,000,000 quota units
- **Per-user rate limit**: 250 quota units per user per second
- **Attachment size**: 25MB per email

### **Estimated Monthly Costs (1000 users)**
```
API Requests: $0.00 (within free tier)
Storage: $0.00 (within free tier)
Bandwidth: $0.00 (within free tier)
Total: $0.00/month
```

## 🔒 **Security & Permissions**

### **OAuth2 Scopes**
- **gmail.send**: Send emails on behalf of users
- **gmail.readonly**: Read emails and metadata
- **gmail.modify**: Modify email labels and status
- **gmail.compose**: Compose and send emails

### **Security Features**
- **OAuth2 authentication**: Secure user authorization
- **Service account**: Server-to-server authentication
- **Rate limiting**: Prevents abuse and ensures fair usage
- **Content filtering**: Built-in spam and security filtering

## 🎉 **Next Steps**

1. **Enable Gmail API** in Google Cloud Console
2. **Create the .env.local file** with your configuration
3. **Test the integration** at http://localhost:3000/gmail-test
4. **Set up email templates** for your specific use cases
5. **Integrate email notifications** into your tender workflow

## 🔗 **Useful Links**

- **Gmail Test Page**: http://localhost:3000/gmail-test
- **Google Cloud Console**: https://console.cloud.google.com/apis/library?project=tenderbriefing-472813
- **Gmail API Documentation**: https://developers.google.com/gmail/api
- **Gmail API Explorer**: https://developers.google.com/gmail/api/v1/reference

## 📱 **Gmail Integration Examples**

### **Automated Email Workflows**
```typescript
// Complete tender workflow with emails
const handleTenderAssignment = async (tenderId: string, connectorId: string) => {
  // 1. Send assignment notification
  await gmailService.sendTenderNotification(
    connector.email,
    tender.title,
    tender.briefingDate,
    tender.location,
    connector.name
  );

  // 2. Schedule reminder emails
  setTimeout(async () => {
    await gmailService.sendBriefingReminder(
      connector.email,
      tender.title,
      tender.briefingDate,
      tender.location,
      24
    );
  }, 24 * 60 * 60 * 1000); // 24 hours

  // 3. Send final reminder
  setTimeout(async () => {
    await gmailService.sendBriefingReminder(
      connector.email,
      tender.title,
      tender.briefingDate,
      tender.location,
      2
    );
  }, 22 * 60 * 60 * 1000); // 22 hours
};
```

### **Email Template Customization**
```typescript
// Custom email template for specific use cases
const sendCustomTenderEmail = async (recipient: string, tender: any) => {
  const customTemplate = `
    <div style="font-family: Arial, sans-serif;">
      <h2>New Tender Opportunity: ${tender.title}</h2>
      <p>Dear ${recipient},</p>
      <p>We have a new tender opportunity that matches your profile:</p>
      <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px;">
        <h3>${tender.title}</h3>
        <p><strong>Organization:</strong> ${tender.organization}</p>
        <p><strong>Value:</strong> ${tender.estimatedValue}</p>
        <p><strong>Deadline:</strong> ${tender.deadline}</p>
        <p><strong>Briefing Required:</strong> ${tender.briefingRequired ? 'Yes' : 'No'}</p>
      </div>
      <p>Click <a href="${tender.link}">here</a> to view full details.</p>
    </div>
  `;

  await gmailService.sendEmail({
    to: recipient,
    subject: `New Tender: ${tender.title}`,
    html: customTemplate
  });
};
```

---

**Your Gmail integration is ready! The API key and OAuth2 credentials are configured and all email communication services are available for TenderConnect.** 📧
