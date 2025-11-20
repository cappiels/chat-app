import 'package:json_annotation/json_annotation.dart';

part 'subscription.g.dart';

// Subscription Plan Model
@JsonSerializable()
class SubscriptionPlan {
  final String id;
  final String name;
  @JsonKey(name: 'display_name')
  final String displayName;
  final String description;
  final double price;
  final String currency;
  final String interval; // 'month' or 'year'
  final Map<String, dynamic> features;
  @JsonKey(name: 'max_workspaces')
  final int? maxWorkspaces;
  @JsonKey(name: 'max_users_per_workspace')
  final int? maxUsersPerWorkspace;
  @JsonKey(name: 'max_channels_per_workspace')
  final int? maxChannelsPerWorkspace;
  @JsonKey(name: 'upload_limit_mb')
  final int uploadLimitMb;
  @JsonKey(name: 'stripe_price_id')
  final String? stripePriceId;
  @JsonKey(name: 'is_active')
  final bool isActive;
  @JsonKey(name: 'created_at')
  final DateTime createdAt;

  SubscriptionPlan({
    required this.id,
    required this.name,
    required this.displayName,
    required this.description,
    required this.price,
    required this.currency,
    required this.interval,
    required this.features,
    this.maxWorkspaces,
    this.maxUsersPerWorkspace,
    this.maxChannelsPerWorkspace,
    required this.uploadLimitMb,
    this.stripePriceId,
    required this.isActive,
    required this.createdAt,
  });

  factory SubscriptionPlan.fromJson(Map<String, dynamic> json) =>
      _$SubscriptionPlanFromJson(json);

  Map<String, dynamic> toJson() => _$SubscriptionPlanToJson(this);

  bool get isFree => price == 0;
  bool get isPaid => price > 0;
}

// User Subscription Model
@JsonSerializable()
class UserSubscription {
  @JsonKey(name: 'user_id')
  final String userId;
  @JsonKey(name: 'plan_id')
  final String planId;
  @JsonKey(name: 'plan_name')
  final String planName;
  @JsonKey(name: 'plan_display_name')
  final String planDisplayName;
  final String status; // 'active', 'canceled', 'past_due', etc.
  @JsonKey(name: 'stripe_customer_id')
  final String? stripeCustomerId;
  @JsonKey(name: 'stripe_subscription_id')
  final String? stripeSubscriptionId;
  @JsonKey(name: 'current_period_start')
  final DateTime? currentPeriodStart;
  @JsonKey(name: 'current_period_end')
  final DateTime? currentPeriodEnd;
  @JsonKey(name: 'cancel_at_period_end')
  final bool cancelAtPeriodEnd;
  final Map<String, dynamic> features;
  @JsonKey(name: 'created_at')
  final DateTime createdAt;
  @JsonKey(name: 'updated_at')
  final DateTime updatedAt;

  UserSubscription({
    required this.userId,
    required this.planId,
    required this.planName,
    required this.planDisplayName,
    required this.status,
    this.stripeCustomerId,
    this.stripeSubscriptionId,
    this.currentPeriodStart,
    this.currentPeriodEnd,
    required this.cancelAtPeriodEnd,
    required this.features,
    required this.createdAt,
    required this.updatedAt,
  });

  factory UserSubscription.fromJson(Map<String, dynamic> json) =>
      _$UserSubscriptionFromJson(json);

  Map<String, dynamic> toJson() => _$UserSubscriptionToJson(this);

  bool get isActive => status == 'active';
  bool get isCanceled => status == 'canceled';
  bool get isPastDue => status == 'past_due';
  bool get isExpired => currentPeriodEnd?.isBefore(DateTime.now()) ?? false;
}

// Checkout Session Model
@JsonSerializable()
class CheckoutSession {
  @JsonKey(name: 'session_id')
  final String sessionId;
  @JsonKey(name: 'checkout_url')
  final String checkoutUrl;
  @JsonKey(name: 'success_url')
  final String successUrl;
  @JsonKey(name: 'cancel_url')
  final String cancelUrl;
  @JsonKey(name: 'expires_at')
  final DateTime expiresAt;

  CheckoutSession({
    required this.sessionId,
    required this.checkoutUrl,
    required this.successUrl,
    required this.cancelUrl,
    required this.expiresAt,
  });

  factory CheckoutSession.fromJson(Map<String, dynamic> json) =>
      _$CheckoutSessionFromJson(json);

