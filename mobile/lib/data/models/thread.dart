import 'package:json_annotation/json_annotation.dart';

part 'thread.g.dart';

@JsonSerializable()
class Thread {
  final String id;
  final String name;
  final String? description;
  final String type; // 'channel' or 'dm'
  @JsonKey(name: 'workspace_id')
  final String? workspaceId;
  @JsonKey(name: 'is_private')
  final bool isPrivate;
  @JsonKey(name: 'created_at')
  final DateTime createdAt;
  @JsonKey(name: 'updated_at')
  final DateTime updatedAt;
  @JsonKey(name: 'member_count', fromJson: _toInt, toJson: _fromInt)
  final int memberCount;
  @JsonKey(name: 'unread_count', fromJson: _toInt, toJson: _fromInt)
  final int unreadCount;
  @JsonKey(name: 'mention_count', fromJson: _toInt, toJson: _fromInt)
  final int mentionCount;
  @JsonKey(name: 'last_message')
  final LastMessage? lastMessage;

  // Local UI state
  @JsonKey(includeFromJson: false, includeToJson: false)
  final bool isJoined;
  @JsonKey(includeFromJson: false, includeToJson: false)
  final bool isActive;

  const Thread({
    required this.id,
    required this.name,
    this.description,
    required this.type,
    this.workspaceId,
    this.isPrivate = false,
    required this.createdAt,
    required this.updatedAt,
    this.memberCount = 0,
    this.unreadCount = 0,
    this.mentionCount = 0,
    this.lastMessage,
    this.isJoined = false,
    this.isActive = false,
  });

  factory Thread.fromJson(Map<String, dynamic> json) => _$ThreadFromJson(json);
  Map<String, dynamic> toJson() => _$ThreadToJson(this);

  Thread copyWith({
    String? id,
    String? name,
    String? description,
    String? type,
    String? workspaceId,
    bool? isPrivate,
    DateTime? createdAt,
    DateTime? updatedAt,
    int? memberCount,
    int? unreadCount,
    int? mentionCount,
    LastMessage? lastMessage,
    bool? isJoined,
    bool? isActive,
  }) {
    return Thread(
      id: id ?? this.id,
      name: name ?? this.name,
      description: description ?? this.description,
      type: type ?? this.type,
      workspaceId: workspaceId ?? this.workspaceId,
      isPrivate: isPrivate ?? this.isPrivate,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      memberCount: memberCount ?? this.memberCount,
      unreadCount: unreadCount ?? this.unreadCount,
      mentionCount: mentionCount ?? this.mentionCount,
      lastMessage: lastMessage ?? this.lastMessage,
      isJoined: isJoined ?? this.isJoined,
      isActive: isActive ?? this.isActive,
    );
  }

  // Helper getters
  bool get isChannel => type == 'channel';
  bool get isDM => type == 'dm';
  bool get hasUnread => unreadCount > 0;
  bool get hasMentions => mentionCount > 0;
  bool get isPublicChannel => isChannel && !isPrivate;
  bool get isPrivateChannel => isChannel && isPrivate;

  String get displayName {
    if (isDM && name.isEmpty) {
      return 'Direct Message';
    }
    return name;
  }

  String get threadPrefix {
    if (isPrivateChannel) return '🔒';
    if (isDM) return '💬';
    return '#';
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Thread &&
          runtimeType == other.runtimeType &&
          id == other.id;

  @override
  int get hashCode => id.hashCode;
}

@JsonSerializable()
class LastMessage {
  final String id;
  final String content;
  @JsonKey(name: 'sender_name')
  final String senderName;
  @JsonKey(name: 'created_at')
  final DateTime createdAt;
  @JsonKey(name: 'message_type')
  final String? messageType;

  const LastMessage({
    required this.id,
    required this.content,
    required this.senderName,
    required this.createdAt,
    this.messageType,
  });

  factory LastMessage.fromJson(Map<String, dynamic> json) => _$LastMessageFromJson(json);
  Map<String, dynamic> toJson() => _$LastMessageToJson(this);

  String get previewContent {
    if (messageType == 'file') {
      return '📎 Shared a file';
    }
    if (content.length > 50) {
      return '${content.substring(0, 50)}...';
    }
    return content;
  }

  String get timeAgo {
    final now = DateTime.now();
    final difference = now.difference(createdAt);

    if (difference.inDays > 0) {
      return '${difference.inDays}d';
    } else if (difference.inHours > 0) {
      return '${difference.inHours}h';
    } else if (difference.inMinutes > 0) {
      return '${difference.inMinutes}m';
    } else {
      return 'now';
    }
  }
}

enum ThreadType {
  channel,
  dm,
  group,
}

// Helper functions for JSON conversion
int _toInt(dynamic value) {
  if (value == null) return 0;
  if (value is int) return value;
  if (value is double) return value.toInt();
  if (value is String) return int.tryParse(value) ?? 0;
  return 0;
}

int? _fromInt(int? value) => value;

extension ThreadTypeExtension on ThreadType {
  String get value {
    switch (this) {
      case ThreadType.channel:
        return 'channel';
      case ThreadType.dm:
        return 'dm';
      case ThreadType.group:
        return 'group';
    }
  }

  static ThreadType fromString(String value) {
    switch (value.toLowerCase()) {
      case 'channel':
        return ThreadType.channel;
      case 'dm':
        return ThreadType.dm;
      case 'group':
        return ThreadType.group;
      default:
        return ThreadType.channel;
    }
  }
}
