// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'subscription.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SubscriptionPlan _$SubscriptionPlanFromJson(Map<String, dynamic> json) =>
    SubscriptionPlan(
      id: json['id'] as String,
      name: json['name'] as String,
      displayName: json['display_name'] as String,
      description: json['description'] as String,
      price: (json['price'] as num).toDouble(),
      currency: json['currency'] as String,
      interval: json['interval'] as String,
      features: json['features'] as Map<String, dynamic>,
      maxWorkspaces: (json['max_workspaces'] as num?)?.toInt(),
      maxUsersPerWorkspace: (json['max_users_per_workspace'] as num?)?.toInt(),
      maxChannelsPerWorkspace: (json['max_channels_per_workspace'] as num?)
          ?.toInt(),
      uploadLimitMb: (json['upload_limit_mb'] as num).toInt(),
      stripePriceId: json['stripe_price_id'] as String?,
      isActive: json['is_active'] as bool,
      createdAt: DateTime.parse(json['created_at'] as String),
    );

Map<String, dynamic> _$SubscriptionPlanToJson(SubscriptionPlan instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'display_name': instance.displayName,
      'description': instance.description,
      'price': instance.price,
      'currency': instance.currency,
      'interval': instance.interval,
      'features': instance.features,
      'max_workspaces': instance.maxWorkspaces,
      'max_users_per_workspace': instance.maxUsersPerWorkspace,
      'max_channels_per_workspace': instance.maxChannelsPerWorkspace,
      'upload_limit_mb': instance.uploadLimitMb,
      'stripe_price_id': instance.stripePriceId,
      'is_active': instance.isActive,
      'created_at': instance.createdAt.toIso8601String(),
    };

UserSubscription _$UserSubscriptionFromJson(Map<String, dynamic> json) =>
    UserSubscription(
      userId: json['user_id'] as String,
      planId: json['plan_id'] as String,
      planName: json['plan_name'] as String,
      planDisplayName: json['plan_display_name'] as String,
      status: json['status'] as String,
      stripeCustomerId: json['stripe_customer_id'] as String?,
      stripeSubscriptionId: json['stripe_subscription_id'] as String?,
      currentPeriodStart: json['current_period_start'] == null
          ? null
          : DateTime.parse(json['current_period_start'] as String),
      currentPeriodEnd: json['current_period_end'] == null
          ? null
          : DateTime.parse(json['current_period_end'] as String),
      cancelAtPeriodEnd: json['cancel_at_period_end'] as bool,
      features: json['features'] as Map<String, dynamic>,
      createdAt: DateTime.parse(json['created_at'] as String),
      updatedAt: DateTime.parse(json['updated_at'] as String),
    );

Map<String, dynamic> _$UserSubscriptionToJson(UserSubscription instance) =>
    <String, dynamic>{
      'user_id': instance.userId,
      'plan_id': instance.planId,
      'plan_name': instance.planName,
      'plan_display_name': instance.planDisplayName,
      'status': instance.status,
      'stripe_customer_id': instance.stripeCustomerId,
      'stripe_subscription_id': instance.stripeSubscriptionId,
      'current_period_start': instance.currentPeriodStart?.toIso8601String(),
      'current_period_end': instance.currentPeriodEnd?.toIso8601String(),
      'cancel_at_period_end': instance.cancelAtPeriodEnd,
      'features': instance.features,
      'created_at': instance.createdAt.toIso8601String(),
      'updated_at': instance.updatedAt.toIso8601String(),
    };

CheckoutSession _$CheckoutSessionFromJson(Map<String, dynamic> json) =>
    CheckoutSession(
      sessionId: json['session_id'] as String,
      checkoutUrl: json['checkout_url'] as String,
      successUrl: json['success_url'] as String,
      cancelUrl: json['cancel_url'] as String,
      expiresAt: DateTime.parse(json['expires_at'] as String),
    );

Map<String, dynamic> _$CheckoutSessionToJson(CheckoutSession instance) =>
    <String, dynamic>{
      'session_id': instance.sessionId,
      'checkout_url': instance.checkoutUrl,
      'success_url': instance.successUrl,
      'cancel_url': instance.cancelUrl,
      'expires_at': instance.expiresAt.toIso8601String(),
    };

