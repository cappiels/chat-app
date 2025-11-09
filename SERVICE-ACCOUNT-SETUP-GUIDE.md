# Gmail Service Account Setup Guide for crew

## Overview
For enterprise-grade email functionality, ChatFlow uses Google Service Accounts which provide:
- **No daily sending limits** (unlike regular Gmail accounts)
- **Enterprise-grade authentication** 
- **Better security** (no user password required)
- **Programmatic access** without user interaction
- **Domain-wide delegation** capabilities

## Current Status
❌ **Current Issue**: `GMAIL_SERVICE_ACCOUNT_EMAIL=cappiels@gmail.com` (regular Gmail account)
✅ **Fallback Working**: OAuth2 with regular Gmail account (limited functionality)

## Step-by-Step Service Account Setup

### Step 1: Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Name it something like "ChatFlow Email Service"

### Step 2: Enable Gmail API
1. Navigate to **APIs & Services** > **Library**
2. Search for "Gmail API"
3. Click **Enable**

### Step 3: Create Service Account
1. Go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **Service Account**
3. Fill out the form:
   - **Service account name**: `chatflow-email-service`
   - **Service account ID**: `chatflow-email-service` (auto-generated)
   - **Description**: `Service account for ChatFlow email functionality`
4. Click **Create and Continue**
5. Skip role assignment for now
6. Click **Done**

### Step 4: Generate Private Key
1. Find your newly created service account
2. Click on the service account email
3. Go to **Keys** tab
4. Click **Add Key** > **Create New Key**
5. Select **JSON** format
6. Click **Create**
7. **IMPORTANT**: Save this JSON file securely - it contains your private key!

### Step 5: Enable Domain-Wide Delegation (Required for Gmail)
1. Still in the service account details
2. Check **Enable Google Workspace Domain-wide Delegation**
3. Add **Product name**: `ChatFlow Email Service`
4. Click **Save**

### Step 6: Configure Domain-Wide Delegation in Google Workspace (If applicable)
**Note**: This step is only needed if you want to send emails from a custom domain. For Gmail.com addresses, skip this step.

1. Go to [Google Admin Console](https://admin.google.com/) (requires Google Workspace admin)
2. Navigate to **Security** > **API Controls**
3. Click **Domain-wide delegation**
4. Click **Add new**
5. Enter your service account's **Client ID** (from the JSON file)
6. Add these **OAuth Scopes**:
   ```
   https://www.googleapis.com/auth/gmail.send
   https://www.googleapis.com/auth/gmail.readonly
   ```
7. Click **Authorize**

### Step 7: Update Environment Variables
Extract values from your downloaded JSON file and update `.env`:

```bash
# Service Account Configuration (from JSON file)
GMAIL_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----"
GMAIL_SERVICE_ACCOUNT_EMAIL="chatflow-email-service@your-project-id.iam.gserviceaccount.com"

# Keep existing OAuth2 as fallback (optional)
GMAIL_OAUTH_CLIENT_ID="existing_client_id"
GMAIL_OAUTH_CLIENT_SECRET="existing_client_secret" 
GMAIL_REFRESH_TOKEN="existing_refresh_token"
```

## Alternative: Quick OAuth2 Setup (Current Working Solution)
If you prefer to stick with the current working OAuth2 setup:

### Advantages:
- ✅ Already working
- ✅ Easier to set up
- ✅ Good for development/small scale

### Limitations:
- ❌ Daily sending limits (100 emails/day for regular Gmail)
- ❌ Requires user interaction for initial setup
- ❌ Less secure (uses refresh tokens)

## Testing Your Setup

### Test Service Account:
```bash
cd backend
node test-email-service.js
```

**Expected Output with Service Account**:
```
🏢 EMAIL SERVICE - Enterprise Service Account Initialization
✅ GMAIL_PRIVATE_KEY: -----BEGIN PRIVATE KEY-----...
✅ GMAIL_SERVICE_ACCOUNT_EMAIL: chatflow-email-service@project.iam.gserviceaccount.com
🔧 Setting up Gmail Service Account authentication...
🧪 Testing service account credentials...
✅ Service account authorization successful!
✅ Gmail API access successful! Email: chatflow-email-service@project.iam.gserviceaccount.com
🏢 Enterprise email service initialized successfully with Gmail Service Account
```

### Test Email Sending:
```bash
cd backend
node test-workspace-invitation.js
```

## Recommended Next Steps

### Option A: Full Enterprise Setup (Recommended for Production)
1. Follow the complete service account setup above
2. Update environment variables
3. Test the service account functionality
4. Deploy with enterprise-grade email capabilities

### Option B: Improve Current OAuth2 Setup (Quick Fix)
1. Keep current working OAuth2 configuration
2. Consider upgrading to Google Workspace for higher sending limits
3. Monitor daily email usage

## Security Best Practices

1. **Never commit service account keys to Git**
2. **Use environment variables** for all sensitive data
3. **Rotate keys periodically** (every 90 days recommended)
4. **Limit service account permissions** to only what's needed
5. **Monitor usage** through Google Cloud Console

## Troubleshooting Common Issues

### "No key or keyFile set" Error
- Check that `GMAIL_PRIVATE_KEY` is properly formatted with `\n` for newlines
- Ensure private key includes `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`

### "Invalid service account credentials" Error
- Verify the service account email format: `name@project-id.iam.gserviceaccount.com`
- Check that Gmail API is enabled for your project
- Ensure domain-wide delegation is enabled

### "Access denied" Errors
- Verify OAuth scopes in domain-wide delegation
- Check that the service account has proper permissions
- Ensure Gmail API is enabled

## Production Deployment Notes

For production deployment on DigitalOcean:
1. Add service account environment variables to your app platform
2. Use secrets management for sensitive keys
3. Monitor email sending quotas and usage
4. Set up proper error handling and retry logic

---

**Need Help?** 
- Check the [Google Cloud Service Account Documentation](https://cloud.google.com/iam/docs/creating-managing-service-accounts)
- Review [Gmail API Authentication Guide](https://developers.google.com/gmail/api/auth/web-server)
