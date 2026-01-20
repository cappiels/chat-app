// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'knowledge_comment.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

KnowledgeComment _$KnowledgeCommentFromJson(Map<String, dynamic> json) =>
    KnowledgeComment(
      id: json['id'] as String,
      knowledgeItemId: json['knowledge_item_id'] as String,
      userId: json['user_id'] as String,
      userName: json['user_name'] as String?,
      userAvatar: json['user_avatar'] as String?,
      parentCommentId: json['parent_comment_id'] as String?,
      content: json['content'] as String,
      upvotesCount: (json['upvotes_count'] as num?)?.toInt() ?? 0,
      downvotesCount: (json['downvotes_count'] as num?)?.toInt() ?? 0,
      isSuggestion: json['is_suggestion'] as bool? ?? false,
      suggestionStatus: json['suggestion_status'] as String?,
      userVote: json['user_vote'] as String?,
      isOwner: json['is_owner'] as bool? ?? false,
      createdAt: DateTime.parse(json['created_at'] as String),
      updatedAt: json['updated_at'] == null
          ? null
          : DateTime.parse(json['updated_at'] as String),
    );

Map<String, dynamic> _$KnowledgeCommentToJson(KnowledgeComment instance) =>
    <String, dynamic>{
      'id': instance.id,
      'knowledge_item_id': instance.knowledgeItemId,
      'user_id': instance.userId,
      'user_name': instance.userName,
      'user_avatar': instance.userAvatar,
      'parent_comment_id': instance.parentCommentId,
      'content': instance.content,
      'upvotes_count': instance.upvotesCount,
      'downvotes_count': instance.downvotesCount,
      'is_suggestion': instance.isSuggestion,
      'suggestion_status': instance.suggestionStatus,
      'user_vote': instance.userVote,
      'is_owner': instance.isOwner,
      'created_at': instance.createdAt.toIso8601String(),
      'updated_at': instance.updatedAt?.toIso8601String(),
    };
