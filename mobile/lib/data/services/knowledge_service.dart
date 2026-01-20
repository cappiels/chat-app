import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/knowledge_topic.dart';
import '../models/knowledge_comment.dart';
import 'http_client.dart';

// Provider for knowledge service
final knowledgeServiceProvider = Provider<KnowledgeService>((ref) {
  final httpClient = ref.read(httpClientProvider);
  return KnowledgeService(httpClient);
});

class KnowledgeService {
  final HttpClient _httpClient;

  KnowledgeService(this._httpClient);

  // ============================================
  // TOPICS
  // ============================================

  /// Get list of topics with optional filtering
  Future<TopicsResponse> getTopics(
    String workspaceId, {
    String? category,
    String? search,
    String sortBy = 'last_activity_at',
    String sortOrder = 'DESC',
    int limit = 50,
    int offset = 0,
  }) async {
    final queryParams = <String, dynamic>{
      'sort_by': sortBy,
      'sort_order': sortOrder,
      'limit': limit,
      'offset': offset,
    };

    if (category != null && category != 'all') {
      queryParams['category'] = category;
    }
    if (search != null && search.isNotEmpty) {
      queryParams['search'] = search;
    }

    final response = await _httpClient.get(
      '/knowledge/workspaces/$workspaceId/topics',
      queryParameters: queryParams,
    );

    final data = response.data as Map<String, dynamic>;
    final topics = (data['topics'] as List)
        .map((t) => KnowledgeTopic.fromJson(t as Map<String, dynamic>))
        .toList();

    return TopicsResponse(
      topics: topics,
      total: data['total'] as int? ?? topics.length,
    );
  }

  /// Get single topic by ID
  Future<KnowledgeTopic> getTopic(String workspaceId, String topicId) async {
    final response = await _httpClient.get(
      '/knowledge/workspaces/$workspaceId/topics/$topicId',
    );

    final data = response.data as Map<String, dynamic>;
    return KnowledgeTopic.fromJson(data['topic'] as Map<String, dynamic>);
  }

  /// Lock or unlock a topic
  Future<KnowledgeTopic> lockTopic(
    String workspaceId,
    String topicId,
    bool locked,
  ) async {
    final response = await _httpClient.post(
      '/knowledge/workspaces/$workspaceId/topics/$topicId/lock',
      data: {'locked': locked},
    );

    final data = response.data as Map<String, dynamic>;
    return KnowledgeTopic.fromJson(data['topic'] as Map<String, dynamic>);
  }

  /// Pin or unpin a topic
  Future<KnowledgeTopic> pinTopic(
    String workspaceId,
    String topicId,
    bool pinned,
  ) async {
    final response = await _httpClient.post(
      '/knowledge/workspaces/$workspaceId/topics/$topicId/pin',
      data: {'pinned': pinned},
    );

    final data = response.data as Map<String, dynamic>;
    return KnowledgeTopic.fromJson(data['topic'] as Map<String, dynamic>);
  }

  /// Create a new topic (Save to KB)
  Future<KnowledgeTopic> createTopic(
    String workspaceId, {
    required String title,
    required String content,
    String? categoryId,
    String? sourceType, // 'message', 'task', 'calendar'
    String? sourceId,
    Map<String, dynamic>? metadata,
  }) async {
    final response = await _httpClient.post(
      '/knowledge/workspaces/$workspaceId/topics',
      data: {
        'title': title,
        'content': content,
        if (categoryId != null) 'category_id': categoryId,
        if (sourceType != null) 'source_type': sourceType,
        if (sourceId != null) 'source_id': sourceId,
        if (metadata != null) 'metadata': metadata,
      },
    );

    final data = response.data as Map<String, dynamic>;
    return KnowledgeTopic.fromJson(data['topic'] as Map<String, dynamic>);
  }

  /// Delete a topic
  Future<void> deleteTopic(String workspaceId, String topicId) async {
    await _httpClient.delete(
      '/knowledge/workspaces/$workspaceId/topics/$topicId',
    );
  }

  // ============================================
  // VOTING
  // ============================================

  /// Vote on a topic
  Future<VoteResponse> voteOnTopic(
    String workspaceId,
    String topicId,
    String voteType, // 'upvote' or 'downvote'
  ) async {
    final response = await _httpClient.post(
      '/knowledge/workspaces/$workspaceId/topics/$topicId/vote',
      data: {'vote_type': voteType},
    );

    final data = response.data as Map<String, dynamic>;
    return VoteResponse(
      upvotesCount: data['upvotes_count'] as int,
      downvotesCount: data['downvotes_count'] as int,
    );
  }

  /// Remove vote from a topic
  Future<VoteResponse> removeTopicVote(
    String workspaceId,
    String topicId,
  ) async {
    final response = await _httpClient.delete(
      '/knowledge/workspaces/$workspaceId/topics/$topicId/vote',
    );

    final data = response.data as Map<String, dynamic>;
    return VoteResponse(
      upvotesCount: data['upvotes_count'] as int? ?? 0,
      downvotesCount: data['downvotes_count'] as int? ?? 0,
    );
  }

