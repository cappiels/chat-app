class ApiConfig {
  // Base URLs for different environments
  static const String _developmentUrl = 'http://localhost:8080';
  static const String _productionUrl = 'https://coral-app-rgki8.ondigitalocean.app';
  
  // TEMPORARY: Use production URL for both debug and release to test on iPhone
  // iPhone can't access localhost (that refers to the phone itself, not your Mac)
  static const String baseUrl = _productionUrl;
  
  // Original auto-detect (uncomment when testing on Mac simulators):
  // static const String baseUrl = bool.fromEnvironment('dart.vm.product') 
  //   ? _productionUrl  // Production/Release mode
  //   : _developmentUrl; // Debug mode
  static const String apiVersion = 'v1';
  
  // API Endpoints
  static const String auth = '/api/auth';
  static const String users = '/api/users';
  static const String workspaces = '/api/workspaces';
  static const String messages = '/api/messages';
  static const String subscriptions = '/api/subscriptions';
  static const String admin = '/api/admin';
  
  // Subscription Endpoints (Ready from your backend)
  static const String subscriptionPlans = '$subscriptions/plans';
  static const String subscriptionStatus = '$subscriptions/status';
  static const String createCheckoutSession = '$subscriptions/create-checkout-session';
  static const String cancelSubscription = '$subscriptions/cancel';
  static const String redeemPass = '$subscriptions/passes/redeem';
  
  // Admin Endpoints (Ready from your backend)
  static const String adminWorkspaces = '$admin/workspaces';
  static const String adminUsers = '$admin/users';
  static const String adminStats = '$admin/stats';
  static const String generatePass = '$admin/passes/generate';
  
  // Socket.IO Configuration - use same environment detection
  static const String socketUrl = baseUrl;
  static const Duration socketTimeout = Duration(seconds: 10);
  static const Duration socketReconnectDelay = Duration(seconds: 2);
  
  // HTTP Configuration
  static const Duration httpTimeout = Duration(seconds: 30);
  static const Duration httpReceiveTimeout = Duration(seconds: 30);
  static const Duration httpSendTimeout = Duration(seconds: 30);
  
  // Firebase Configuration (matches your web app)
  static const String firebaseConfigWeb = '''
  {
    "apiKey": "AIzaSyCgRIL7wAyUxLf1OqvYzv9t2iKZJ6Ox9Fs",
    "authDomain": "chat-app-abe38.firebaseapp.com",
    "projectId": "chat-app-abe38",
    "storageBucket": "chat-app-abe38.appspot.com",
    "messagingSenderId": "724624327741",
    "appId": "1:724624327741:web:8f9b5c9e7a2d1f0g3h4i5j"
  }
  ''';
  
  // Feature Flags
  static const bool enableSubscriptions = true;
  static const bool enablePushNotifications = true;
  static const bool enableOfflineSupport = true;
  
  // Development/Debug Settings
  static const bool enableApiLogging = true;
  static const bool enableSocketLogging = true;
}
