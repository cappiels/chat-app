import 'package:json_annotation/json_annotation.dart';

part 'reaction.g.dart';

@JsonSerializable()
class Reaction {
  final String emoji;
  final int count;
  final List<String> users;
  @JsonKey(name: 'user_reacted')
  final bool userReacted;

  const Reaction({
    required this.emoji,
    required this.count,
    required this.users,
    required this.userReacted,
  });

  factory Reaction.fromJson(Map<String, dynamic> json) => _$ReactionFromJson(json);
  Map<String, dynamic> toJson() => _$ReactionToJson(this);

  Reaction copyWith({
    String? emoji,
    int? count,
    List<String>? users,
    bool? userReacted,
  }) {
    return Reaction(
      emoji: emoji ?? this.emoji,
      count: count ?? this.count,
      users: users ?? this.users,
      userReacted: userReacted ?? this.userReacted,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Reaction &&
          runtimeType == other.runtimeType &&
          emoji == other.emoji;

  @override
  int get hashCode => emoji.hashCode;
}

// Business & Professional emojis commonly used in team communication
class BusinessEmojis {
  static const List<Map<String, String>> list = [
    // Project Status
    {'emoji': '✅', 'label': 'Done/Complete'},
    {'emoji': '⏳', 'label': 'In Progress'},
    {'emoji': '🔄', 'label': 'Review'},
    {'emoji': '❌', 'label': 'Blocked/Failed'},
    {'emoji': '⏸️', 'label': 'Paused'},
    {'emoji': '🚀', 'label': 'Launch/Deploy'},
    
    // Feedback & Reactions
    {'emoji': '👍', 'label': 'Approve/Good'},
    {'emoji': '👎', 'label': 'Disapprove/Bad'},
    {'emoji': '❗', 'label': 'Important/Urgent'},
    {'emoji': '❓', 'label': 'Question/Unclear'},
    {'emoji': '💡', 'label': 'Idea/Suggestion'},
    {'emoji': '⚠️', 'label': 'Warning/Caution'},
    
    // Priority & Alerts
    {'emoji': '🔥', 'label': 'High Priority/Hot'},
    {'emoji': '🎯', 'label': 'Goal/Target'},
    {'emoji': '📊', 'label': 'Metrics/Data'},
    {'emoji': '📈', 'label': 'Growth/Up'},
    {'emoji': '📉', 'label': 'Decline/Down'},
    {'emoji': '⚡', 'label': 'Fast/Quick'},
    
    // Communication
    {'emoji': '💬', 'label': 'Discussion'},
    {'emoji': '📝', 'label': 'Notes/Documentation'},
    {'emoji': '🔍', 'label': 'Investigation/Search'},
    {'emoji': '🎉', 'label': 'Celebration/Success'},
    {'emoji': '🤝', 'label': 'Agreement/Partnership'},
    {'emoji': '👀', 'label': 'Reviewing/Watching'},
  ];

  static List<String> get emojis => list.map((e) => e['emoji']!).toList();
  
  static String? getLabelForEmoji(String emoji) {
    final item = list.firstWhere(
      (e) => e['emoji'] == emoji,
      orElse: () => {},
    );
    return item['label'];
  }
}
