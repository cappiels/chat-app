import 'package:dio/dio.dart';
import '../models/message.dart';
import '../models/thread.dart';
import '../models/attachment.dart';
import '../models/reaction.dart';
import 'http_client.dart';

class MessageService {
  static final MessageService _instance = MessageService._internal();
  factory MessageService() => _instance;
  MessageService._internal();

  final HttpClient _httpClient = HttpClient();

  /// Get messages for a thread with pagination and filters
  Future<MessageResponse> getMessages({
    required String workspaceId,
    required String threadId,
    int limit = 50,
    int offset = 0,
    String? search,
    DateTime? before,
    DateTime? after,
    bool pinnedOnly = false,
    String messageType = 'all',
  }) async {
    try {
      final queryParams = <String, dynamic>{
        'limit': limit,
        'offset': offset,
        if (search != null) 'search': search,
        if (before != null) 'before': before.toIso8601String(),
        if (after != null) 'after': after.toIso8601String(),
        'pinned_only': pinnedOnly,
        'message_type': messageType,
      };

      final response = await _httpClient.get(
        '/api/workspaces/$workspaceId/threads/$threadId/messages',
        queryParameters: queryParams,
      );

      return MessageResponse.fromJson(response.data);
    } on DioException catch (e) {
      throw MessageServiceException(
        'Failed to load messages: ${e.message}',
        statusCode: e.response?.statusCode,
      );
    }
  }

  /// Send a new message
  Future<Message> sendMessage({
    required String workspaceId,
    required String threadId,
    required String content,
    String messageType = 'text',
    String? parentMessageId,
    List<Map<String, dynamic>>? mentions,
    List<Map<String, dynamic>>? attachments,
  }) async {
    try {
      final requestData = {
        'content': content,
        'message_type': messageType,
        if (parentMessageId != null) 'parent_message_id': parentMessageId,
        if (mentions != null) 'mentions': mentions,
        if (attachments != null) 'attachments': attachments,
      };

      final response = await _httpClient.post(
        '/api/workspaces/$workspaceId/threads/$threadId/messages',
        data: requestData,
      );

      return Message.fromJson(response.data['data']);
    } on DioException catch (e) {
      throw MessageServiceException(
        'Failed to send message: ${e.message}',
        statusCode: e.response?.statusCode,
      );
    }
  }

  /// Edit an existing message
  Future<Message> editMessage({
    required String workspaceId,
    required String threadId,
    required String messageId,
    required String content,
    String? editReason,
  }) async {
    try {
      final requestData = {
        'content': content,
        if (editReason != null) 'edit_reason': editReason,
      };

      final response = await _httpClient.put(
        '/api/workspaces/$workspaceId/threads/$threadId/messages/$messageId',
        data: requestData,
      );

      return Message.fromJson(response.data['data']);
    } on DioException catch (e) {
      throw MessageServiceException(
        'Failed to edit message: ${e.message}',
        statusCode: e.response?.statusCode,
      );
    }
  }

  /// Delete a message (soft delete)
  Future<void> deleteMessage({
    required String workspaceId,
    required String threadId,
    required String messageId,
  }) async {
    try {
      await _httpClient.delete(
        '/api/workspaces/$workspaceId/threads/$threadId/messages/$messageId',
      );
    } on DioException catch (e) {
      throw MessageServiceException(
        'Failed to delete message: ${e.message}',
        statusCode: e.response?.statusCode,
      );
    }
  }

  /// Add reaction to a message
  Future<ReactionResponse> addReaction({
    required String workspaceId,
    required String threadId,
    required String messageId,
    required String emoji,
  }) async {
    try {
      final response = await _httpClient.post(
        '/api/workspaces/$workspaceId/threads/$threadId/messages/$messageId/reactions',
        data: {'emoji': emoji},
      );

      return ReactionResponse.fromJson(response.data);
    } on DioException catch (e) {
      throw MessageServiceException(
        'Failed to add reaction: ${e.message}',
        statusCode: e.response?.statusCode,
      );
    }
  }

  /// Remove reaction from a message
  Future<ReactionResponse> removeReaction({
    required String workspaceId,
    required String threadId,
    required String messageId,
    required String emoji,
  }) async {
    try {
      final encodedEmoji = Uri.encodeComponent(emoji);
      final response = await _httpClient.delete(
        '/api/workspaces/$workspaceId/threads/$threadId/messages/$messageId/reactions/$encodedEmoji',
      );

      return ReactionResponse.fromJson(response.data);
    } on DioException catch (e) {
      throw MessageServiceException(
        'Failed to remove reaction: ${e.message}',
        statusCode: e.response?.statusCode,
      );
    }
  }

