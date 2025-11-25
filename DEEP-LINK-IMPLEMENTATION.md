# Deep Link Implementation for Workspace Invitations

## Overview
Implement smart invitation links that:
- Open iOS app if installed on iPhone
- Open Android app if installed on Android
- Open web browser as fallback

## Implementation Steps

### 1. Backend - Update Invitation URL Format
**File**: `backend/routes/workspaces.js` (line 519)

Change from hash routing to path routing:
```javascript
// OLD: const inviteUrl = `${frontendUrl}/#/invite/${inviteToken}`;
// NEW: const inviteUrl = `${frontendUrl}/invite/${inviteToken}`;
```

### 2. iOS - Universal Links Configuration

#### A. Update Info.plist
**File**: `mobile/ios/Runner/Info.plist`

Add Associated Domains:
```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleTypeRole</key>
    <string>Editor</string>
    <key>CFBundleURLName</key>
    <string>com.toastconversion.app</string>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>toastconversion</string>
    </array>
  </dict>
</array>
<key>com.apple.developer.associated-domains</key>
<array>
  <string>applinks:coral-app-rgki8.ondigitalocean.app</string>
  <string>applinks:www.coral-app-rgki8.ondigitalocean.app</string>
</array>
```

#### B. Enable Associated Domains in Xcode
1. Open `mobile/ios/Runner.xcworkspace` in Xcode
2. Select Runner target → Signing & Capabilities
3. Click + Capability → Associated Domains
4. Add: `applinks:coral-app-rgki8.ondigitalocean.app`

### 3. Android - App Links Configuration

#### A. Update AndroidManifest.xml
**File**: `mobile/android/app/src/main/AndroidManifest.xml`

Add intent filter:
```xml
<intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data
        android:scheme="https"
        android:host="coral-app-rgki8.ondigitalocean.app"
        android:pathPrefix="/invite" />
</intent-filter>
```

### 4. Flutter - Deep Link Handling

#### A. Add Dependencies to pubspec.yaml
```yaml
dependencies:
  uni_links: ^0.5.1
  flutter_app_badger: ^1.5.0
```

#### B. Update main.dart
Add deep link listener to handle incoming links.

### 5. Web Server - Association Files

#### A. Apple App Site Association
**File**: `frontend/public/.well-known/apple-app-site-association`

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "TEAM_ID.com.toastconversion.app",
        "paths": ["/invite/*"]
      }
    ]
  }
}
```

#### B. Android Asset Links
**File**: `frontend/public/.well-known/assetlinks.json`

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.toastconversion.app",
      "sha256_cert_fingerprints": [
        "YOUR_SHA256_FINGERPRINT"
      ]
    }
  }
]
```

### 6. Frontend - Handle Invite Route
Update React Router to handle `/invite/:token` route (remove hash).

## Testing

### iOS
1. Build and install app on iPhone
2. Send invitation email
3. Click link in email → Should open app
4. If app not installed → Opens in Safari

### Android  
1. Build and install app on Android
2. Send invitation email
3. Click link in email → Should open app
4. If app not installed → Opens in Chrome

### Web
1. Click link without app installed
2. Should open web app and process invitation

## Notes
- Universal Links require HTTPS
- Apple requires association file at exact path
- May take 24-48 hours for Apple to cache association file
- Test with TestFlight builds after submitting association file