  Map<String, dynamic> toJson() => _$CheckoutSessionToJson(this);

  bool get isExpired => expiresAt.isBefore(DateTime.now());
}

// Admin Stats Model
@JsonSerializable()
class AdminStats {
  @JsonKey(name: 'total_users')
  final int totalUsers;
  @JsonKey(name: 'active_users')
  final int activeUsers;
  @JsonKey(name: 'total_workspaces')
  final int totalWorkspaces;
  @JsonKey(name: 'active_subscriptions')
  final int activeSubscriptions;
  @JsonKey(name: 'monthly_revenue')
  final double monthlyRevenue;
  @JsonKey(name: 'subscription_breakdown')
  final Map<String, int> subscriptionBreakdown;
  @JsonKey(name: 'user_growth')
  final List<UserGrowthData> userGrowth;
  @JsonKey(name: 'generated_at')
  final DateTime generatedAt;

  AdminStats({
    required this.totalUsers,
    required this.activeUsers,
    required this.totalWorkspaces,
    required this.activeSubscriptions,
    required this.monthlyRevenue,
    required this.subscriptionBreakdown,
    required this.userGrowth,
    required this.generatedAt,
  });

  factory AdminStats.fromJson(Map<String, dynamic> json) =>
      _$AdminStatsFromJson(json);

  Map<String, dynamic> toJson() => _$AdminStatsToJson(this);
}

// User Growth Data Model
@JsonSerializable()
class UserGrowthData {
  final String period; // e.g., "2025-11"
  @JsonKey(name: 'new_users')
  final int newUsers;
  @JsonKey(name: 'total_users')
  final int totalUsers;

  UserGrowthData({
    required this.period,
    required this.newUsers,
    required this.totalUsers,
  });

  factory UserGrowthData.fromJson(Map<String, dynamic> json) =>
      _$UserGrowthDataFromJson(json);

  Map<String, dynamic> toJson() => _$UserGrowthDataToJson(this);
}

// Admin Workspace Model
@JsonSerializable()
class AdminWorkspace {
  final String id;
  final String name;
  @JsonKey(name: 'owner_id')
  final String ownerId;
  @JsonKey(name: 'owner_email')
  final String ownerEmail;
  @JsonKey(name: 'member_count')
  final int memberCount;
  @JsonKey(name: 'channel_count')
  final int channelCount;
  @JsonKey(name: 'created_at')
  final DateTime createdAt;
  @JsonKey(name: 'last_activity')
  final DateTime? lastActivity;
  @JsonKey(name: 'subscription_plan')
  final String? subscriptionPlan;

  AdminWorkspace({
    required this.id,
    required this.name,
    required this.ownerId,
    required this.ownerEmail,
    required this.memberCount,
    required this.channelCount,
    required this.createdAt,
    this.lastActivity,
    this.subscriptionPlan,
  });

  factory AdminWorkspace.fromJson(Map<String, dynamic> json) =>
      _$AdminWorkspaceFromJson(json);

  Map<String, dynamic> toJson() => _$AdminWorkspaceToJson(this);
}

// Admin User Model
@JsonSerializable()
class AdminUser {
  final String id;
  final String email;
  @JsonKey(name: 'display_name')
  final String? displayName;
  @JsonKey(name: 'created_at')
  final DateTime createdAt;
  @JsonKey(name: 'last_login')
  final DateTime? lastLogin;
  @JsonKey(name: 'workspace_count')
  final int workspaceCount;
  @JsonKey(name: 'subscription_plan')
  final String? subscriptionPlan;
  @JsonKey(name: 'subscription_status')
  final String? subscriptionStatus;
  @JsonKey(name: 'total_messages')
  final int totalMessages;
  @JsonKey(name: 'is_admin')
  final bool isAdmin;

  AdminUser({
    required this.id,
    required this.email,
    this.displayName,
    required this.createdAt,
    this.lastLogin,
    required this.workspaceCount,
    this.subscriptionPlan,
    this.subscriptionStatus,
    required this.totalMessages,
    required this.isAdmin,
  });

  factory AdminUser.fromJson(Map<String, dynamic> json) =>
      _$AdminUserFromJson(json);

  Map<String, dynamic> toJson() => _$AdminUserToJson(this);

  String get displayText => displayName ?? email;
  bool get hasActiveSubscription => subscriptionStatus == 'active';
}
