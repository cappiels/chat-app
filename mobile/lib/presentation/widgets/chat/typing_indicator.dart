import 'package:flutter/material.dart';

class TypingIndicator extends StatefulWidget {
  final List<String> userNames;
  
  const TypingIndicator({
    super.key,
    required this.userNames,
  });

  @override
  State<TypingIndicator> createState() => _TypingIndicatorState();
}

class _TypingIndicatorState extends State<TypingIndicator>
    with SingleTickerProviderStateMixin {
  late AnimationController _animationController;
  
  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat();
  }

  @override
  void dispose() {
    _animationController.dispose();
    super.dispose();
  }

  String _getTypingText() {
    if (widget.userNames.isEmpty) return '';
    if (widget.userNames.length == 1) {
      return '${widget.userNames[0]} is typing...';
    } else if (widget.userNames.length == 2) {
      return '${widget.userNames[0]} and ${widget.userNames[1]} are typing...';
    } else {
      return '${widget.userNames.length} people are typing...';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.grey.shade50,
        border: Border(
          top: BorderSide(color: Colors.grey.shade200, width: 1),
        ),
      ),
      child: Row(
        children: [
          // Animated typing dots
          SizedBox(
            width: 40,
            height: 20,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                _buildDot(0),
                _buildDot(1),
                _buildDot(2),
              ],
            ),
          ),
          const SizedBox(width: 8),
          
          // Typing text
          Expanded(
            child: Text(
              _getTypingText(),
              style: TextStyle(
                fontSize: 13,
                color: Colors.grey.shade600,
                fontStyle: FontStyle.italic,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDot(int index) {
    return AnimatedBuilder(
      animation: _animationController,
      builder: (context, child) {
        final offset = (index * 0.33);
        final value = (_animationController.value + offset) % 1.0;
        final scale = 0.5 + (0.5 * (1 - (value * 2 - 1).abs()));
        
        return Transform.scale(
          scale: scale,
          child: Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(
              color: Colors.grey.shade600,
              shape: BoxShape.circle,
            ),
          ),
        );
      },
    );
  }
}
