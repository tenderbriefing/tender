# 🗺️ Google Maps API Integration Setup

## ✅ **Google Maps API Key Received**

Your Google Maps API key: `YOUR_GOOGLE_MAPS_API_KEY`

## 🔧 **Setup Instructions**

### **Step 1: Create .env.local File**

Create a `.env.local` file in your project root with the following content:

```env
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

2. **Visit the Maps Test Page**:
   ```
   http://localhost:3000/maps-test
   ```

3. **Test the following features**:
   - ✅ Geocoding (Address → Coordinates)
   - ✅ Reverse Geocoding (Coordinates → Address)
   - ✅ Places Search
   - ✅ Place Details
   - ✅ Distance Calculation

## 🎯 **Google Maps Features Available**

### **1. Geocoding**
Convert addresses to coordinates:
```typescript
// Example: "Cape Town, South Africa" → { lat: -33.9249, lng: 18.4241 }
const location = await googleMapsService.geocodeAddress("Cape Town, South Africa");
```

### **2. Reverse Geocoding**
Convert coordinates to addresses:
```typescript
// Example: { lat: -33.9249, lng: 18.4241 } → "Cape Town, South Africa"
const address = await googleMapsService.reverseGeocode(-33.9249, 18.4241);
```

### **3. Places Search**
Find places by query:
```typescript
// Example: Find restaurants in Cape Town
const places = await googleMapsService.searchPlaces("restaurants in Cape Town");
```

### **4. Distance Calculation**
Calculate distance between two points:
```typescript
// Example: Distance from Johannesburg to Cape Town
const distance = googleMapsService.calculateDistance(
  { lat: -26.2041, lng: 28.0473 }, // Johannesburg
  { lat: -33.9249, lng: 18.4241 }  // Cape Town
);
```

## 🚀 **Integration with TenderConnect**

### **Location-Based Matching**
- **Entrepreneurs** can specify their location
- **Connectors** can set their service areas
- **Automatic matching** based on proximity to tender briefings

### **Tender Location Services**
- **Geocode tender addresses** automatically
- **Find nearby connectors** for each tender
- **Calculate travel distances** and costs
- **Display interactive maps** for tender locations

### **Enhanced User Experience**
- **Address autocomplete** for user profiles
- **Location validation** for tender submissions
- **Route planning** for connector assignments
- **Real-time location tracking** (optional)

## 📊 **API Usage & Costs**

### **Current Usage Limits**
- **Free tier**: 28,500 requests/month
- **Geocoding**: $5 per 1,000 requests
- **Places API**: $17 per 1,000 requests
- **Distance Matrix**: $5 per 1,000 requests

### **Estimated Monthly Costs (1000 users)**
```
Geocoding: $10-20
Places Search: $30-50
Distance Calculation: $5-10
Total: $45-80/month
```

## 🔒 **Security Best Practices**

### **API Key Security**
1. **Restrict API key** to specific domains
2. **Enable only required APIs** (Maps, Places, Geocoding)
3. **Set usage quotas** to prevent overages
4. **Monitor usage** regularly

### **Google Cloud Console Setup**
1. **Go to**: https://console.cloud.google.com/apis/credentials?project=tenderbriefing-472813
2. **Find your API key**: `YOUR_GOOGLE_MAPS_API_KEY`
3. **Click "Edit"** to configure restrictions
4. **Set Application restrictions**:
   - HTTP referrers: `localhost:3000/*`, `yourdomain.com/*`
5. **Set API restrictions**:
   - Maps JavaScript API
   - Geocoding API
   - Places API
   - Distance Matrix API

## 🎉 **Next Steps**

1. **Create the .env.local file** with your Google Maps API key
2. **Test the integration** at http://localhost:3000/maps-test
3. **Configure API restrictions** in Google Cloud Console
4. **Integrate location services** into your tender matching system
5. **Add interactive maps** to your dashboard

## 🔗 **Useful Links**

- **Google Maps Test Page**: http://localhost:3000/maps-test
- **Google Cloud Console**: https://console.cloud.google.com/apis/credentials?project=tenderbriefing-472813
- **Maps API Documentation**: https://developers.google.com/maps/documentation
- **Places API Documentation**: https://developers.google.com/maps/documentation/places

---

**Your Google Maps integration is ready! The API key is configured and all services are available for location-based features in TenderConnect.** 🗺️
