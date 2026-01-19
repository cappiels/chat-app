import 'package:json_annotation/json_annotation.dart';
import 'attachment.dart';
import 'reaction.dart';
import 'mention.dart';

part 'message.g.dart';

// Custom converter to handle both String and int from backend
class FlexibleIntConverter implements JsonConverter<int, dynamic> {
  const FlexibleIntConverter();

  @override
  int fromJson(dynamic value) {
    if (value == null) return 0;
    if (value is int) return value;
    if (value is String) return int.tryParse(value) ?? 0;
    if (value is double) return value.toInt();
    return 0;
  }

  @override
  dynamic toJson(int value) => value;
}

@JsonSerializable()
class Message {
  final String id;
  final String content;
  @JsonKey(name: 'message_type')
  final String messageType;
  @JsonKey(name: 'sender_id')
  final String senderId;
  @JsonKey(name: 'sender_name')
  final String senderName;
  @JsonKey(name: 'sender_avatar')
  final String? senderAvatar;
  @JsonKey(name: 'thread_id')
  final String? threadId;
  @JsonKey(name: 'parent_message_id')
  final String? parentMessageId;
  @JsonKey(name: 'created_at')
  final DateTime createdAt;
  @JsonKey(name: 'updated_at')
  final DateTime? updatedAt;
  @JsonKey(name: 'is_edited')
  final bool isEdited;
  @JsonKey(name: 'is_deleted')
  final bool isDeleted;
  @JsonKey(name: 'is_pinned')
  final bool isPinned;
  @JsonKey(name: 'scheduled_for')
  final DateTime? scheduledFor;
  
  // Related data
  final List<Attachment>? attachments;
  final List<Reaction>? reactions;
  final List<Mention>? mentions;
  @JsonKey(name: 'parent_message')
  final ParentMessage? parentMessage;
  @JsonKey(name: 'reply_count')
  @FlexibleIntConverter()
  final int replyCount;
  @JsonKey(name: 'edit_count')
  @FlexibleIntConverter()
  final int editCount;

  // Metadata for special message types (e.g., task messages)
  final Map<String, dynamic>? metadata;

  // Local state for UI
  @JsonKey(includeFromJson: false, includeToJson: false)
  final MessageStatus status;
  @JsonKey(includeFromJson: false, includeToJson: false)
  final String? tempId;

  const Message({
    required this.id,
    required this.content,
    required this.messageType,
    required this.senderId,
    required this.senderName,
    this.senderAvatar,
    this.threadId,
    this.parentMessageId,
    required this.createdAt,
    this.updatedAt,
    this.isEdited = false,
    this.isDeleted = false,
    this.isPinned = false,
    this.scheduledFor,
    this.attachments,
    this.reactions,
    this.mentions,
    this.parentMessage,
    this.replyCount = 0,
    this.editCount = 0,
    this.metadata,
    this.status = MessageStatus.sent,
    this.tempId,
  });

  factory Message.fromJson(Map<String, dynamic> json) => _$MessageFromJson(json);
  Map<String, dynamic> toJson() => _$MessageToJson(this);

  // Create a temporary message for optimistic UI updates
  factory Message.temp({
    required String tempId,
    required String content,
    required String senderId,
    required String senderName,
    String? senderAvatar,
    required String threadId,
    String? parentMessageId,
    String messageType = 'text',
    List<Attachment>? attachments,
    List<Mention>? mentions,
  }) {
    return Message(
      id: tempId,
      tempId: tempId,
      content: content,
      messageType: messageType,
      senderId: senderId,
      senderName: senderName,
      senderAvatar: senderAvatar,
      threadId: threadId,
      parentMessageId: parentMessageId,
      createdAt: DateTime.now(),
      attachments: attachments,
      mentions: mentions,
      status: MessageStatus.sending,
    );
  }

  Message copyWith({
    String? id,
    String? content,
    String? messageType,
    String? senderId,
    String? senderName,
    String? senderAvatar,
    String? threadId,
    String? parentMessageId,
    DateTime? createdAt,
    DateTime? updatedAt,
    bool? isEdited,
    bool? isDeleted,
    bool? isPinned,
    DateTime? scheduledFor,
    List<Attachment>? attachments,
    List<Reaction>? reactions,
    List<Mention>? mentions,
    ParentMessage? parentMessage,
    int? replyCount,
    int? editCount,
    Map<String, dynamic>? metadata,
    MessageStatus? status,
    String? tempId,
  }) {
    return Message(
      id: id ?? this.id,
      content: content ?? this.content,
      messageType: messageType ?? this.messageType,
      senderId: senderId ?? this.senderId,
      senderName: senderName ?? this.senderName,
      senderAvatar: senderAvatar ?? this.senderAvatar,
      threadId: threadId ?? this.threadId,
      parentMessageId: parentMessageId ?? this.parentMessageId,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      isEdited: isEdited ?? this.isEdited,
      isDeleted: isDeleted ?? this.isDeleted,
      isPinned: isPinned ?? this.isPinned,
      scheduledFor: scheduledFor ?? this.scheduledFor,
      attachments: attachments ?? this.attachments,
      reactions: reactions ?? this.reactions,
      mentions: mentions ?? this.mentions,
      parentMessage: parentMessage ?? this.parentMessage,
      replyCount: replyCount ?? this.replyCount,
      editCount: editCount ?? this.editCount,
      metadata: metadata ?? this.metadata,
      status: status ?? this.status,
      tempId: tempId ?? this.tempId,
    );
  }

  bool get isTemp => tempId != null;
  bool get isSending => status == MessageStatus.sending;
  bool get hasFailed => status == MessageStatus.failed;
  bool get hasAttachments => attachments != null && attachments!.isNotEmpty;
  bool get hasReactions => reactions != null && reactions!.isNotEmpty;
  bool get hasMentions => mentions != null && mentions!.isNotEmpty;
  bool get isReply => parentMessageId != null;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Message &&
          runtimeType == other.runtimeType &&
          id == other.id;

  @override
  int get hashCode => id.hashCode;
}

@JsonSerializable()
class ParentMessage {
  final String id;
  final String content;
  @JsonKey(name: 'sender_name')
  final String senderName;
  @JsonKey(name: 'created_at')
  final DateTime createdAt;

  const ParentMessage({
    required this.id,
    required this.content,
    required this.senderName,
    required this.createdAt,
  });

  factory ParentMessage.fromJson(Map<String, dynamic> json) => _$ParentMessageFromJson(json);
  Map<String, dynamic> toJson() => _$ParentMessageToJson(this);
}

enum MessageStatus {
  sending,
  sent,
  failed,
  delivered,
  read,
}

enum MessageType {
  text,
  file,
  system,
  code,
  richText,
  task,
}

extension MessageTypeExtension on MessageType {
  String get value {
    switch (this) {
      case MessageType.text:
        return 'text';
      case MessageType.file:
        return 'file';
      case MessageType.system:
        return 'system';
      case MessageType.code:
        return 'code';
      case MessageType.richText:
        return 'rich_text';
      case MessageType.task:
        return 'task';
    }
  }

  static MessageType fromString(String value) {
    switch (value.toLowerCase()) {
      case 'text':
        return MessageType.text;
      case 'file':
        return MessageType.file;
      case 'system':
        return MessageType.system;
      case 'code':
        return MessageType.code;
      case 'rich_text':
        return MessageType.richText;
      case 'task':
        return MessageType.task;
      default:
        return MessageType.text;
    }
  }
}