AdminStats _$AdminStatsFromJson(Map<String, dynamic> json) => AdminStats(
  totalUsers: (json['total_users'] as num).toInt(),
  activeUsers: (json['active_users'] as num).toInt(),
  totalWorkspaces: (json['total_workspaces'] as num).toInt(),
  activeSubscriptions: (json['active_subscriptions'] as num).toInt(),
  monthlyRevenue: (json['monthly_revenue'] as num).toDouble(),
  subscriptionBreakdown: Map<String, int>.from(
    json['subscription_breakdown'] as Map,
  ),
  userGrowth: (json['user_growth'] as List<dynamic>)
      .map((e) => UserGrowthData.fromJson(e as Map<String, dynamic>))
      .toList(),
  generatedAt: DateTime.parse(json['generated_at'] as String),
);

Map<String, dynamic> _$AdminStatsToJson(AdminStats instance) =>
    <String, dynamic>{
      'total_users': instance.totalUsers,
      'active_users': instance.activeUsers,
      'total_workspaces': instance.totalWorkspaces,
      'active_subscriptions': instance.activeSubscriptions,
      'monthly_revenue': instance.monthlyRevenue,
      'subscription_breakdown': instance.subscriptionBreakdown,
      'user_growth': instance.userGrowth,
      'generated_at': instance.generatedAt.toIso8601String(),
    };

UserGrowthData _$UserGrowthDataFromJson(Map<String, dynamic> json) =>
    UserGrowthData(
      period: json['period'] as String,
      newUsers: (json['new_users'] as num).toInt(),
      totalUsers: (json['total_users'] as num).toInt(),
    );

Map<String, dynamic> _$UserGrowthDataToJson(UserGrowthData instance) =>
    <String, dynamic>{
      'period': instance.period,
      'new_users': instance.newUsers,
      'total_users': instance.totalUsers,
    };

AdminWorkspace _$AdminWorkspaceFromJson(Map<String, dynamic> json) =>
    AdminWorkspace(
      id: json['id'] as String,
      name: json['name'] as String,
      ownerId: json['owner_id'] as String,
      ownerEmail: json['owner_email'] as String,
      memberCount: (json['member_count'] as num).toInt(),
      channelCount: (json['channel_count'] as num).toInt(),
      createdAt: DateTime.parse(json['created_at'] as String),
      lastActivity: json['last_activity'] == null
          ? null
          : DateTime.parse(json['last_activity'] as String),
      subscriptionPlan: json['subscription_plan'] as String?,
    );

Map<String, dynamic> _$AdminWorkspaceToJson(AdminWorkspace instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'owner_id': instance.ownerId,
      'owner_email': instance.ownerEmail,
      'member_count': instance.memberCount,
      'channel_count': instance.channelCount,
      'created_at': instance.createdAt.toIso8601String(),
      'last_activity': instance.lastActivity?.toIso8601String(),
      'subscription_plan': instance.subscriptionPlan,
    };

AdminUser _$AdminUserFromJson(Map<String, dynamic> json) => AdminUser(
  id: json['id'] as String,
  email: json['email'] as String,
  displayName: json['display_name'] as String?,
  createdAt: DateTime.parse(json['created_at'] as String),
  lastLogin: json['last_login'] == null
      ? null
      : DateTime.parse(json['last_login'] as String),
  workspaceCount: (json['workspace_count'] as num).toInt(),
  subscriptionPlan: json['subscription_plan'] as String?,
  subscriptionStatus: json['subscription_status'] as String?,
  totalMessages: (json['total_messages'] as num).toInt(),
  isAdmin: json['is_admin'] as bool,
);

Map<String, dynamic> _$AdminUserToJson(AdminUser instance) => <String, dynamic>{
  'id': instance.id,
  'email': instance.email,
  'display_name': instance.displayName,
  'created_at': instance.createdAt.toIso8601String(),
  'last_login': instance.lastLogin?.toIso8601String(),
  'workspace_count': instance.workspaceCount,
  'subscription_plan': instance.subscriptionPlan,
  'subscription_status': instance.subscriptionStatus,
  'total_messages': instance.totalMessages,
  'is_admin': instance.isAdmin,
};