  /// Vote on a comment
  Future<VoteResponse> voteOnComment(
    String workspaceId,
    String commentId,
    String voteType,
  ) async {
    final response = await _httpClient.post(
      '/knowledge/workspaces/$workspaceId/comments/$commentId/vote',
      data: {'vote_type': voteType},
    );

    final data = response.data as Map<String, dynamic>;
    return VoteResponse(
      upvotesCount: data['upvotes_count'] as int,
      downvotesCount: data['downvotes_count'] as int,
    );
  }

  /// Remove vote from a comment
  Future<VoteResponse> removeCommentVote(
    String workspaceId,
    String commentId,
  ) async {
    final response = await _httpClient.delete(
      '/knowledge/workspaces/$workspaceId/comments/$commentId/vote',
    );

    final data = response.data as Map<String, dynamic>;
    return VoteResponse(
      upvotesCount: data['upvotes_count'] as int? ?? 0,
      downvotesCount: data['downvotes_count'] as int? ?? 0,
    );
  }

  // ============================================
  // COMMENTS
  // ============================================

  /// Get comments for a topic
  Future<List<KnowledgeComment>> getComments(
    String workspaceId,
    String topicId,
  ) async {
    final response = await _httpClient.get(
      '/knowledge/workspaces/$workspaceId/topics/$topicId/comments',
    );

    final data = response.data as Map<String, dynamic>;
    return (data['comments'] as List)
        .map((c) => KnowledgeComment.fromJson(c as Map<String, dynamic>))
        .toList();
  }

  /// Add a comment to a topic
  Future<KnowledgeComment> addComment(
    String workspaceId,
    String topicId,
    String content, {
    String? parentCommentId,
  }) async {
    final response = await _httpClient.post(
      '/knowledge/workspaces/$workspaceId/topics/$topicId/comments',
      data: {
        'content': content,
        if (parentCommentId != null) 'parent_comment_id': parentCommentId,
      },
    );

    final data = response.data as Map<String, dynamic>;
    return KnowledgeComment.fromJson(data['comment'] as Map<String, dynamic>);
  }

  /// Edit a comment
  Future<KnowledgeComment> editComment(
    String workspaceId,
    String commentId,
    String content,
  ) async {
    final response = await _httpClient.put(
      '/knowledge/workspaces/$workspaceId/comments/$commentId',
      data: {'content': content},
    );

    final data = response.data as Map<String, dynamic>;
    return KnowledgeComment.fromJson(data['comment'] as Map<String, dynamic>);
  }

  /// Delete a comment
  Future<void> deleteComment(String workspaceId, String commentId) async {
    await _httpClient.delete(
      '/knowledge/workspaces/$workspaceId/comments/$commentId',
    );
  }

  // ============================================
  // CATEGORIES
  // ============================================

  /// Get all categories for a workspace
  Future<List<KnowledgeCategory>> getCategories(String workspaceId) async {
    final response = await _httpClient.get(
      '/knowledge/workspaces/$workspaceId/categories',
    );

    final data = response.data as Map<String, dynamic>;
    return (data['data'] as List)
        .map((c) => KnowledgeCategory.fromJson(c as Map<String, dynamic>))
        .toList();
  }

  // ============================================
  // MODERATION
  // ============================================

  /// Get user's moderation permissions
  Future<ModerationPermissions> getModerationPermissions(
    String workspaceId,
  ) async {
    final response = await _httpClient.get(
      '/knowledge/workspaces/$workspaceId/moderation/permissions',
    );

    final data = response.data as Map<String, dynamic>;
    return ModerationPermissions.fromJson(data);
  }
}

// Response types
class TopicsResponse {
  final List<KnowledgeTopic> topics;
  final int total;

  TopicsResponse({required this.topics, required this.total});
}

class VoteResponse {
  final int upvotesCount;
  final int downvotesCount;

  VoteResponse({required this.upvotesCount, required this.downvotesCount});

  int get score => upvotesCount - downvotesCount;
}

class ModerationPermissions {
  final bool isWorkspaceAdmin;
  final bool canModerateAll;
  final List<CategoryModeration> categoryModerations;

  ModerationPermissions({
    required this.isWorkspaceAdmin,
    required this.canModerateAll,
    required this.categoryModerations,
  });

  factory ModerationPermissions.fromJson(Map<String, dynamic> json) {
    return ModerationPermissions(
      isWorkspaceAdmin: json['is_workspace_admin'] as bool? ?? false,
      canModerateAll: json['can_moderate_all'] as bool? ?? false,
      categoryModerations: (json['category_moderations'] as List?)
              ?.map((c) =>
                  CategoryModeration.fromJson(c as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }
}

class CategoryModeration {
  final String categoryId;
  final String categoryName;
  final String? categoryColor;
  final String adminLevel;

  CategoryModeration({
    required this.categoryId,
    required this.categoryName,
    this.categoryColor,
    required this.adminLevel,
  });

  factory CategoryModeration.fromJson(Map<String, dynamic> json) {
    return CategoryModeration(
      categoryId: json['category_id'] as String,
      categoryName: json['category_name'] as String,
      categoryColor: json['category_color'] as String?,
      adminLevel: json['admin_level'] as String,
    );
  }
}
