// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'mention.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Mention _$MentionFromJson(Map<String, dynamic> json) => Mention(
  userId: json['user_id'] as String,
  displayName: json['display_name'] as String,
  type: json['type'] as String,
);

Map<String, dynamic> _$MentionToJson(Mention instance) => <String, dynamic>{
  'user_id': instance.userId,
  'display_name': instance.displayName,
  'type': instance.type,
};
