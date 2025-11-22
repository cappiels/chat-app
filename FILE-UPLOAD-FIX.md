# File Upload Fix - DigitalOcean Spaces Configuration

## Issue
File uploads fail with 500 error: "Failed to upload files to Google Drive"

## Root Cause
DigitalOcean Spaces environment variables are not configured in production, causing the backend to fall back to Google Drive (which also fails).

## Solution: Add Environment Variables to Production

### Step 1: Access DigitalOcean App Platform
1. Log into DigitalOcean Dashboard
2. Navigate to **Apps** → Your chat app
3. Go to **Settings** → **Environment Variables**

### Step 2: Add These Environment Variables
Add the following variables (click "+ Add Variable" for each):

```
SPACES_ENDPOINT=nyc3.digitaloceanspaces.com
SPACES_BUCKET=chitchat
SPACES_KEY=DO00ZGG2NZ44RHBERGMX
SPACES_SECRET=rpZ7jTv00Ul8cfnLLa7CdUvcuGg9w3d0M6U4nGxj3nU
SPACES_REGION=nyc3
```

**Important**: 
- Set each as `ENVIRONMENT_VARIABLE` (not build-time)
- Click "Save" after adding all variables
- The app will automatically restart

### Step 3: Verify Spaces Setup
Your Space "chitchat" should already exist with:
- ✅ Region: NYC3
- ✅ CDN Enabled
- ✅ Public Access (for file sharing)
- ✅ CORS configured for file uploads

### Step 4: Deploy Code Fixes
The code fixes include:
1. ✅ Better error messages (no more "Google Drive" confusion)
2. ✅ Specific error handling for storage configuration
3. ✅ Storage availability checks

Run deployment:
```bash
./deploy-prod.sh patch "Fix file upload - add Spaces env vars and better error handling"
```

### Step 5: Test Upload
After deployment and environment variables are added:
1. Go to https://crewchat.elbarriobk.com
2. Open a channel
3. Click + button to upload a file
4. Select an image or document
5. Upload should succeed with Spaces

## Expected Behavior After Fix

### Before (Current):
```
❌ POST /api/upload/files → 500 Internal Server Error
   "Failed to upload files to Google Drive"
```

### After (Fixed):
```
✅ POST /api/upload/files → 200 OK
   Files uploaded to DigitalOcean Spaces
   {
     "files": [{
       "url": "https://chitchat.nyc3.digitaloceanspaces.com/...",
       "source": "digitalocean_spaces"
     }]
   }
```

## Verification Checklist
- [ ] Environment variables added to DigitalOcean App Platform
- [ ] App restarted (automatic after adding env vars)
- [ ] Code deployed with `./deploy-prod.sh`
- [ ] Test file upload in production
- [ ] Verify files appear in Spaces bucket
- [ ] Verify files display correctly in chat

## Timeline
- **Code Changes**: Ready to deploy (5 minutes)
- **Environment Variables**: Add to DigitalOcean (2 minutes)
- **App Restart**: Automatic (2-3 minutes)
- **Total Time**: ~10 minutes

## Troubleshooting

### Upload Still Fails After Adding Variables
Check backend logs in DigitalOcean:
```bash
# Look for this message:
"✅ DigitalOcean Spaces initialized successfully"

# If you see this instead:
"⚠️ DigitalOcean Spaces not configured (missing: ...)"
# Then environment variables weren't added correctly
```

### CORS Errors
If you see CORS errors in browser console:
1. Go to DigitalOcean Spaces → chitchat → Settings → CORS
2. Verify CORS rules allow `*` origin and POST method

### Files Upload But Don't Display
1. Verify Space is set to Public
2. Check CDN is enabled
3. Verify file URL format is correct

## Support
If issues persist after following this guide, check:
- DigitalOcean App Platform Runtime Logs
- Browser Console for detailed errors
- Network tab for actual HTTP responses
