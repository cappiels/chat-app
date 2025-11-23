# TestFlight Debugging Guide

## Overview
This guide documents the debugging process for TestFlight connectivity issues and provides a systematic approach to troubleshooting production builds.

## Critical Issue Resolved (Nov 23, 2025)

### **Problem**
- TestFlight app v1.1.0+2 failed to load workspaces
- No API calls reaching DigitalOcean backend
- No runtime logs in DigitalOcean (indicating requests never reached server)

### **Root Cause**
Missing `/api` prefix in Flutter workspace service endpoint paths:
- **Incorrect**: `https://coral-app-rgki8.ondigitalocean.app/workspaces` ❌
- **Correct**: `https://coral-app-rgki8.ondigitalocean.app/api/workspaces` ✅

### **Solution**
Fixed all 7 endpoints in `mobile/lib/data/services/workspace_service.dart`:
1. `GET /workspaces` → `GET /api/workspaces`
2. `GET /workspaces/:id` → `GET /api/workspaces/:id`
3. `POST /workspaces` → `POST /api/workspaces`
4. `POST /workspaces/:id/invite` → `POST /api/workspaces/:id/invite`
5. `GET /workspaces/:id/members` → `GET /api/workspaces/:id/members`
6. `DELETE /workspaces/:id/members/:userId` → `GET /api/workspaces/:id/members/:userId`
7. `DELETE /workspaces/:id` → `DELETE /api/workspaces/:id`

**Fixed version**: v1.8.77 (build 1877)

---

## Systematic Debugging Process

### **Step 1: Verify Backend Availability**
```bash
# Test version endpoint (no auth required)
curl -v https://coral-app-rgki8.ondigitalocean.app/api/version

# Test workspaces endpoint (401 = backend working, auth required)
curl -v https://coral-app-rgki8.ondigitalocean.app/api/workspaces
```

**Expected responses:**
- Version: `200 OK` with JSON
- Workspaces: `401 Unauthorized` (proves endpoint exists)

### **Step 2: Check API Configuration**
Review `mobile/lib/core/config/api_config.dart`:
```dart
static const String baseUrl = _productionUrl;
static const String _productionUrl = 'https://coral-app-rgki8.ondigitalocean.app';
```

### **Step 3: Review Service Implementations**
Check all service files for correct API paths:
```bash
# Search for endpoints missing /api prefix
grep -r "httpClient\.(get|post|put|delete)" mobile/lib/data/services/ | grep -v "/api/"
```

**Files to check:**
- ✅ `mobile/lib/data/services/workspace_service.dart`
- ✅ `mobile/lib/data/services/subscription_service.dart` (uses ApiConfig constants)
- ✅ `mobile/lib/data/services/task_service.dart` (correct)
- ✅ Other services (as needed)

### **Step 4: Verify iOS Network Permissions**
Check `mobile/ios/Runner/Info.plist`:
```xml
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSExceptionDomains</key>
    <dict>
        <key>coral-app-rgki8.ondigitalocean.app</key>
        <dict>
            <key>NSIncludesSubdomains</key>
            <true/>
            <key>NSExceptionAllowsInsecureHTTPLoads</key>
            <false/>
            <key>NSExceptionRequiresForwardSecrecy</key>
            <true/>
            <key>NSExceptionMinimumTLSVersion</key>
            <string>TLSv1.2</string>
        </dict>
    </dict>
</dict>
```

### **Step 5: Check HTTP Client Configuration**
Review `mobile/lib/data/services/http_client.dart`:
- ✅ Firebase token authentication
- ✅ Request/response interceptors
- ✅ Comprehensive error handling
- ✅ Debug logging enabled

### **Step 6: Monitor Logs**
Enable API logging in `api_config.dart`:
```dart
static const bool enableApiLogging = true;
static const bool enableSocketLogging = true;
```

Look for these log patterns:
- `🔑 Firebase token obtained for GET /api/workspaces`
- `🚀 GET https://coral-app-rgki8.ondigitalocean.app/api/workspaces`
- `✅ 200 https://coral-app-rgki8.ondigitalocean.app/api/workspaces`
- `❌ 401 https://coral-app-rgki8.ondigitalocean.app/api/workspaces`

---

## Common Issues & Solutions

### **Issue: 401 Unauthorized**
**Cause**: Firebase authentication not working
**Solution**: 
1. Verify user is signed in
2. Check Firebase token generation
3. Confirm `Authorization: Bearer <token>` header

### **Issue: 404 Not Found**
**Cause**: Missing `/api` prefix in endpoint path
**Solution**: Add `/api` prefix to all backend API calls

### **Issue: Connection Timeout**
**Cause**: Network connectivity or backend down
**Solution**:
1. Test backend availability with `curl`
2. Check DigitalOcean App Platform status
3. Verify DNS resolution

### **Issue: CORS Errors**
**Cause**: Web-only issue, not applicable to Flutter native apps
**Solution**: N/A for iOS/Android

### **Issue: Certificate Errors**
**Cause**: TLS/SSL configuration issues
**Solution**: Verify `Info.plist` NSAppTransportSecurity settings

---

## Deployment Checklist

Before deploying to TestFlight:

1. **Code Review**
   - [ ] All API endpoints use `/api` prefix
   - [ ] All services use correct baseUrl
   - [ ] Firebase authentication configured
   - [ ] Error handling in place

2. **Local Testing**
   - [ ] Test with development server
   - [ ] Test with production backend
   - [ ] Verify network requests in logs

3. **Build & Deploy**
   ```bash
   # Version bump and deploy
   ./deploy-prod.sh patch "description"
   
   # Build is automatic, IPA created at:
   # mobile/build/ios/ipa/Crew Chat.ipa
   ```

4. **TestFlight Upload**
   - [ ] IPA uploaded to TestFlight
   - [ ] Wait 5-10 minutes for processing
   - [ ] Test with TestFlight app

5. **Production Validation**
   - [ ] Login works
   - [ ] Workspaces load
   - [ ] Real-time messaging functional
   - [ ] File uploads work

---

## Quick Reference

### **Backend URLs**
- **Production**: https://coral-app-rgki8.ondigitalocean.app
- **Web App**: https://crewchat.elbarriobk.com
- **Version Endpoint**: /api/version (no auth)
- **Workspaces Endpoint**: /api/workspaces (auth required)

### **API Path Pattern**
All backend endpoints follow this pattern:
```
https://coral-app-rgki8.ondigitalocean.app/api/{resource}
```

Never use:
```
https://coral-app-rgki8.ondigitalocean.app/{resource}
```

### **Key Files**
- API Config: `mobile/lib/core/config/api_config.dart`
- HTTP Client: `mobile/lib/data/services/http_client.dart`
- iOS Network: `mobile/ios/Runner/Info.plist`
- Workspace Service: `mobile/lib/data/services/workspace_service.dart`

### **Deployment Command**
```bash
./deploy-prod.sh patch "commit message"
```

This automatically:
1. Bumps versions (React, Backend, Flutter)
2. Commits and pushes to git
3. Builds Flutter IPA
4. Uploads to TestFlight

### **Version Tracking**
- **Backend**: `backend/package.json`
- **Frontend**: `frontend/package.json`
- **Flutter**: `mobile/pubspec.yaml`
- All stay in sync via `deploy-prod.sh`

---

## Contact & Support

**Developer**: Steven
**Last Updated**: Nov 23, 2025
**Current Version**: v1.8.77 (build 1877)

For issues, check:
1. This debugging guide
2. DigitalOcean runtime logs
3. Xcode console logs
4. TestFlight feedback
