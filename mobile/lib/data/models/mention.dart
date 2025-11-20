import 'package:json_annotation/json_annotation.dart';

part 'mention.g.dart';

@JsonSerializable()
class Mention {
  @JsonKey(name: 'user_id')
  final String userId;
  @JsonKey(name: 'display_name')
  final String displayName;
  final String type;

  const Mention({
    required this.userId,
    required this.displayName,
    required this.type,
  });

  factory Mention.fromJson(Map<String, dynamic> json) => _$MentionFromJson(json);
  Map<String, dynamic> toJson() => _$MentionToJson(this);

  Mention copyWith({
    String? userId,
    String? displayName,
    String? type,
  }) {
    return Mention(
      userId: userId ?? this.userId,
      displayName: displayName ?? this.displayName,
      type: type ?? this.type,
    );
  }

  bool get isUser => type == 'user';
  bool get isTeam => type == 'team';
  bool get isChannel => type == 'channel';

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Mention &&
          runtimeType == other.runtimeType &&
          userId == other.userId &&
          type == other.type;

  @override
  int get hashCode => Object.hash(userId, type);
}

enum MentionType {
  user,
  team,
  channel,
  everyone,
}

extension MentionTypeExtension on MentionType {
  String get value {
    switch (this) {
      case MentionType.user:
        return 'user';
      case MentionType.team:
        return 'team';
      case MentionType.channel:
        return 'channel';
      case MentionType.everyone:
        return 'everyone';
    }
  }

  static MentionType fromString(String value) {
    switch (value.toLowerCase()) {
      case 'user':
        return MentionType.user;
      case 'team':
        return MentionType.team;
      case 'channel':
        return MentionType.channel;
      case 'everyone':
        return MentionType.everyone;
      default:
        return MentionType.user;
    }
  }
}
