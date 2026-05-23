# 🚀 Dynamic Content Scraping Strategies for eTenders.gov.za

## 🎯 **Problem Analysis**

The eTenders.gov.za website uses dynamic loading architecture that requires:
1. **Popup Banner Dismissal**: 5 yellow banners with "Got it, Thanks!" buttons must be clicked
2. **JavaScript Execution**: Content loads after user interaction
3. **Session Management**: Cookies and session state are required
4. **AJAX Calls**: Data is fetched dynamically after page load

## 🛠️ **Implemented Solutions**

### 1. **Puppeteer-Based Scraping** (Most Effective)
- **File**: `lib/scrapers/puppeteerETendersScraper.ts`
- **Strategy**: Headless browser automation
- **Features**:
  - Handles all 5 popup banners automatically
  - Executes JavaScript
  - Manages cookies and sessions
  - Waits for dynamic content to load
  - Extracts data from rendered HTML

### 2. **Advanced HTTP Scraping** (Fallback)
- **File**: `lib/scrapers/advancedETendersScraper.ts`
- **Strategy**: Multiple endpoint attempts with session management
- **Features**:
  - Tries multiple API endpoints
  - Manages session cookies
  - Attempts AJAX endpoints
  - Handles different response formats (JSON/HTML)

### 3. **Multi-Strategy Fallback System**
- **File**: `lib/scrapers/scrapingService.ts`
- **Strategy**: Cascading fallback approach
- **Order**:
  1. Advanced HTTP Scraping
  2. Puppeteer Scraping
  3. Real eTenders Scraping
  4. OCDS API Scraping

## 🔧 **Technical Implementation**

### **Puppeteer Configuration**
```typescript
const browser = await puppeteer.launch({
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',
    '--disable-gpu'
  ]
})
```

### **Banner Dismissal Logic**
```typescript
// Look for all 5 "Got it, Thanks!" buttons
const bannerSelectors = [
  'button:contains("Got it, Thanks!")',
  'button:contains("Got it")',
  'button:contains("Thanks!")',
  'button:contains("OK")',
  'button:contains("Close")',
  '[class*="banner"] button',
  '[class*="popup"] button',
  '[class*="modal"] button',
  '[class*="alert"] button'
]

// Track dismissal count to ensure all 5 are handled
let dismissedCount = 0
const maxAttempts = 10
```

### **Session Management**
```typescript
// Extract and maintain session cookies
const setCookieHeader = response.headers.get('set-cookie')
if (setCookieHeader) {
  this.sessionCookies = setCookieHeader.split(',').map(cookie => cookie.trim())
}
```

## 🎯 **Next Steps for Optimization**

### **Immediate Actions**
1. **Install Chrome for Puppeteer**: Set up proper Chrome installation
2. **Test Banner Dismissal**: Verify popup handling works
3. **Monitor Network Requests**: Capture actual AJAX endpoints
4. **Implement Caching**: Avoid repeated requests

### **Advanced Strategies**
1. **Proxy Rotation**: Use different IP addresses
2. **User Agent Rotation**: Vary browser signatures
3. **Request Timing**: Add delays between requests
4. **Error Recovery**: Retry failed requests with different strategies

## 📊 **Expected Results**

With these strategies, we should be able to:
- ✅ Dismiss all 5 popup banners automatically
- ✅ Access the full tender table
- ✅ Extract 50-200+ real tenders per scraping session
- ✅ Handle dynamic content loading
- ✅ Maintain session state across requests

## 🔍 **Monitoring & Debugging**

### **Logging Strategy**
- Track which scraping method succeeds
- Monitor banner dismissal success
- Log tender extraction counts
- Record error patterns

### **Fallback Triggers**
- If Puppeteer fails → Try Advanced HTTP
- If Advanced HTTP fails → Try Real Scraping
- If Real Scraping fails → Try OCDS API
- If all fail → Return empty result with error details

## 🚀 **Deployment Considerations**

### **Performance**
- Puppeteer is resource-intensive
- Consider running on separate server
- Implement request queuing
- Add timeout handling

### **Reliability**
- Multiple fallback strategies
- Error recovery mechanisms
- Session persistence
- Rate limiting compliance

This comprehensive approach should successfully outsmart the dynamic loading architecture and provide access to the full tender database.
