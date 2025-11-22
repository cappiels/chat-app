# TestFlight Issues & Fixes (Nov 22, 2025)

## 🎉 SUCCESS: App Deployed to TestFlight!
Your Flutter app is live on TestFlight for beta testing.

---

## 🐛 CRITICAL ISSUES TO FIX

### ✅ Issue #1: iOS App Shows "Mobile" Instead of "Crew Chat" - FIXED

**Problem**: App displays as "Mobile" on iOS home screen even though TestFlight shows "Crew Chat"

**Root Cause**: `Info.plist` had hardcoded "Mobile" name

**Fix Applied**:
```xml
<!-- mobile/ios/Runner/Info.plist -->
<key>CFBundleDisplayName</key>
<string>Crew Chat</string>  <!-- Changed from "Mobile" -->
<key>CFBundleName</key>
<string>Crew Chat</string>  <!-- Changed from "mobile" -->
```

**Next Steps**:
1. Rebuild the app: `cd mobile && flutter build ios --release`
2. Upload new build to TestFlight
3. Delete old "Mobile" app from iPhone
4. Install new build - should now show "Crew Chat"

---

### ❌ Issue #2: No Notification Sounds in React App

**Problem**: Notification sounds not playing in web browser

**Root Cause**: Browser autoplay policies require user interaction before playing audio

**Current Implementation**: ✅ Sound system IS fully implemented:
- `frontend/src/utils/soundManager.js` - Complete Web Audio API system
- `frontend/src/utils/notifications.js` - Notification manager with sound integration
- Generated sounds for: message sent, received, mentions, DMs, typing, connections

**Why It's Not Working**:
1. **Autoplay Policy**: Browsers block audio until user clicks/taps
2. **AudioContext State**: Starts in "suspended" state on page load
3. **Missing User Interaction**: No explicit user action to enable audio

**Solution**:

Add user interaction prompt on first app load:

```javascript
// frontend/src/components/layout/AppLayout.jsx
// Add this to your useEffect or component mount:

useEffect(() => {
  const enableSounds = async () => {
    // Check if sounds need enabling
    const soundsEnabled = localStorage.getItem('soundsInitialized');
    
    if (!soundsEnabled) {
      // Show a one-time prompt
      const enable = window.confirm(
        'Enable notification sounds? (You can change this later in settings)'
      );
      
      if (enable) {
        // Enable audio context
        await soundManager.enableAudioContext();
        
        // Play a test sound
        soundManager.testSound('messageReceived');
        
        localStorage.setItem('soundsInitialized', 'true');
      }
    }
  };

  enableSounds();
}, []);
```

**Alternative Solution** (Better UX):

Add to your Settings/Profile page:

```jsx
// Sound Settings Component
<button onClick={async () => {
  await soundManager.enableAudioContext();
  soundManager.testSound('messageReceived');
}}>
  🔊 Test Notification Sound
</button>

<button onClick={() => {
  soundManager.testAllSounds();
}}>
  🎵 Test All Sounds
</button>
```

**Immediate Fix**:
1. Open browser console: `F12` or `Cmd+Option+I`
2. Type: `soundManager.enableAudioContext()`
3. Type: `soundManager.testSound('messageReceived')`
4. If you hear a beep, sounds are working!

---

### ❌ Issue #3: Socket.IO Not Working in iOS App

**Problem**: 
- Typing indicators not working (sending or receiving)
- Messages not appearing in real-time
- Have to refresh to see new messages

**Root Cause**: Multiple possible issues

#### 🔍 Diagnosis Steps:

**Step 1: Check Socket Connection**
```dart
// Add debug logging to see connection state
// In chat_screen.dart _initializeChat():

print('🔌 Socket connected: ${_socketService.isConnected}');
print('🔌 Connection state: ${_socketService.connectionState}');
```

**Step 2: Check Firebase Auth Token**
```dart
// In socket_service.dart connect() method:
final token = await user.getIdToken();
print('🔑 Firebase token: ${token?.substring(0, 20)}...'); // Don't log full token!
```

**Step 3: Check Backend Logs**
- Go to DigitalOcean App Platform → Runtime Logs
- Look for Socket.IO connection attempts from iOS
- Check for authentication errors

#### 🛠️ Potential Fixes:

**Fix #1: Ensure Socket Connects After Firebase Auth**

```dart
// mobile/lib/presentation/screens/chat/chat_screen.dart

Future<void> _initializeChat() async {
  try {
    // Get current user FIRST
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      throw Exception('User not authenticated');
    }
    _currentUserId = user.uid;

    // FORCE reconnect to ensure fresh token
    if (_socketService.isConnected) {
      _socketService.disconnect();
    }
    
    // Connect with fresh Firebase token
    await _socketService.connect();
    
    // WAIT for connection before joining
    int attempts = 0;
    while (!_socketService.isConnected && attempts < 30) {
      await Future.delayed(Duration(milliseconds: 100));
      attempts++;
    }
    
    if (!_socketService.isConnected) {
      throw Exception('Socket connection timeout');
    }
    
    print('✅ Socket connected, joining thread...');
    
    // Now join the thread
    await _socketService.joinThread(
      widget.workspace['id'].toString(),
      widget.thread.id,
    );
    
    // Rest of initialization...
  } catch (e) {
    print('❌ Chat init error: $e');
  }
}
```

**Fix #2: Add Connection State Monitoring**

