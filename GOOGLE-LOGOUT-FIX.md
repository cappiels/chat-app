# Google Logout & Account Switching Fix

## Issue
Flutter app was not properly logging out from Google Sign-In. When clicking "Continue with Google" after logout, it would automatically re-login with the same cached account, preventing users from switching accounts.

## Root Cause
The app was using Firebase Auth's `signInWithProvider()` without the Google Sign-In SDK. This meant:
- Google credentials were cached on iOS device
- Only Firebase session was cleared on logout
- Google's cached credentials were never cleared
- No account selection prompt was shown

## Solution Implemented

### 1. Added Google Sign-In SDK Package
**File**: `mobile/pubspec.yaml`
```yaml
google_sign_in: ^6.2.2
```

### 2. Updated Authentication Service
**File**: `mobile/lib/data/services/auth_service.dart`

**Changes**:
- Added `GoogleSignIn` instance with email and profile scopes
- Updated `signInWithGoogle()` to:
  - Sign out from Google first (forces account selection)
  - Use Google Sign-In SDK to get credentials
  - Create Firebase credential from Google auth
  - Sign in to Firebase with Google credential
- Updated `signOut()` to:
  - Sign out from both Google AND Firebase
  - Use `Future.wait()` for parallel execution

**Key Code**:
```dart
final GoogleSignIn _googleSignIn = GoogleSignIn(
  scopes: ['email', 'profile'],
);

Future<UserCredential?> signInWithGoogle() async {
  // Sign out first to force account selection
  await _googleSignIn.signOut();
  
  // Trigger Google Sign-In flow
  final GoogleSignInAccount? googleUser = await _googleSignIn.signIn();
  
  // Get auth details and create Firebase credential
  final GoogleSignInAuthentication googleAuth = await googleUser.authentication;
  final credential = GoogleAuthProvider.credential(
    accessToken: googleAuth.accessToken,
    idToken: googleAuth.idToken,
  );
  
  // Sign in to Firebase
  return await _auth.signInWithCredential(credential);
}

Future<void> signOut() async {
  // Sign out from BOTH Google and Firebase
  await Future.wait([
    _googleSignIn.signOut(),
    _auth.signOut(),
  ]);
}
```

### 3. Updated Login Screen
**File**: `mobile/lib/presentation/screens/auth/login_screen.dart`
- Changed to use `authServiceProvider` instead of direct Firebase calls
- Proper error handling for cancelled sign-ins

## Testing Instructions

### Upload to TestFlight
1. Open **Transporter** app on Mac
2. Drag and drop: `mobile/build/ios/ipa/mobile.ipa`
3. Wait for upload to complete (App Store Connect will process)

### Test on iPhone
1. **Install from TestFlight** (wait for processing to complete)
2. **Test Logout Flow**:
   - Log in with first Gmail account
   - Navigate to settings/profile
   - Click "Log Out"
   - Verify you're returned to login screen
   
3. **Test Account Switching**:
   - Click "Continue with Google"
   - **EXPECTED**: Google account selection screen appears
   - **VERIFY**: Can see all your Google accounts
   - Select different Gmail account
   - **VERIFY**: Logs in with new account successfully

### What Changed
- ✅ **Before**: Logout only cleared Firebase, Google stayed cached
- ✅ **After**: Logout clears BOTH Firebase AND Google credentials
- ✅ **Before**: Sign-in automatically used cached Google account
- ✅ **After**: Sign-in always shows account selection screen

## Technical Details

### Why This Works
1. **Dual Sign-Out**: Clearing both Google and Firebase sessions
2. **Forced Selection**: `signOut()` before `signIn()` prevents cached credentials
3. **Proper SDK**: Using Google Sign-In SDK instead of Firebase-only approach
4. **iOS Integration**: GoogleSignIn pods properly installed via CocoaPods

### Dependencies Installed
- `google_sign_in: ^6.2.2` (Flutter package)
- `GoogleSignIn: 8.0.0` (iOS CocoaPod)
- `GTMSessionFetcher: 3.5.0` (iOS dependency)
- `GTMAppAuth: 4.1.1` (iOS dependency)

## Build Information
- **App Version**: 1.8.88
- **Build Number**: 1888
- **Bundle ID**: com.chatapp.mobile2
- **IPA Size**: 26.5MB
- **Archive Size**: 212.6MB
- **Build Date**: November 24, 2025

## Files Modified
1. `mobile/pubspec.yaml` - Added google_sign_in dependency
2. `mobile/lib/data/services/auth_service.dart` - Complete Google Sign-In integration
3. `mobile/lib/presentation/screens/auth/login_screen.dart` - Updated to use auth service
4. `mobile/ios/Podfile.lock` - Updated with Google Sign-In pods

## Deployment Status
- ✅ IPA built successfully
- ⏳ Pending TestFlight upload
- ⏳ Pending real device testing
- ⏳ Pending account switching verification

## Next Steps
1. Upload IPA to TestFlight via Transporter app
2. Wait for App Store Connect processing (~15-30 minutes)
3. Install on iPhone from TestFlight
4. Test logout functionality
5. Test account switching functionality
6. Verify no regression in other authentication flows
