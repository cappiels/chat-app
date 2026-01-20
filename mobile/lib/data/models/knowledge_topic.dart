import 'package:json_annotation/json_annotation.dart';

part 'knowledge_topic.g.dart';

@JsonSerializable()
class KnowledgeTopic {
  final String id;
  final String title;
  final String content;
  @JsonKey(name: 'content_type')
  final String? contentType;
  @JsonKey(name: 'workspace_id')
  final String workspaceId;
  @JsonKey(name: 'created_by')
  final String createdBy;
  @JsonKey(name: 'creator_name')
  final String? creatorName;
  @JsonKey(name: 'creator_avatar')
  final String? creatorAvatar;
  @JsonKey(name: 'category_id')
  final String? categoryId;
  @JsonKey(name: 'category_name')
  final String? categoryName;
  @JsonKey(name: 'category_color')
  final String? categoryColor;
  @JsonKey(name: 'category_icon')
  final String? categoryIcon;

  // Vote counts
  @JsonKey(name: 'upvotes_count')
  final int upvotesCount;
  @JsonKey(name: 'downvotes_count')
  final int downvotesCount;
  @JsonKey(name: 'comment_count')
  final int commentCount;
  @JsonKey(name: 'views_count')
  final int viewsCount;

  // Status flags
  @JsonKey(name: 'is_locked')
  final bool isLocked;
  @JsonKey(name: 'is_pinned')
  final bool isPinned;
  @JsonKey(name: 'is_featured')
  final bool isFeatured;
  @JsonKey(name: 'is_archived')
  final bool isArchived;

  // Lock/pin metadata
  @JsonKey(name: 'locked_by')
  final String? lockedBy;
  @JsonKey(name: 'locked_at')
  final DateTime? lockedAt;
  @JsonKey(name: 'pinned_by')
  final String? pinnedBy;
  @JsonKey(name: 'pinned_at')
  final DateTime? pinnedAt;

  // Current user context
  @JsonKey(name: 'user_vote')
  final String? userVote; // 'upvote', 'downvote', or null
  @JsonKey(name: 'user_can_moderate')
  final bool userCanModerate;
  @JsonKey(name: 'is_owner')
  final bool isOwner;

  // Timestamps
  @JsonKey(name: 'created_at')
  final DateTime createdAt;
  @JsonKey(name: 'updated_at')
  final DateTime? updatedAt;
  @JsonKey(name: 'last_activity_at')
  final DateTime? lastActivityAt;

  // Source tracking
  @JsonKey(name: 'source_type')
  final String? sourceType;
  @JsonKey(name: 'source_message_id')
  final String? sourceMessageId;
  @JsonKey(name: 'source_thread_id')
  final String? sourceThreadId;

  // AI-generated content
  @JsonKey(name: 'ai_summary')
  final String? aiSummary;

  const KnowledgeTopic({
    required this.id,
    required this.title,
    required this.content,
    this.contentType,
    required this.workspaceId,
    required this.createdBy,
    this.creatorName,
    this.creatorAvatar,
    this.categoryId,
    this.categoryName,
    this.categoryColor,
    this.categoryIcon,
    this.upvotesCount = 0,
    this.downvotesCount = 0,
    this.commentCount = 0,
    this.viewsCount = 0,
    this.isLocked = false,
    this.isPinned = false,
    this.isFeatured = false,
    this.isArchived = false,
    this.lockedBy,
    this.lockedAt,
    this.pinnedBy,
    this.pinnedAt,
    this.userVote,
    this.userCanModerate = false,
    this.isOwner = false,
    required this.createdAt,
    this.updatedAt,
    this.lastActivityAt,
    this.sourceType,
    this.sourceMessageId,
    this.sourceThreadId,
    this.aiSummary,
  });

  factory KnowledgeTopic.fromJson(Map<String, dynamic> json) =>
      _$KnowledgeTopicFromJson(json);

  Map<String, dynamic> toJson() => _$KnowledgeTopicToJson(this);

  int get score => upvotesCount - downvotesCount;

  KnowledgeTopic copyWith({
    String? id,
    String? title,
    String? content,
    String? contentType,
    String? workspaceId,
    String? createdBy,
    String? creatorName,
    String? creatorAvatar,
    String? categoryId,
    String? categoryName,
    String? categoryColor,
    String? categoryIcon,
    int? upvotesCount,
    int? downvotesCount,
    int? commentCount,
    int? viewsCount,
    bool? isLocked,
    bool? isPinned,
    bool? isFeatured,
    bool? isArchived,
    String? lockedBy,
    DateTime? lockedAt,
    String? pinnedBy,
    DateTime? pinnedAt,
    String? userVote,
    bool? userCanModerate,
    bool? isOwner,
    DateTime? createdAt,
    DateTime? updatedAt,
    DateTime? lastActivityAt,
    String? sourceType,
    String? sourceMessageId,
    String? sourceThreadId,
    String? aiSummary,
  }) {
    return KnowledgeTopic(
      id: id ?? this.id,
      title: title ?? this.title,
      content: content ?? this.content,
      contentType: contentType ?? this.contentType,
      workspaceId: workspaceId ?? this.workspaceId,
      createdBy: createdBy ?? this.createdBy,
      creatorName: creatorName ?? this.creatorName,
      creatorAvatar: creatorAvatar ?? this.creatorAvatar,
      categoryId: categoryId ?? this.categoryId,
      categoryName: categoryName ?? this.categoryName,
      categoryColor: categoryColor ?? this.categoryColor,
      categoryIcon: categoryIcon ?? this.categoryIcon,
      upvotesCount: upvotesCount ?? this.upvotesCount,
      downvotesCount: downvotesCount ?? this.downvotesCount,
      commentCount: commentCount ?? this.commentCount,
      viewsCount: viewsCount ?? this.viewsCount,
      isLocked: isLocked ?? this.isLocked,
      isPinned: isPinned ?? this.isPinned,
      isFeatured: isFeatured ?? this.isFeatured,
      isArchived: isArchived ?? this.isArchived,
      lockedBy: lockedBy ?? this.lockedBy,
      lockedAt: lockedAt ?? this.lockedAt,
      pinnedBy: pinnedBy ?? this.pinnedBy,
      pinnedAt: pinnedAt ?? this.pinnedAt,
      userVote: userVote,
      userCanModerate: userCanModerate ?? this.userCanModerate,
      isOwner: isOwner ?? this.isOwner,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      lastActivityAt: lastActivityAt ?? this.lastActivityAt,
      sourceType: sourceType ?? this.sourceType,
      sourceMessageId: sourceMessageId ?? this.sourceMessageId,
      sourceThreadId: sourceThreadId ?? this.sourceThreadId,
      aiSummary: aiSummary ?? this.aiSummary,
    );
  }
}

@JsonSerializable()
class KnowledgeCategory {
  final String id;
  final String name;
  final String? description;
  final String? color;
  final String? icon;
  @JsonKey(name: 'item_count')
  final int itemCount;
  @JsonKey(name: 'is_active')
  final bool isActive;

  const KnowledgeCategory({
    required this.id,
    required this.name,
    this.description,
    this.color,
    this.icon,
    this.itemCount = 0,
    this.isActive = true,
  });

  factory KnowledgeCategory.fromJson(Map<String, dynamic> json) =>
      _$KnowledgeCategoryFromJson(json);

  Map<String, dynamic> toJson() => _$KnowledgeCategoryToJson(this);
}