```dart
// Add to _ChatScreenState class:

StreamSubscription<SocketConnectionState>? _connectionSubscription;

@override
void initState() {
  super.initState();
  _initializeChat();
  _scrollController.addListener(_onScroll);
  
  // Monitor connection state
  _connectionSubscription = _socketService.connectionStateStream.listen((state) {
    print('🔌 Connection state changed: $state');
    
    if (state == SocketConnectionState.connected) {
      // Reconnected! Rejoin thread
      _socketService.joinThread(
        widget.workspace['id'].toString(),
        widget.thread.id,
      );
    }
  });
}

@override
void dispose() {
  _connectionSubscription?.cancel();
  // ... rest of dispose
}
```

**Fix #3: Check iOS Network Permissions**

Add to `mobile/ios/Runner/Info.plist`:

```xml
<!-- Add before </dict> -->
<key>NSAppTransportSecurity</key>
<dict>
  <key>NSAllowsArbitraryLoads</key>
  <true/>
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

**Fix #4: Enable Background Modes for Socket**

In Xcode:
1. Open `mobile/ios/Runner.xcworkspace`
2. Select Runner target → Signing & Capabilities
3. Add "Background Modes" capability
4. Enable: "Background fetch" and "Remote notifications"

**Fix #5: Add Socket Reconnection Logic**

```dart
// mobile/lib/data/services/socket_service.dart

// Add to SocketService class:
Timer? _reconnectTimer;

void _setupEventListeners() {
  // ... existing listeners ...

  _socket!.onDisconnect((data) {
    debugPrint('❌ Socket disconnected: $data');
    _updateConnectionState(SocketConnectionState.disconnected);
    
    // Auto-reconnect after 2 seconds
    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(Duration(seconds: 2), () {
      if (_connectionState == SocketConnectionState.disconnected) {
        debugPrint('🔄 Attempting to reconnect...');
        connect();
      }
    });
  });
}

@override
void dispose() {
  _reconnectTimer?.cancel();
  // ... rest of dispose
}
```

---

## 🧪 TESTING CHECKLIST

### React App (Web):
- [ ] Open browser console
- [ ] Run: `soundManager.enableAudioContext()`
- [ ] Run: `soundManager.testSound('messageReceived')`
- [ ] Should hear a beep sound
- [ ] Send a message - should hear "sent" sound
- [ ] Receive a message - should hear "received" sound

### iOS App (TestFlight):
- [ ] Delete old "Mobile" app from iPhone
- [ ] Install new build with "Crew Chat" name
- [ ] Open app and sign in
- [ ] Navigate to a channel
- [ ] Check console for: "✅ Socket connected"
- [ ] Check console for: "✅ CONFIRMED: Joined thread"
- [ ] Send message from React app → Should appear immediately in iOS
- [ ] Start typing in React app → iOS should show typing indicator
- [ ] Send message from iOS → React should receive immediately
- [ ] Check for typing indicators in both directions

---

## 📋 NEXT STEPS

### Priority 1: Fix App Name (DONE ✅)
- [x] Updated Info.plist
- [ ] Rebuild and upload to TestFlight
- [ ] Test installation shows "Crew Chat"

### Priority 2: Enable React Notification Sounds
- [ ] Add audio context initialization on user login
- [ ] Add sound settings to user preferences
- [ ] Test sounds work after user interaction

### Priority 3: Debug iOS Socket.IO
- [ ] Add connection monitoring logs
- [ ] Test socket connection after Firebase auth
- [ ] Verify typing indicators work
- [ ] Verify real-time message delivery
- [ ] Add reconnection logic for dropped connections

### Priority 4: iOS Notifications Setup
- [ ] Re-enable `firebase_messaging` package
- [ ] Add push notification permissions
- [ ] Test background notifications
- [ ] Make "Crew Chat" appear in iOS Notifications settings

---

## 🔍 DEBUGGING COMMANDS

### React App Console:
```javascript
// Check sound manager status
soundManager.getSettings()

// Enable sounds
await soundManager.enableAudioContext()

// Test individual sounds
soundManager.testSound('messageReceived')
soundManager.testSound('messageSent')
soundManager.testSound('mentionReceived')

// Test all sounds
soundManager.testAllSounds()

// Check notification settings
notificationManager.getSettings()
```

### Flutter App Debug:
```dart
// Add these prints to chat_screen.dart:
print('🔌 Socket connected: ${_socketService.isConnected}');
print('📨 Message stream active: ${_messageSubscription != null}');
print('⌨️ Typing stream active: ${_typingSubscription != null}');
```

---

## 💡 QUICK WINS

**For React App**:
1. Add a "Enable Sounds" button in user settings
2. Play test sound when button clicked
3. Save preference to localStorage

**For iOS App**:
1. Add connection status indicator in UI
2. Show "Connecting..." when socket disconnected
3. Add manual "Reconnect" button if connection fails
4. Display Firebase auth status

**For Both**:
1. Add detailed error messages instead of silent failures
2. Log all Socket.IO events for debugging
3. Add health check endpoint to verify backend status

---

## 🎯 SUCCESS CRITERIA

- ✅ iOS app displays as "Crew Chat" on home screen
- ✅ Notification sounds play in React app after user enables them
- ✅ Real-time messages appear immediately in iOS app
- ✅ Typing indicators work in both directions
- ✅ Socket.IO reconnects automatically if connection drops
- ✅ "Crew Chat" appears in iOS Notifications settings (after FCM enabled)

---

**Last Updated**: Nov 22, 2025 - 11:46 AM
**Next Review**: After implementing Priority 1-3 fixes
