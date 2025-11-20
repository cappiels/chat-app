import 'package:flutter/material.dart';
import 'dart:async';

class MessageComposer extends StatefulWidget {
  final TextEditingController controller;
  final Function(String) onSend;
  final Function(bool)? onTypingChanged;
  
  const MessageComposer({
    super.key,
    required this.controller,
    required this.onSend,
    this.onTypingChanged,
  });

  @override
  State<MessageComposer> createState() => _MessageComposerState();
}

class _MessageComposerState extends State<MessageComposer> {
  bool _isTyping = false;
  bool _hasText = false;
  Timer? _typingTimer;
  final FocusNode _focusNode = FocusNode();
  
  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_onTextChanged);
  }

  @override
  void dispose() {
    _typingTimer?.cancel();
    _focusNode.dispose();
    widget.controller.removeListener(_onTextChanged);
    super.dispose();
  }

  void _onTextChanged() {
    final hasText = widget.controller.text.trim().isNotEmpty;
    
    // Update send button state
    if (_hasText != hasText) {
      setState(() => _hasText = hasText);
    }
    
    // Handle typing indicator
    if (hasText && !_isTyping) {
      // Started typing
      setState(() => _isTyping = true);
      widget.onTypingChanged?.call(true);
    }
    
    // Reset the typing timeout
    _typingTimer?.cancel();
    _typingTimer = Timer(const Duration(seconds: 2), () {
      if (_isTyping) {
        setState(() => _isTyping = false);
        widget.onTypingChanged?.call(false);
      }
    });
  }

  void _handleSend() {
    final text = widget.controller.text.trim();
    if (text.isEmpty) return;
    
    widget.onSend(text);
    
    // Stop typing indicator
    _typingTimer?.cancel();
    if (_isTyping) {
      setState(() => _isTyping = false);
      widget.onTypingChanged?.call(false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 8,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: Row(
            children: [
              // Attachment button (future feature)
              IconButton(
                icon: Icon(Icons.add_circle_outline, color: Colors.grey.shade600),
                onPressed: () {
                  // TODO: Implement file attachment
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('File attachments coming soon!'),
                      duration: Duration(seconds: 2),
                    ),
                  );
                },
                tooltip: 'Attach file',
              ),
              
              // Text input field
              Expanded(
                child: Container(
                  decoration: BoxDecoration(
                    color: Colors.grey.shade100,
                    borderRadius: BorderRadius.circular(24),
                  ),
                  child: TextField(
                    controller: widget.controller,
                    focusNode: _focusNode,
                    maxLines: 5,
                    minLines: 1,
                    textCapitalization: TextCapitalization.sentences,
                    decoration: InputDecoration(
                      hintText: 'Type a message...',
                      hintStyle: TextStyle(color: Colors.grey.shade500),
                      border: InputBorder.none,
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 10,
                      ),
                    ),
                    style: const TextStyle(fontSize: 15),
                    onSubmitted: (_) => _handleSend(),
                  ),
                ),
              ),
              
              const SizedBox(width: 8),
              
              // Send button
              Container(
                decoration: BoxDecoration(
                  color: _hasText
                      ? Colors.blue.shade600
                      : Colors.grey.shade300,
                  shape: BoxShape.circle,
                ),
                child: IconButton(
                  icon: const Icon(Icons.send, color: Colors.white, size: 20),
                  onPressed: _hasText ? _handleSend : null,
                  tooltip: 'Send message',
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
