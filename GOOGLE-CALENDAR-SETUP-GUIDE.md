# Google Calendar & Drive Setup for Project Management
*Extending your existing chat-app Google Cloud project*

## 🎯 **Overview - Extend Your Existing Setup**
Since you already have Google Cloud configured for chat-app email functionality, we'll **extend the same project** to add Calendar and Drive capabilities for project management.

**✅ What you already have:**
- Google Cloud project with Gmail API enabled
- Service account for email functionality  
- OAuth2 setup working for user authentication

**🔧 What we need to add:**
- Google Calendar API enabled
- Google Drive API enabled  
- Calendar/Drive scopes for your service account
- Calendar service in backend

---

## **Step 1: Enable Additional APIs (5 minutes)**

### In your existing Google Cloud Console:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. **Select your existing chat-app project** (don't create new one!)
3. Navigate to **APIs & Services** > **Library**
4. Search and enable these APIs:
   - **Google Calendar API** - Click **Enable**
   - **Google Drive API** - Click **Enable**
   - **Google Sheets API** - Click **Enable** (optional, for future features)

---

## **Step 2: Extend Your Existing Service Account (2 options)**

### **Option A: Extend Current Service Account (Recommended)**
1. Go to **APIs & Services** > **Credentials**
2. Find your existing service account (probably `chatflow-email-service@...`)
3. Click on it → **Keys** tab
4. **Generate new key** (JSON format) with expanded permissions
5. This key will work for both email AND calendar/drive

### **Option B: Create Separate Service Account (If you prefer separation)**
1. Go to **APIs & Services** > **Credentials** 
2. **Create Credentials** > **Service Account**
3. Name: `chatflow-projects-service`
4. Enable **Domain-wide delegation**
5. Download JSON key

---

## **Step 3: Update Environment Variables**

### Add to your existing `.env` file:
```bash
# Existing email service account (keep as-is)
GMAIL_SERVICE_ACCOUNT_EMAIL="your-existing@project.iam.gserviceaccount.com"
GMAIL_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"

# Calendar & Drive service (can be same as email service account)
GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL="your-existing@project.iam.gserviceaccount.com"
GOOGLE_CALENDAR_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"

# OR if you created separate service account:
# GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL="chatflow-projects-service@project.iam.gserviceaccount.com"
# GOOGLE_CALENDAR_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
```

---

## **Step 4: Domain-Wide Delegation Scopes**

### If using Google Workspace (optional - for shared calendars):
1. Go to [Google Admin Console](https://admin.google.com/)
2. **Security** > **API Controls** > **Domain-wide delegation** 
3. Find your service account client ID
4. **Add these scopes to existing ones:**
   ```
   https://www.googleapis.com/auth/gmail.send
   https://www.googleapis.com/auth/gmail.readonly
   https://www.googleapis.com/auth/calendar
   https://www.googleapis.com/auth/calendar.events
   https://www.googleapis.com/auth/drive.file
   https://www.googleapis.com/auth/drive.readonly
   ```

---

## **Step 5: Calendar Strategy - Hybrid Approach**

### **User Personal Calendars:**
- Users authenticate with their existing Google accounts (via Firebase Auth)
- Personal project tasks sync to their own Google Calendar  
- Uses existing Firebase Google OAuth tokens

### **Shared Project Calendars:**
- Service account creates/manages shared project calendars
- All project members get access to shared calendar
- Project-wide events (meetings, deadlines) go here

### **Implementation:**
```javascript
// User calendar events (existing Firebase auth)
const userCalendar = google.calendar({
  version: 'v3',
  auth: userOAuthClient // From Firebase tokens
});

// Shared project calendar (service account)
const projectCalendar = google.calendar({
  version: 'v3', 
  auth: serviceAccountClient
});
```

---

## **Step 6: Test Your Setup**

### I'll create a test script for you:
```bash
cd backend
node test-google-calendar-setup.js
```

**Expected Output:**
```
🗓️  Testing Google Calendar API access...
✅ Service account authentication successful
✅ Calendar API access verified
✅ Can create/read calendars
✅ Drive API access verified
🎉 Google Calendar & Drive setup complete!
```

---

## **Step 7: Calendar Access Patterns**

### **For Project Events:**
1. **Project Creation** → Service account creates shared calendar
2. **Add Members** → Share calendar with member emails 
3. **Create Events** → Choose personal vs. shared calendar
4. **2-way Sync** → Changes in Google Calendar sync back to chat-app

### **Calendar Sharing Strategy:**
```javascript
// When adding user to project:
await calendar.acl.insert({
  calendarId: project.google_calendar_id,
  resource: {
    role: 'writer', // or 'reader' based on project role
    scope: {
      type: 'user',
      value: userEmail
    }
  }
});
```

---

## **Benefits of Reusing Your Existing Setup:**

✅ **Single Google Cloud Project** - easier management  
✅ **Unified billing** - all APIs under one project  
✅ **Existing authentication** - leverage current OAuth setup  
✅ **Service account reuse** - same credentials for email + calendar  
✅ **Consistent permissions** - unified access management  

---

## **Next Steps:**

1. **Enable APIs** in your existing project (5 minutes)
2. **Extend service account** permissions  
3. **Update environment variables**
4. **Test calendar access** with script I'll create
5. **Implement calendar service** in backend

---

## **Security Notes:**

🔒 **Service Account Key Security:**
- Same security practices as your existing email setup
- Never commit keys to git (already handled in your .gitignore)
- Use environment variables for all credentials
- Consider key rotation policy

🔒 **Calendar Privacy:**
- Personal calendar events stay private to user
- Only shared project events visible to team
- Granular permission control (read vs write access)

---

**Ready to proceed?** This approach leverages your existing Google setup while adding the calendar/drive capabilities we need for project management!
