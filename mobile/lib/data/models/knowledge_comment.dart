import 'package:json_annotation/json_annotation.dart';

part 'knowledge_comment.g.dart';

@JsonSerializable()
class KnowledgeComment {
  final String id;
  @JsonKey(name: 'knowledge_item_id')
  final String knowledgeItemId;
  @JsonKey(name: 'user_id')
  final String userId;
  @JsonKey(name: 'user_name')
  final String? userName;
  @JsonKey(name: 'user_avatar')
  final String? userAvatar;
  @JsonKey(name: 'parent_comment_id')
  final String? parentCommentId;
  final String content;

  // Vote counts
  @JsonKey(name: 'upvotes_count')
  final int upvotesCount;
  @JsonKey(name: 'downvotes_count')
  final int downvotesCount;

  // Suggestion fields
  @JsonKey(name: 'is_suggestion')
  final bool isSuggestion;
  @JsonKey(name: 'suggestion_status')
  final String? suggestionStatus; // 'pending', 'accepted', 'rejected'

  // Current user context
  @JsonKey(name: 'user_vote')
  final String? userVote; // 'upvote', 'downvote', or null
  @JsonKey(name: 'is_owner')
  final bool isOwner;

  // Timestamps
  @JsonKey(name: 'created_at')
  final DateTime createdAt;
  @JsonKey(name: 'updated_at')
  final DateTime? updatedAt;

  // Nested replies (populated by frontend)
  @JsonKey(includeFromJson: false, includeToJson: false)
  final List<KnowledgeComment> replies;

  const KnowledgeComment({
    required this.id,
    required this.knowledgeItemId,
    required this.userId,
    this.userName,
    this.userAvatar,
    this.parentCommentId,
    required this.content,
    this.upvotesCount = 0,
    this.downvotesCount = 0,
    this.isSuggestion = false,
    this.suggestionStatus,
    this.userVote,
    this.isOwner = false,
    required this.createdAt,
    this.updatedAt,
    this.replies = const [],
  });

  factory KnowledgeComment.fromJson(Map<String, dynamic> json) {
    final comment = _$KnowledgeCommentFromJson(json);

    // Parse nested replies if present
    if (json['replies'] != null && json['replies'] is List) {
      final replies = (json['replies'] as List)
          .map((r) => KnowledgeComment.fromJson(r as Map<String, dynamic>))
          .toList();
      return comment.copyWith(replies: replies);
    }

    return comment;
  }

  Map<String, dynamic> toJson() => _$KnowledgeCommentToJson(this);

  int get score => upvotesCount - downvotesCount;

  bool get isEdited => updatedAt != null && updatedAt != createdAt;

  KnowledgeComment copyWith({
    String? id,
    String? knowledgeItemId,
    String? userId,
    String? userName,
    String? userAvatar,
    String? parentCommentId,
    String? content,
    int? upvotesCount,
    int? downvotesCount,
    bool? isSuggestion,
    String? suggestionStatus,
    String? userVote,
    bool? isOwner,
    DateTime? createdAt,
    DateTime? updatedAt,
    List<KnowledgeComment>? replies,
  }) {
    return KnowledgeComment(
      id: id ?? this.id,
      knowledgeItemId: knowledgeItemId ?? this.knowledgeItemId,
      userId: userId ?? this.userId,
      userName: userName ?? this.userName,
      userAvatar: userAvatar ?? this.userAvatar,
      parentCommentId: parentCommentId ?? this.parentCommentId,
      content: content ?? this.content,
      upvotesCount: upvotesCount ?? this.upvotesCount,
      downvotesCount: downvotesCount ?? this.downvotesCount,
      isSuggestion: isSuggestion ?? this.isSuggestion,
      suggestionStatus: suggestionStatus ?? this.suggestionStatus,
      userVote: userVote,
      isOwner: isOwner ?? this.isOwner,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      replies: replies ?? this.replies,
    );
  }
}
