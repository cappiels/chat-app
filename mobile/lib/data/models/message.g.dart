// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'message.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Message _$MessageFromJson(Map<String, dynamic> json) => Message(
  id: json['id'] as String,
  content: json['content'] as String,
  messageType: json['message_type'] as String,
  senderId: json['sender_id'] as String,
  senderName: json['sender_name'] as String,
  senderAvatar: json['sender_avatar'] as String?,
  threadId: json['thread_id'] as String?,
  parentMessageId: json['parent_message_id'] as String?,
  createdAt: DateTime.parse(json['created_at'] as String),
  updatedAt: json['updated_at'] == null
      ? null
      : DateTime.parse(json['updated_at'] as String),
  isEdited: json['is_edited'] as bool? ?? false,
  isDeleted: json['is_deleted'] as bool? ?? false,
  isPinned: json['is_pinned'] as bool? ?? false,
  scheduledFor: json['scheduled_for'] == null
      ? null
      : DateTime.parse(json['scheduled_for'] as String),
  attachments: (json['attachments'] as List<dynamic>?)
      ?.map((e) => Attachment.fromJson(e as Map<String, dynamic>))
      .toList(),
  reactions: (json['reactions'] as List<dynamic>?)
      ?.map((e) => Reaction.fromJson(e as Map<String, dynamic>))
      .toList(),
  mentions: (json['mentions'] as List<dynamic>?)
      ?.map((e) => Mention.fromJson(e as Map<String, dynamic>))
      .toList(),
  parentMessage: json['parent_message'] == null
      ? null
      : ParentMessage.fromJson(json['parent_message'] as Map<String, dynamic>),
  replyCount: json['reply_count'] == null
      ? 0
      : const FlexibleIntConverter().fromJson(json['reply_count']),
  editCount: json['edit_count'] == null
      ? 0
      : const FlexibleIntConverter().fromJson(json['edit_count']),
);

Map<String, dynamic> _$MessageToJson(Message instance) => <String, dynamic>{
  'id': instance.id,
  'content': instance.content,
  'message_type': instance.messageType,
  'sender_id': instance.senderId,
  'sender_name': instance.senderName,
  'sender_avatar': instance.senderAvatar,
  'thread_id': instance.threadId,
  'parent_message_id': instance.parentMessageId,
  'created_at': instance.createdAt.toIso8601String(),
  'updated_at': instance.updatedAt?.toIso8601String(),
  'is_edited': instance.isEdited,
  'is_deleted': instance.isDeleted,
  'is_pinned': instance.isPinned,
  'scheduled_for': instance.scheduledFor?.toIso8601String(),
  'attachments': instance.attachments,
  'reactions': instance.reactions,
  'mentions': instance.mentions,
  'parent_message': instance.parentMessage,
  'reply_count': const FlexibleIntConverter().toJson(instance.replyCount),
  'edit_count': const FlexibleIntConverter().toJson(instance.editCount),
};

ParentMessage _$ParentMessageFromJson(Map<String, dynamic> json) =>
    ParentMessage(
      id: json['id'] as String,
      content: json['content'] as String,
      senderName: json['sender_name'] as String,
      createdAt: DateTime.parse(json['created_at'] as String),
    );

Map<String, dynamic> _$ParentMessageToJson(ParentMessage instance) =>
    <String, dynamic>{
      'id': instance.id,
      'content': instance.content,
      'sender_name': instance.senderName,
      'created_at': instance.createdAt.toIso8601String(),
    };
