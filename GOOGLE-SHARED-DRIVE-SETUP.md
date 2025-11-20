# Google Shared Drive Setup for File Uploads

## The Problem
Service Accounts don't have storage quota, so they can't upload to "My Drive". The solution is to use a **Shared Drive** (formerly Team Drives).

## ⚠️ IMPORTANT: Shared Drives Require Google Workspace

**Shared Drives are ONLY available with Google Workspace accounts** (formerly G Suite). They are NOT available for personal Gmail accounts.

### Do You Have Google Workspace?
- ✅ **Yes**: Follow "Option A: Shared Drive Setup" below
- ❌ **No (Personal Gmail)**: Follow "Option B: OAuth Delegation" below

---

## Option A: Shared Drive Setup (Google Workspace Only)

### 1. Create a Shared Drive
1. Go to https://drive.google.com
2. Click **"Shared drives"** in the left sidebar (if you don't see this, you don't have Google Workspace)
3. Click **"+ New"** button
4. Name it: **"Crew Chat"** (exact name - code searches for this)
5. Click **"Create"**

### 2. Add Service Account as Member
1. Open the "Crew Chat" Shared Drive you just created
2. Click the **"Manage members"** icon (people icon at top)
3. Click **"Add members"**
4. Paste your service account email:
   ```
   crew-chat@my-crew-app-v1-3.iam.gserviceaccount.com
   ```
5. Set permission level: **"Content manager"** or **"Manager"**
6. Uncheck "Notify people" (service account doesn't need email)
7. Click **"Send"**

### 3. Get Shared Drive ID (Optional but Recommended)
The code auto-finds the drive by name, but you can also hardcode the ID:

1. Open the "Crew Chat" Shared Drive
2. Copy the URL - it looks like:
   ```
   https://drive.google.com/drive/folders/DRIVE_ID_HERE
   ```
3. The part after `/folders/` is your Shared Drive ID
4. Add to environment variable (DigitalOcean App Platform):
   ```
   GOOGLE_SHARED_DRIVE_ID=your_drive_id_here
   ```

### 4. Verify Setup
Once the Shared Drive is created and the service account is added, file uploads will automatically work! The code will:

1. Find the "Crew Chat" Shared Drive
2. Create workspace/channel folder structure inside it
3. Upload files with proper permissions
4. Generate direct URLs for inline image display

## Code Updates (Optional Enhancement)
I can add support for the `GOOGLE_SHARED_DRIVE_ID` environment variable to skip the search step.

## Testing (Option A - Shared Drive)
After setup, try uploading an image in the chat. It should:
- ✅ Upload successfully (no more quota errors)
- ✅ Display inline in React app
- ✅ Display inline in Flutter app
- ✅ Be stored in: Crew Chat/WorkspaceName/ChannelName/

---

## Option B: OAuth Delegation (Personal Gmail Accounts)

If you DON'T have Google Workspace, you need to use **OAuth delegation** instead of Service Accounts.

### What This Means:
Instead of uploading as a service account, files will be uploaded to YOUR personal Google Drive when users upload files.

### Setup Steps:

1. **Enable Google Drive API for OAuth**
   - Go to: https://console.cloud.google.com/apis/credentials
   - Select your project: `my-crew-app-v1-3`
   - Click "Create Credentials" → "OAuth client ID"
   - Application type: "Web application"
   - Name: "Crew Chat File Upload"
   - Authorized redirect URIs:
     ```
     http://localhost:8080/api/auth/google/drive/callback
     https://coral-app-rgki8.ondigitalocean.app/api/auth/google/drive/callback
     ```
   - Click "Create"
   - Download the JSON credentials

2. **Add OAuth Credentials to Environment**
   - Add these to your `.env` file and DigitalOcean environment:
   ```
   GOOGLE_DRIVE_OAUTH_CLIENT_ID=your_client_id
   GOOGLE_DRIVE_OAUTH_CLIENT_SECRET=your_client_secret
   GOOGLE_DRIVE_OAUTH_REDIRECT_URI=http://localhost:8080/api/auth/google/drive/callback
   ```

3. **Alternative: Use DigitalOcean Spaces Instead**
   - You already have DigitalOcean Spaces configured
   - This is faster, simpler, and works with any Google account
   - No quotas, no permissions issues
   - Want me to switch to Spaces? (It's a 5-minute change)

### Recommendation for Personal Gmail Users:
**Use DigitalOcean Spaces** - it's much simpler than OAuth delegation and already configured!

Let me know if you want me to:
1. Switch to DigitalOcean Spaces (recommended for personal accounts)
2. Implement OAuth delegation for Google Drive
3. Wait while you upgrade to Google Workspace
