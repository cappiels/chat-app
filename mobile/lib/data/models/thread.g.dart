// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'thread.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Thread _$ThreadFromJson(Map<String, dynamic> json) => Thread(
  id: json['id'] as String,
  name: json['name'] as String,
  description: json['description'] as String?,
  type: json['type'] as String,
  workspaceId: json['workspace_id'] as String?,
  isPrivate: json['is_private'] as bool? ?? false,
  createdAt: DateTime.parse(json['created_at'] as String),
  updatedAt: DateTime.parse(json['updated_at'] as String),
  memberCount: json['member_count'] == null ? 0 : _toInt(json['member_count']),
  unreadCount: json['unread_count'] == null ? 0 : _toInt(json['unread_count']),
  mentionCount: json['mention_count'] == null
      ? 0
      : _toInt(json['mention_count']),
  lastMessage: json['last_message'] == null
      ? null
      : LastMessage.fromJson(json['last_message'] as Map<String, dynamic>),
);

Map<String, dynamic> _$ThreadToJson(Thread instance) => <String, dynamic>{
  'id': instance.id,
  'name': instance.name,
  'description': instance.description,
  'type': instance.type,
  'workspace_id': instance.workspaceId,
  'is_private': instance.isPrivate,
  'created_at': instance.createdAt.toIso8601String(),
  'updated_at': instance.updatedAt.toIso8601String(),
  'member_count': _fromInt(instance.memberCount),
  'unread_count': _fromInt(instance.unreadCount),
  'mention_count': _fromInt(instance.mentionCount),
  'last_message': instance.lastMessage,
};

LastMessage _$LastMessageFromJson(Map<String, dynamic> json) => LastMessage(
  id: json['id'] as String,
  content: json['content'] as String,
  senderName: json['sender_name'] as String,
  createdAt: DateTime.parse(json['created_at'] as String),
  messageType: json['message_type'] as String?,
);

Map<String, dynamic> _$LastMessageToJson(LastMessage instance) =>
    <String, dynamic>{
      'id': instance.id,
      'content': instance.content,
      'sender_name': instance.senderName,
      'created_at': instance.createdAt.toIso8601String(),
      'message_type': instance.messageType,
    };
