# Deep Link Implementation - Step by Step

## Status: IMPLEMENTATION COMPLETE ✅ (Needs Testing)

### Completed Steps:
1. ✅ Backend URL changed from `#/invite/` to `/invite/`
2. ✅ iOS Universal Links configured in Info.plist
3. ✅ uni_links package added to pubspec.yaml
4. ✅ Flutter dependencies installed
5. ✅ Frontend routing changed from HashRouter to BrowserRouter
6. ✅ Flutter deep link handler implemented in MainApp
7. ✅ Apple Association File created
8. ✅ Android association file created
9. ✅ Android manifest updated with intent filters

### Remaining Steps:

## STEP 4: Install Flutter Dependencies
```bash
cd mobile
flutter pub get
```

## STEP 5: Enable Associated Domains in Xcode (REQUIRED)
**You must do this manually in Xcode:**
1. Open `mobile/ios/Runner.xcworkspace` in Xcode
2. Select Runner project → Runner target
3. Go to "Signing & Capabilities" tab
4. Click "+ Capability" button
5. Search for and add "Associated Domains"
6. In Associated Domains section, click "+" and add:
   ```
   applinks:coral-app-rgki8.ondigitalocean.app
   ```

## STEP 6: Deploy Apple Association File
**Critical for Universal Links to work!**

Create file: `frontend/public/.well-known/apple-app-site-association`

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "YOUR_TEAM_ID.com.toastconversion.app",
        "paths": ["/invite/*"]
      }
    ]
  }
}
```

**Replace YOUR_TEAM_ID with your Apple Developer Team ID** (found in Xcode → Runner → Signing & Capabilities)

**Deploy this file:**
- Must be accessible at: `https://coral-app-rgki8.ondigitalocean.app/.well-known/apple-app-site-association`
- Must return `Content-Type: application/json`
- NO `.json` extension
- Apple will cache this file for 24-48 hours

## STEP 7: Update Frontend Routing
**File**: `frontend/src/App.jsx` or routing configuration

Change from hash router to browser router:
```jsx
// OLD:
<HashRouter>

// NEW:
<BrowserRouter>
```

Add route for invitations:
```jsx
<Route path="/invite/:token" element={<InviteAcceptPage />} />
```

## STEP 8: Implement Flutter Deep Link Handler
**File**: `mobile/lib/main.dart`

Add imports:
```dart
import 'dart:async';
import 'package:uni_links/uni_links.dart';
```

Add deep link handling in MyApp widget (see DEEP-LINK-IMPLEMENTATION.md for full code)

## STEP 9: Build and Deploy
```bash
# Backend
./deploy-prod.sh patch "Add deep linking support"

# Frontend  
cd frontend
npm run build
# Deploy build folder

# Flutter iOS
cd mobile
flutter build ipa --release
# Upload to TestFlight via Transporter
```

## STEP 10: Testing

### Test Universal Links:
1. Build and install app on iPhone via TestFlight
2. Send invitation email to yourself
3. Open email on iPhone
4. Tap invitation link
5. **Expected**: App opens directly (not Safari)
6. **If Safari opens**: Wait 24-48 hours for Apple to cache association file

### Test Fallback:
1. Uninstall app
2. Click invitation link
3. **Expected**: Opens in Safari and processes invitation

## Notes:
- Universal Links **require** the association file to be deployed
- Apple caches the file, so changes take 24-48 hours
- TestFlight builds support Universal Links (no App Store review needed)
- For immediate testing, use custom URL scheme: `crewchat://invite/TOKEN`

## Troubleshooting:
- **Link opens Safari instead of app**: Association file not cached yet (wait 24-48h)
- **"Invalid Link" error**: Check token expiration (7 days)
- **App crashes on link**: Check deep link handler implementation
- **No response**: Verify Associated Domains capability in Xcode
