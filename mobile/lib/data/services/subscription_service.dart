import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/config/api_config.dart';
import '../models/subscription.dart';
import 'http_client.dart';

// Provider for subscription service
final subscriptionServiceProvider = Provider<SubscriptionService>((ref) {
  final httpClient = ref.read(httpClientProvider);
  return SubscriptionService(httpClient);
});

class SubscriptionService {
  final HttpClient _httpClient;

  SubscriptionService(this._httpClient);

  // Get all available subscription plans
  Future<List<SubscriptionPlan>> getPlans() async {
    try {
      final response = await _httpClient.get(ApiConfig.subscriptionPlans);
      final List<dynamic> data = response.data;
      return data.map((json) => SubscriptionPlan.fromJson(json)).toList();
    } catch (e) {
      throw Exception('Failed to load subscription plans: $e');
    }
  }

  // Get current user's subscription status
  Future<UserSubscription?> getSubscriptionStatus() async {
    try {
      final response = await _httpClient.get(ApiConfig.subscriptionStatus);
      if (response.data != null) {
        return UserSubscription.fromJson(response.data);
      }
      return null;
    } catch (e) {
      throw Exception('Failed to load subscription status: $e');
    }
  }

  // Create Stripe checkout session for subscription
  Future<CheckoutSession> createCheckoutSession({
    required String planId,
    String? successUrl,
    String? cancelUrl,
  }) async {
    try {
      final response = await _httpClient.post(
        ApiConfig.createCheckoutSession,
        data: {
          'planId': planId,
          'successUrl': successUrl ?? 'chatapp://subscription/success',
          'cancelUrl': cancelUrl ?? 'chatapp://subscription/cancel',
        },
      );
      return CheckoutSession.fromJson(response.data);
    } catch (e) {
      throw Exception('Failed to create checkout session: $e');
    }
  }

  // Cancel current subscription
  Future<bool> cancelSubscription() async {
    try {
      final response = await _httpClient.post(ApiConfig.cancelSubscription);
      return response.data['success'] ?? false;
    } catch (e) {
      throw Exception('Failed to cancel subscription: $e');
    }
  }

  // Redeem free pass
  Future<bool> redeemFreePass(String passCode) async {
    try {
      final response = await _httpClient.post(
        ApiConfig.redeemPass,
        data: {'passCode': passCode},
      );
      return response.data['success'] ?? false;
    } catch (e) {
      throw Exception('Failed to redeem free pass: $e');
    }
  }

  // Check if user has access to a feature based on their subscription
  Future<bool> hasFeatureAccess(String featureName) async {
    try {
      final subscription = await getSubscriptionStatus();
      if (subscription == null) return false;

      // Check feature access based on plan
      switch (subscription.planName) {
        case 'free':
          return _freeFeatures.contains(featureName);
        case 'starter':
          return _freeFeatures.contains(featureName) || 
                 _starterFeatures.contains(featureName);
        case 'pro':
          return _freeFeatures.contains(featureName) || 
                 _starterFeatures.contains(featureName) ||
                 _proFeatures.contains(featureName);
        case 'business':
          return true; // Business has access to all features
        default:
          return false;
      }
    } catch (e) {
      return false; // Default to no access on error
    }
  }

  // Feature sets based on your subscription plans
  static const List<String> _freeFeatures = [
    'basic_chat',
    'view_calendar',
    'participate_tasks',
  ];

  static const List<String> _starterFeatures = [
    'create_channels',
    'invite_users',
    'create_tasks',
  ];

  static const List<String> _proFeatures = [
    'unlimited_channels',
    'advanced_calendar',
    'team_management',
    'timeline_editing',
  ];

  // Admin features for checking admin access
  Future<AdminStats?> getAdminStats() async {
    try {
      final response = await _httpClient.get(ApiConfig.adminStats);
      return AdminStats.fromJson(response.data);
    } catch (e) {
      return null; // Not an admin or error occurred
    }
  }

  // Generate free pass (admin only)
  Future<String?> generateFreePass({
    required String planName,
    int? durationDays,
    String? description,
  }) async {
    try {
      final response = await _httpClient.post(
        ApiConfig.generatePass,
        data: {
          'planName': planName,
          'durationDays': durationDays ?? 30,
          'description': description,
        },
      );
      return response.data['passCode'];
    } catch (e) {
      throw Exception('Failed to generate free pass: $e');
    }
  }

  // Get all workspaces (admin only)
  Future<List<AdminWorkspace>> getAdminWorkspaces() async {
    try {
      final response = await _httpClient.get(ApiConfig.adminWorkspaces);
      final List<dynamic> data = response.data;
      return data.map((json) => AdminWorkspace.fromJson(json)).toList();
    } catch (e) {
      throw Exception('Failed to load admin workspaces: $e');
    }
  }

  // Get all users (admin only)
  Future<List<AdminUser>> getAdminUsers() async {
    try {
      final response = await _httpClient.get(ApiConfig.adminUsers);
      final List<dynamic> data = response.data;
      return data.map((json) => AdminUser.fromJson(json)).toList();
    } catch (e) {
      throw Exception('Failed to load admin users: $e');
    }
  }
}