  /// Upload files for message attachments
  Future<List<Attachment>> uploadFiles({
    required List<String> filePaths,
    required List<String> fileNames,
    Function(int, double)? onProgress,
  }) async {
    try {
      final formData = FormData();
      
      for (int i = 0; i < filePaths.length; i++) {
        formData.files.add(
          MapEntry(
            'files',
            await MultipartFile.fromFile(
              filePaths[i],
              filename: fileNames[i],
            ),
          ),
        );
      }

      // Use HttpClient without progress for now (can be enhanced later)
      final response = await _httpClient.post(
        '/api/upload/files',
        data: formData,
      );

      final filesData = response.data['files'] as List;
      return filesData.map((fileData) => Attachment.fromJson(fileData)).toList();
    } on DioException catch (e) {
      throw MessageServiceException(
        'Failed to upload files: ${e.message}',
        statusCode: e.response?.statusCode,
      );
    }
  }

  /// Get threads for a workspace
  Future<List<Thread>> getThreads({
    required String workspaceId,
    String? search,
    String? type, // 'channel' or 'dm'
  }) async {
    try {
      final queryParams = <String, dynamic>{
        if (search != null) 'search': search,
        if (type != null) 'type': type,
      };

      final response = await _httpClient.get(
        '/api/workspaces/$workspaceId/threads',
        queryParameters: queryParams,
      );

      final threadsData = response.data['threads'] as List;
      return threadsData.map((threadData) => Thread.fromJson(threadData)).toList();
    } on DioException catch (e) {
      throw MessageServiceException(
        'Failed to load threads: ${e.message}',
        statusCode: e.response?.statusCode,
      );
    }
  }

  /// Join a thread
  Future<void> joinThread({
    required String workspaceId,
    required String threadId,
  }) async {
    try {
      await _httpClient.post(
        '/api/workspaces/$workspaceId/threads/$threadId/join',
      );
    } on DioException catch (e) {
      throw MessageServiceException(
        'Failed to join thread: ${e.message}',
        statusCode: e.response?.statusCode,
      );
    }
  }

  /// Leave a thread
  Future<void> leaveThread({
    required String workspaceId,
    required String threadId,
  }) async {
    try {
      await _httpClient.post(
        '/api/workspaces/$workspaceId/threads/$threadId/leave',
      );
    } on DioException catch (e) {
      throw MessageServiceException(
        'Failed to leave thread: ${e.message}',
        statusCode: e.response?.statusCode,
      );
    }
  }

  /// Mark messages as read
  Future<void> markMessagesAsRead({
    required String workspaceId,
    required String threadId,
    String? messageId,
  }) async {
    try {
      await _httpClient.post(
        '/api/workspaces/$workspaceId/threads/$threadId/read',
        data: {
          if (messageId != null) 'message_id': messageId,
        },
      );
    } on DioException catch (e) {
      throw MessageServiceException(
        'Failed to mark messages as read: ${e.message}',
        statusCode: e.response?.statusCode,
      );
    }
  }
}

// Response models
class MessageResponse {
  final List<Message> messages;
  final MessagePagination pagination;
  final MessageFilters filters;

  const MessageResponse({
    required this.messages,
    required this.pagination,
    required this.filters,
  });

  factory MessageResponse.fromJson(Map<String, dynamic> json) {
    return MessageResponse(
      messages: (json['messages'] as List)
          .map((messageJson) => Message.fromJson(messageJson))
          .toList(),
      pagination: MessagePagination.fromJson(json['pagination']),
      filters: MessageFilters.fromJson(json['filters']),
    );
  }
}

class MessagePagination {
  final int total;
  final int limit;
  final int offset;
  final bool hasMore;

  const MessagePagination({
    required this.total,
    required this.limit,
    required this.offset,
    required this.hasMore,
  });

  factory MessagePagination.fromJson(Map<String, dynamic> json) {
    return MessagePagination(
      total: json['total'],
      limit: json['limit'],
      offset: json['offset'],
      hasMore: json['has_more'],
    );
  }
}

class MessageFilters {
  final String? search;
  final DateTime? before;
  final DateTime? after;
  final bool pinnedOnly;
  final String messageType;

  const MessageFilters({
    this.search,
    this.before,
    this.after,
    required this.pinnedOnly,
    required this.messageType,
  });

  factory MessageFilters.fromJson(Map<String, dynamic> json) {
    return MessageFilters(
      search: json['search'],
      before: json['before'] != null ? DateTime.parse(json['before']) : null,
      after: json['after'] != null ? DateTime.parse(json['after']) : null,
      pinnedOnly: json['pinned_only'],
      messageType: json['message_type'],
    );
  }
}

class ReactionResponse {
  final String message;
  final bool added;
  final List<Reaction> reactions;

  const ReactionResponse({
    required this.message,
    required this.added,
    required this.reactions,
  });

  factory ReactionResponse.fromJson(Map<String, dynamic> json) {
    return ReactionResponse(
      message: json['message'],
      added: json['added'] ?? false,
      reactions: (json['reactions'] as List)
          .map((reactionJson) => Reaction.fromJson(reactionJson))
          .toList(),
    );
  }
}

class MessageServiceException implements Exception {
  final String message;
  final int? statusCode;

  const MessageServiceException(this.message, {this.statusCode});

  @override
  String toString() => 'MessageServiceException: $message (Status: $statusCode)';
}
