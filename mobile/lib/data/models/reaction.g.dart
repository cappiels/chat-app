// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'reaction.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Reaction _$ReactionFromJson(Map<String, dynamic> json) => Reaction(
  emoji: json['emoji'] as String,
  count: (json['count'] as num).toInt(),
  users: (json['users'] as List<dynamic>).map((e) => e as String).toList(),
  userReacted: json['user_reacted'] as bool,
);

Map<String, dynamic> _$ReactionToJson(Reaction instance) => <String, dynamic>{
  'emoji': instance.emoji,
  'count': instance.count,
  'users': instance.users,
  'user_reacted': instance.userReacted,
};
