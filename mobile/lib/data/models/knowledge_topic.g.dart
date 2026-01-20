// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'knowledge_topic.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

KnowledgeTopic _$KnowledgeTopicFromJson(Map<String, dynamic> json) =>
    KnowledgeTopic(
      id: json['id'] as String,
      title: json['title'] as String,
      content: json['content'] as String,
      contentType: json['content_type'] as String?,
      workspaceId: json['workspace_id'] as String,
      createdBy: json['created_by'] as String,
      creatorName: json['creator_name'] as String?,
      creatorAvatar: json['creator_avatar'] as String?,
      categoryId: json['category_id'] as String?,
      categoryName: json['category_name'] as String?,
      categoryColor: json['category_color'] as String?,
      categoryIcon: json['category_icon'] as String?,
      upvotesCount: (json['upvotes_count'] as num?)?.toInt() ?? 0,
      downvotesCount: (json['downvotes_count'] as num?)?.toInt() ?? 0,
      commentCount: (json['comment_count'] as num?)?.toInt() ?? 0,
      viewsCount: (json['views_count'] as num?)?.toInt() ?? 0,
      isLocked: json['is_locked'] as bool? ?? false,
      isPinned: json['is_pinned'] as bool? ?? false,
      isFeatured: json['is_featured'] as bool? ?? false,
      isArchived: json['is_archived'] as bool? ?? false,
      lockedBy: json['locked_by'] as String?,
      lockedAt: json['locked_at'] == null
          ? null
          : DateTime.parse(json['locked_at'] as String),
      pinnedBy: json['pinned_by'] as String?,
      pinnedAt: json['pinned_at'] == null
          ? null
          : DateTime.parse(json['pinned_at'] as String),
      userVote: json['user_vote'] as String?,
      userCanModerate: json['user_can_moderate'] as bool? ?? false,
      isOwner: json['is_owner'] as bool? ?? false,
      createdAt: DateTime.parse(json['created_at'] as String),
      updatedAt: json['updated_at'] == null
          ? null
          : DateTime.parse(json['updated_at'] as String),
      lastActivityAt: json['last_activity_at'] == null
          ? null
          : DateTime.parse(json['last_activity_at'] as String),
      sourceType: json['source_type'] as String?,
      sourceMessageId: json['source_message_id'] as String?,
      sourceThreadId: json['source_thread_id'] as String?,
      aiSummary: json['ai_summary'] as String?,
    );

Map<String, dynamic> _$KnowledgeTopicToJson(KnowledgeTopic instance) =>
    <String, dynamic>{
      'id': instance.id,
      'title': instance.title,
      'content': instance.content,
      'content_type': instance.contentType,
      'workspace_id': instance.workspaceId,
      'created_by': instance.createdBy,
      'creator_name': instance.creatorName,
      'creator_avatar': instance.creatorAvatar,
      'category_id': instance.categoryId,
      'category_name': instance.categoryName,
      'category_color': instance.categoryColor,
      'category_icon': instance.categoryIcon,
      'upvotes_count': instance.upvotesCount,
      'downvotes_count': instance.downvotesCount,
      'comment_count': instance.commentCount,
      'views_count': instance.viewsCount,
      'is_locked': instance.isLocked,
      'is_pinned': instance.isPinned,
      'is_featured': instance.isFeatured,
      'is_archived': instance.isArchived,
      'locked_by': instance.lockedBy,
      'locked_at': instance.lockedAt?.toIso8601String(),
      'pinned_by': instance.pinnedBy,
      'pinned_at': instance.pinnedAt?.toIso8601String(),
      'user_vote': instance.userVote,
      'user_can_moderate': instance.userCanModerate,
      'is_owner': instance.isOwner,
      'created_at': instance.createdAt.toIso8601String(),
      'updated_at': instance.updatedAt?.toIso8601String(),
      'last_activity_at': instance.lastActivityAt?.toIso8601String(),
      'source_type': instance.sourceType,
      'source_message_id': instance.sourceMessageId,
      'source_thread_id': instance.sourceThreadId,
      'ai_summary': instance.aiSummary,
    };

KnowledgeCategory _$KnowledgeCategoryFromJson(Map<String, dynamic> json) =>
    KnowledgeCategory(
      id: json['id'] as String,
      name: json['name'] as String,
      description: json['description'] as String?,
      color: json['color'] as String?,
      icon: json['icon'] as String?,
      itemCount: (json['item_count'] as num?)?.toInt() ?? 0,
      isActive: json['is_active'] as bool? ?? true,
    );

Map<String, dynamic> _$KnowledgeCategoryToJson(KnowledgeCategory instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'description': instance.description,
      'color': instance.color,
      'icon': instance.icon,
      'item_count': instance.itemCount,
      'is_active': instance.isActive,
    };
