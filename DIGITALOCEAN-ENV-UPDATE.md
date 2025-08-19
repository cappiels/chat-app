# DigitalOcean Environment Variables Update

## Variables to UPDATE in DigitalOcean App Platform

Go to your DigitalOcean App Platform → Settings → Environment Variables and update these:

### 1. GMAIL_PRIVATE_KEY
**Old value:** Your old private key
**New value:** 
```
-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQC3UzN5MyPTvMdL
hk/iswG9vzVOiXg4KssXtQ+miZHig37pkHE0o+TW/DY3sygNJKVj60M0EK9C+z2r
A8U7cAGzPIwM3BhQDr5MZSHMRq8L+UN3JL0jbA7kOIVU/XwQ1j0tNoiJl0FgBoBi
flxjpxq7NQKu/heUa5dJXpWv2LkhKU7wgFEeSDB8VzjKfFSCAWQD2ie2vXvbqfIn
xjWSF/Jw2RxKDzkwmF1bf9VSo2ZYTJOmmlVA7HmiuJ2K5OXz76pv8OG0ODxXlnAp
Gp3tE74Zr6A6ERmv/i3+Xhq1qEIdroRomblaHVOsopQkDiBRmMAZ2yWWutdhtD0X
ZZl2mqWJAgMBAAECggEAQ9DT7ERWPwgJA2/Ckn6cqMgYXJ6u6bwu1+zDRtyCKnRx
WM51ij8Mstim59DvAnmpcv5/JD39z33oUKB68CNdhaPivQkYN1lU3SbWK16Ed530
bpkZHIbnNVaRQCDrKcFO7TBMrvVUmkSdbpIG9FhHI7SW8wwMxftNAjeqkNvPlCu0
/W0nZ8NbNraYxm4GY97AWT9UEPN7iCegJDSY/gc4zE+m/aCqiDeFHgmAbFaUN8gl
vAAPNS68lKNd1WR1CR/koF/Zf4MsIMCPxQQRqCqqTBBHKN8uM7Z5g3mWtCuXqUZ5
RTcx8IPgBOtGjLT7+Vwrb77u5FAaktFCQXuRTWX7zwKBgQD9xa56dxmujiaHe3u7
CkyFKb/Dv4ioOjYs8TVt8B858Ewsl2nDW5lG8a7hqnu9YdfHk9y0Ygcd8qgnPH4o
P9vQVtnAL2bdmrAwcIUv7xpOqEdLZEZ03XPcHHZhVrnwWYHnmMCN6mZr0gRUSnmQ
TYZFnV2Xo2AGVEMOtCQOu/CLMwKBgQC47zL0zoIEkSLm6JO2JKNzRCUzPFmCu48b
GdNEDI6lkudNNciTBmt2Ns6hDSQXHa5YsAmmSQEEHRTa7joyR6Bq82oJAER9FN0T
5e2ULEDdm7FAzrElplt8ZqMszg0QtISxw+qaEP39+Rxo5R8cvTizaeLMPnRFhQqH
/kxXX4xsUwKBgE57UFZ3du3Q8IF94uoZaUjVfIThOzYrqo2Dm26AkGeutSAlQ4Qz
U9fo7pjDzLjpBX6nb94pYuIUJYTc5Hc2KJjqAzW4cyudp1eTtNz6KTyiNkpOnKuP
wUEVXFcGJ0L5q38gcoxxLXOy47vdvHKwRxJIdKVs1UmfzY1CkNQts1qZAoGARMEB
M8x2wBXpYOmEyQnUDq1+Gw9Lw/PRH2U5iyoT+nCkN6tQN4ECgL+dkHifO0zYnbZM
0BqCGzJop4A7+Kdyd3CpslD8JXiVPKmV6ymMsBcLDioJ6BJyHszVy3mLl/NVBfXt
iXvZwgtUSZctOvUKWIF8RSzO822j3a1oWm92eGsCgYAo6Bq2MecCW0mtHnd+2Dxt
WDYTtRWgyItLIB8t01k5Z7wALHdlKzW87aqklf3iKQHeu6fEGwCeLm3rju/NkNyC
1Z0kyMMxtzY4ISNThXIDQSJEjH9/mJbuCmx48Bmi/9sAHx6PSnOSH3HMb84tlPVn
CPFmlqFFECx43fbEqE8Qgg==
-----END PRIVATE KEY-----
```

### 2. GMAIL_SERVICE_ACCOUNT_EMAIL
**Old value:** `cappiels@gmail.com`
**New value:** `gmail-service@chat-app-9dbff.iam.gserviceaccount.com`

## Variables to KEEP (DO NOT CHANGE)

These OAuth2 variables should stay exactly the same:
- ✅ GMAIL_OAUTH_CLIENT_ID 
- ✅ GMAIL_OAUTH_CLIENT_SECRET
- ✅ GMAIL_REFRESH_TOKEN

## Step-by-Step Instructions:

1. **Go to DigitalOcean App Platform**
   - Navigate to your chat-app
   - Click on **Settings** tab
   - Click on **Environment Variables**

2. **Update GMAIL_PRIVATE_KEY**
   - Find `GMAIL_PRIVATE_KEY` in the list
   - Click **Edit**
   - Replace the entire value with the new private key above
   - **IMPORTANT:** Make sure to include `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`

3. **Update GMAIL_SERVICE_ACCOUNT_EMAIL**  
   - Find `GMAIL_SERVICE_ACCOUNT_EMAIL` in the list
   - Click **Edit**
   - Change value to: `gmail-service@chat-app-9dbff.iam.gserviceaccount.com`

4. **Save and Deploy**
   - Click **Save** 
   - This will trigger a new deployment automatically
   - Wait for deployment to complete (usually 2-3 minutes)

## After Deployment:

Your production app will now have working email invitations! The system will:
1. Try the new service account first
2. Fall back to OAuth2 (which works perfectly)
3. Send emails successfully via Gmail API

## Variables Summary:

**Updated (2 variables):**
- GMAIL_PRIVATE_KEY → New service account private key
- GMAIL_SERVICE_ACCOUNT_EMAIL → gmail-service@chat-app-9dbff.iam.gserviceaccount.com

**Unchanged (3 variables):**  
- GMAIL_OAUTH_CLIENT_ID → Keep existing
- GMAIL_OAUTH_CLIENT_SECRET → Keep existing
- GMAIL_REFRESH_TOKEN → Keep existing
