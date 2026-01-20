import 'package:flutter/material.dart';

class VoteButtons extends StatelessWidget {
  final int upvotes;
  final int downvotes;
  final String? userVote; // 'upvote', 'downvote', or null
  final Function(String) onVote;
  final VoidCallback onRemoveVote;
  final bool disabled;
  final VoteButtonsSize size;
  final VoteButtonsLayout layout;

  const VoteButtons({
    super.key,
    required this.upvotes,
    required this.downvotes,
    this.userVote,
    required this.onVote,
    required this.onRemoveVote,
    this.disabled = false,
    this.size = VoteButtonsSize.medium,
    this.layout = VoteButtonsLayout.vertical,
  });

  @override
  Widget build(BuildContext context) {
    final score = upvotes - downvotes;
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    final iconSize = switch (size) {
      VoteButtonsSize.small => 18.0,
      VoteButtonsSize.medium => 22.0,
      VoteButtonsSize.large => 26.0,
    };

    final fontSize = switch (size) {
      VoteButtonsSize.small => 12.0,
      VoteButtonsSize.medium => 14.0,
      VoteButtonsSize.large => 16.0,
    };

    final buttonSize = switch (size) {
      VoteButtonsSize.small => 28.0,
      VoteButtonsSize.medium => 32.0,
      VoteButtonsSize.large => 40.0,
    };

    Widget upvoteButton = _VoteButton(
      icon: Icons.keyboard_arrow_up_rounded,
      isActive: userVote == 'upvote',
      activeColor: Colors.green,
      iconSize: iconSize,
      buttonSize: buttonSize,
      disabled: disabled,
      onTap: () {
        if (userVote == 'upvote') {
          onRemoveVote();
        } else {
          onVote('upvote');
        }
      },
    );

    Widget downvoteButton = _VoteButton(
      icon: Icons.keyboard_arrow_down_rounded,
      isActive: userVote == 'downvote',
      activeColor: Colors.red,
      iconSize: iconSize,
      buttonSize: buttonSize,
      disabled: disabled,
      onTap: () {
        if (userVote == 'downvote') {
          onRemoveVote();
        } else {
          onVote('downvote');
        }
      },
    );

    Widget scoreWidget = Text(
      score.toString(),
      style: TextStyle(
        fontSize: fontSize,
        fontWeight: FontWeight.bold,
        color: score > 0
            ? Colors.green
            : score < 0
                ? Colors.red
                : (isDark ? Colors.grey[400] : Colors.grey[600]),
      ),
    );

    if (layout == VoteButtonsLayout.horizontal) {
      return Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          upvoteButton,
          const SizedBox(width: 4),
          scoreWidget,
          const SizedBox(width: 4),
          downvoteButton,
        ],
      );
    }

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        upvoteButton,
        const SizedBox(height: 2),
        scoreWidget,
        const SizedBox(height: 2),
        downvoteButton,
      ],
    );
  }
}

class _VoteButton extends StatelessWidget {
  final IconData icon;
  final bool isActive;
  final Color activeColor;
  final double iconSize;
  final double buttonSize;
  final bool disabled;
  final VoidCallback onTap;

  const _VoteButton({
    required this.icon,
    required this.isActive,
    required this.activeColor,
    required this.iconSize,
    required this.buttonSize,
    required this.disabled,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: disabled ? null : onTap,
        borderRadius: BorderRadius.circular(6),
        child: Container(
          width: buttonSize,
          height: buttonSize,
          decoration: BoxDecoration(
            color: isActive
                ? activeColor.withOpacity(isDark ? 0.2 : 0.1)
                : Colors.transparent,
            borderRadius: BorderRadius.circular(6),
          ),
          child: Icon(
            icon,
            size: iconSize,
            color: disabled
                ? Colors.grey[400]
                : isActive
                    ? activeColor
                    : (isDark ? Colors.grey[400] : Colors.grey[600]),
          ),
        ),
      ),
    );
  }
}

enum VoteButtonsSize { small, medium, large }

enum VoteButtonsLayout { vertical, horizontal }
