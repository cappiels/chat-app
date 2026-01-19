import 'dart:io';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'http_client.dart';

// Provider for push notification service
final pushNotificationServiceProvider = Provider<PushNotificationService>((ref) {
  final httpClient = ref.watch(httpClientProvider);
  return PushNotificationService(httpClient);
});

// Background message handler - must be top-level function
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  debugPrint('🔔 Background message received: ${message.messageId}');
  // The notification is handled by the system when in background
  // We can do additional processing here if needed
}

class PushNotificationService {
  final HttpClient _httpClient;
  final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  final FlutterLocalNotificationsPlugin _localNotifications = FlutterLocalNotificationsPlugin();

  String? _currentToken;
  bool _isInitialized = false;

  // Callback for handling notification taps
  void Function(Map<String, dynamic> data)? onNotificationTap;

  PushNotificationService(this._httpClient);

  // =====================================================
  // Initialization
  // =====================================================

  Future<void> initialize() async {
    if (_isInitialized) return;

    try {
      // Request permission
      final permissionGranted = await requestPermission();
      if (!permissionGranted) {
        debugPrint('⚠️ Push notification permission denied');
        return;
      }

      // Initialize local notifications for foreground display
      await _initializeLocalNotifications();

      // Set up message handlers
      _setupForegroundHandler();
      _setupBackgroundHandler();
      _setupNotificationTapHandler();

      // Get and register token
      await _getAndRegisterToken();

      // Listen for token refresh
      _messaging.onTokenRefresh.listen(_handleTokenRefresh);

      _isInitialized = true;
      debugPrint('✅ Push notification service initialized');

    } catch (e) {
      debugPrint('❌ Failed to initialize push notifications: $e');
    }
  }

  Future<void> _initializeLocalNotifications() async {
    // Android settings
    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');

    // iOS settings
    const iosSettings = DarwinInitializationSettings(
      requestAlertPermission: false,
      requestBadgePermission: false,
      requestSoundPermission: false,
    );

    const initSettings = InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
    );

    await _localNotifications.initialize(
      initSettings,
      onDidReceiveNotificationResponse: (NotificationResponse response) {
        // Handle notification tap from local notification
        if (response.payload != null) {
          _handleNotificationTapFromPayload(response.payload!);
        }
      },
    );

