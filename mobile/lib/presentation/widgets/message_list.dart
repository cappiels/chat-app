import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/models/message.dart';
import '../../data/models/reaction.dart';
import 'message_item.dart';

class MessageList extends ConsumerStatefulWidget {
  final List<Message> messages;
  final ScrollController scrollController;
  final bool isLoadingMore;
  final bool hasMoreMessages;
  final Function(String messageId, String emoji) onReactionTap;
  final Function(String messageId, String newContent) onMessageEdit;
  final Function(String messageId) onMessageDelete;
  final Function(Message failedMessage) onRetryMessage;

  const MessageList({
    super.key,
    required this.messages,
    required this.scrollController,
    required this.isLoadingMore,
    required this.hasMoreMessages,
    required this.onReactionTap,
    required this.onMessageEdit,
    required this.onMessageDelete,
    required this.onRetryMessage,
  });

  @override
  ConsumerState<MessageList> createState() => _MessageListState();
}

class _MessageListState extends ConsumerState<MessageList> {
  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      controller: widget.scrollController,
      reverse: true, // Most recent messages at bottom
      itemCount: widget.messages.length + (widget.hasMoreMessages ? 1 : 0),
      itemBuilder: (context, index) {
        // Loading indicator at top (index 0 when reversed)
        if (index == widget.messages.length) {
          return widget.isLoadingMore
              ? Container(
                  padding: const EdgeInsets.all(16),
                  child: const Center(
                    child: CircularProgressIndicator(),
                  ),
                )
              : const SizedBox.shrink();
        }

        final message = widget.messages[widget.messages.length - 1 - index];
        final previousMessage = index < widget.messages.length - 1
            ? widget.messages[widget.messages.length - 2 - index]
            : null;
        final nextMessage = index > 0
            ? widget.messages[widget.messages.length - index]
            : null;

        return MessageItem(
          message: message,
          previousMessage: previousMessage,
          nextMessage: nextMessage,
          onReactionTap: widget.onReactionTap,
          onEdit: widget.onMessageEdit,
          onDelete: widget.onMessageDelete,
          onRetry: widget.onRetryMessage,
        );
      },
    );
  }
}