    // Create notification channel for Android
    if (Platform.isAndroid) {
      const channel = AndroidNotificationChannel(
        'crew_messages',
        'Messages',
        description: 'Notifications for new messages',
        importance: Importance.high,
      );

      await _localNotifications
          .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
          ?.createNotificationChannel(channel);
    }
  }

  // =====================================================
  // Permission Handling
  // =====================================================

  Future<bool> requestPermission() async {
    final settings = await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      provisional: false,
      announcement: false,
      carPlay: false,
      criticalAlert: false,
    );

    final isGranted = settings.authorizationStatus == AuthorizationStatus.authorized ||
        settings.authorizationStatus == AuthorizationStatus.provisional;

    debugPrint('🔔 Push notification permission: ${settings.authorizationStatus}');
    return isGranted;
  }

  Future<bool> checkPermission() async {
    final settings = await _messaging.getNotificationSettings();
    return settings.authorizationStatus == AuthorizationStatus.authorized ||
        settings.authorizationStatus == AuthorizationStatus.provisional;
  }

  // =====================================================
  // Token Management
  // =====================================================

  Future<String?> getToken() async {
    try {
      // For iOS, we need APNs token first
      if (Platform.isIOS) {
        debugPrint('📱 iOS detected, checking APNs token...');
        String? apnsToken;

        // Retry up to 5 times with increasing delays
        for (int i = 0; i < 5; i++) {
          apnsToken = await _messaging.getAPNSToken();
          if (apnsToken != null) {
            debugPrint('✅ APNs token obtained on attempt ${i + 1}');
            break;
          }
          debugPrint('⚠️ APNs token not yet available (attempt ${i + 1}/5)');
          await Future.delayed(Duration(seconds: 2 + i)); // 2, 3, 4, 5, 6 seconds
        }

        if (apnsToken == null) {
          debugPrint('❌ APNs token not available after 5 attempts - push notifications will not work');
          debugPrint('   Make sure push notifications are enabled in iOS Settings > Crew Chat > Notifications');
          return null;
        }
      }

      _currentToken = await _messaging.getToken();
      if (_currentToken != null) {
        debugPrint('🔑 FCM Token obtained: ${_currentToken!.substring(0, 20)}...');
      } else {
        debugPrint('❌ FCM token is null');
      }
      return _currentToken;

    } catch (e) {
      debugPrint('❌ Failed to get FCM token: $e');
      return null;
    }
  }

  Future<void> _getAndRegisterToken() async {
    debugPrint('🔄 Getting and registering FCM token...');
    final token = await getToken();
    if (token != null) {
      debugPrint('📤 Registering token with backend...');
      await registerTokenWithBackend(token);
    } else {
      debugPrint('⚠️ No token to register - push notifications disabled');
    }
  }

  Future<void> registerTokenWithBackend(String token) async {
    try {
      final platform = Platform.isIOS ? 'ios' : (Platform.isAndroid ? 'android' : 'unknown');

      await _httpClient.post(
        '/push/register',
        data: {
          'token': token,
          'platform': platform,
          'deviceInfo': {
            'os': Platform.operatingSystem,
            'osVersion': Platform.operatingSystemVersion,
          },
        },
      );

      debugPrint('✅ Device token registered with backend');

    } catch (e) {
      debugPrint('❌ Failed to register token with backend: $e');
    }
  }

  Future<void> _handleTokenRefresh(String newToken) async {
    debugPrint('🔄 FCM token refreshed');

    if (_currentToken != null && _currentToken != newToken) {
      try {
        await _httpClient.put(
          '/push/refresh-token',
          data: {
            'oldToken': _currentToken,
            'newToken': newToken,
          },
        );
        debugPrint('✅ Token refresh registered with backend');
      } catch (e) {
        debugPrint('❌ Failed to refresh token with backend: $e');
        // Fall back to registering as new token
        await registerTokenWithBackend(newToken);
      }
    } else {
      await registerTokenWithBackend(newToken);
    }

    _currentToken = newToken;
  }

  Future<void> unregisterToken() async {
    if (_currentToken == null) return;

    try {
      await _httpClient.delete(
        '/push/unregister',
        data: {'token': _currentToken},
      );
      debugPrint('✅ Device token unregistered');
      _currentToken = null;

    } catch (e) {
      debugPrint('❌ Failed to unregister token: $e');
    }
  }

  // =====================================================
  // Message Handlers
  // =====================================================

  void _setupForegroundHandler() {
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      debugPrint('🔔 Foreground message: ${message.notification?.title}');
      _showLocalNotification(message);
    });
  }

  void _setupBackgroundHandler() {
    // Background handler is set up at app startup
    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
  }

  void _setupNotificationTapHandler() {
    // Handle notification tap when app is in background
    FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
      debugPrint('🔔 Notification tapped (background): ${message.data}');
      _handleNotificationTap(message.data);
    });

    // Check if app was opened from terminated state via notification
    _messaging.getInitialMessage().then((RemoteMessage? message) {
      if (message != null) {
        debugPrint('🔔 App opened from notification (terminated): ${message.data}');
        // Delay to ensure app is fully initialized
        Future.delayed(const Duration(milliseconds: 500), () {
          _handleNotificationTap(message.data);
        });
      }
    });
  }

  Future<void> _showLocalNotification(RemoteMessage message) async {
    final notification = message.notification;
    if (notification == null) return;

    // Don't show if we're in the same thread
    // This would require checking current screen state via a provider

    const androidDetails = AndroidNotificationDetails(
      'crew_messages',
      'Messages',
      channelDescription: 'Notifications for new messages',
      importance: Importance.high,
      priority: Priority.high,
      icon: '@mipmap/ic_launcher',
    );

    const iosDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    const details = NotificationDetails(
      android: androidDetails,
      iOS: iosDetails,
    );

    // Create payload from message data
    final payload = _encodePayload(message.data);

    await _localNotifications.show(
      message.hashCode,
      notification.title,
      notification.body,
      details,
      payload: payload,
    );
  }

  void _handleNotificationTap(Map<String, dynamic> data) {
    if (onNotificationTap != null) {
      onNotificationTap!(data);
    } else {
      debugPrint('⚠️ No notification tap handler registered');
    }
  }

  void _handleNotificationTapFromPayload(String payload) {
    final data = _decodePayload(payload);
    _handleNotificationTap(data);
  }

  String _encodePayload(Map<String, dynamic> data) {
    // Simple encoding: key1=value1,key2=value2
    return data.entries.map((e) => '${e.key}=${e.value}').join(',');
  }

  Map<String, dynamic> _decodePayload(String payload) {
    final map = <String, dynamic>{};
    for (final part in payload.split(',')) {
      final kv = part.split('=');
      if (kv.length == 2) {
        map[kv[0]] = kv[1];
      }
    }
    return map;
  }

  // =====================================================
  // Badge Management
  // =====================================================

  Future<void> clearBadge({String? workspaceId}) async {
    try {
      await _httpClient.post(
        '/push/badge-count/clear',
        data: workspaceId != null ? {'workspaceId': workspaceId} : {},
      );

      // Clear local badge on iOS
      if (Platform.isIOS) {
        await _localNotifications
            .resolvePlatformSpecificImplementation<IOSFlutterLocalNotificationsPlugin>()
            ?.cancelAll();
      }

    } catch (e) {
      debugPrint('❌ Failed to clear badge: $e');
    }
  }

  Future<int> getBadgeCount() async {
    try {
      final response = await _httpClient.get('/push/badge-count');
      return response.data['count'] ?? 0;
    } catch (e) {
      debugPrint('❌ Failed to get badge count: $e');
      return 0;
    }
  }

  // =====================================================
  // Preferences
  // =====================================================

  Future<Map<String, dynamic>?> getPreferences({String? workspaceId, String? threadId}) async {
    try {
      final queryParams = <String, dynamic>{};
      if (workspaceId != null) queryParams['workspaceId'] = workspaceId;
      if (threadId != null) queryParams['threadId'] = threadId;

      final response = await _httpClient.get(
        '/push/preferences',
        queryParameters: queryParams,
      );
      return response.data as Map<String, dynamic>;

    } catch (e) {
      debugPrint('❌ Failed to get preferences: $e');
      return null;
    }
  }

  Future<bool> savePreferences(Map<String, dynamic> preferences) async {
    try {
      await _httpClient.post('/push/preferences', data: preferences);
      return true;
    } catch (e) {
      debugPrint('❌ Failed to save preferences: $e');
      return false;
    }
  }

  // =====================================================
  // Muting
  // =====================================================

  Future<bool> muteWorkspace(String workspaceId, {String muteLevel = 'all', Duration? duration}) async {
    try {
      await _httpClient.post(
        '/push/mute/workspace/$workspaceId',
        data: {
          'muteLevel': muteLevel,
          if (duration != null) 'duration': duration.inMilliseconds,
        },
      );
      return true;
    } catch (e) {
      debugPrint('❌ Failed to mute workspace: $e');
      return false;
    }
  }

  Future<bool> unmuteWorkspace(String workspaceId) async {
    try {
      await _httpClient.delete('/push/mute/workspace/$workspaceId');
      return true;
    } catch (e) {
      debugPrint('❌ Failed to unmute workspace: $e');
      return false;
    }
  }

  Future<bool> muteChannel(String threadId, {String muteLevel = 'all', Duration? duration}) async {
    try {
      await _httpClient.post(
        '/push/mute/channel/$threadId',
        data: {
          'muteLevel': muteLevel,
          if (duration != null) 'duration': duration.inMilliseconds,
        },
      );
      return true;
    } catch (e) {
      debugPrint('❌ Failed to mute channel: $e');
      return false;
    }
  }

  Future<bool> unmuteChannel(String threadId) async {
    try {
      await _httpClient.delete('/push/mute/channel/$threadId');
      return true;
    } catch (e) {
      debugPrint('❌ Failed to unmute channel: $e');
      return false;
    }
  }

  // =====================================================
  // Do Not Disturb
  // =====================================================

  Future<bool> enableDND({
    String? startTime,
    String? endTime,
    String timezone = 'America/New_York',
    bool allowMentions = true,
  }) async {
    try {
      await _httpClient.post(
        '/push/dnd',
        data: {
          'enabled': true,
          if (startTime != null) 'startTime': startTime,
          if (endTime != null) 'endTime': endTime,
          'timezone': timezone,
          'allowMentions': allowMentions,
        },
      );
      return true;
    } catch (e) {
      debugPrint('❌ Failed to enable DND: $e');
      return false;
    }
  }

  Future<bool> disableDND() async {
    try {
      await _httpClient.delete('/push/dnd');
      return true;
    } catch (e) {
      debugPrint('❌ Failed to disable DND: $e');
      return false;
    }
  }

  // =====================================================
  // Testing
  // =====================================================

  Future<bool> sendTestNotification() async {
    try {
      final response = await _httpClient.post(
        '/push/test',
        data: {
          'title': 'Test Notification',
          'body': 'This is a test push notification from Crew Chat!',
        },
      );
      return response.data['success'] == true;
    } catch (e) {
      debugPrint('❌ Failed to send test notification: $e');
      return false;
    }
  }
}
