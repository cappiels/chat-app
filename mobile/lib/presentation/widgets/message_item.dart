import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../data/models/message.dart';
import '../../data/models/reaction.dart';
import '../../data/models/attachment.dart';
import 'package:intl/intl.dart';

class MessageItem extends StatefulWidget {
  final Message message;
  final Message? previousMessage;
  final Message? nextMessage;
  final Function(String messageId, String emoji) onReactionTap;
  final Function(String messageId, String newContent) onEdit;
  final Function(String messageId) onDelete;
  final Function(Message failedMessage) onRetry;

  const MessageItem({
    super.key,
    required this.message,
    this.previousMessage,
    this.nextMessage,
    required this.onReactionTap,
    required this.onEdit,
    required this.onDelete,
    required this.onRetry,
  });

  @override
  State<MessageItem> createState() => _MessageItemState();
}

class _MessageItemState extends State<MessageItem> {
  bool _showReactionPicker = false;
  final TextEditingController _editController = TextEditingController();
  bool _isEditing = false;

  @override
  void dispose() {
    _editController.dispose();
    super.dispose();
  }

  bool get _shouldShowAvatar {
    if (widget.previousMessage == null) return true;
    if (widget.previousMessage!.senderId != widget.message.senderId) return true;
    
    // Show avatar if messages are more than 5 minutes apart
    final timeDiff = widget.message.createdAt.difference(widget.previousMessage!.createdAt);
    return timeDiff.inMinutes > 5;
  }

  bool get _shouldShowTimestamp {
    if (widget.nextMessage == null) return true;
    if (widget.nextMessage!.senderId != widget.message.senderId) return true;
    
    // Show timestamp if next message is more than 5 minutes later
    final timeDiff = widget.nextMessage!.createdAt.difference(widget.message.createdAt);
    return timeDiff.inMinutes > 5;
  }

  void _showMessageActions() {
    showModalBottomSheet(
      context: context,
      builder: (context) => _MessageActionsSheet(
        message: widget.message,
        onEdit: () {
          Navigator.pop(context);
          _startEditing();
        },
        onDelete: () {
          Navigator.pop(context);
          _showDeleteConfirmation();
        },
        onCopy: () {
          Navigator.pop(context);
          _copyToClipboard();
        },
        onReact: () {
          Navigator.pop(context);
          setState(() {
            _showReactionPicker = !_showReactionPicker;
          });
        },
        onRetry: widget.message.hasFailed ? () {
          Navigator.pop(context);
          widget.onRetry(widget.message);
        } : null,
      ),
    );
  }

  void _startEditing() {
    setState(() {
      _isEditing = true;
      _editController.text = widget.message.content;
    });
  }

  void _saveEdit() {
    if (_editController.text.trim() != widget.message.content && _editController.text.trim().isNotEmpty) {
      widget.onEdit(widget.message.id, _editController.text.trim());
    }
    _cancelEdit();
  }

  void _cancelEdit() {
    setState(() {
      _isEditing = false;
      _editController.clear();
    });
  }

  void _showDeleteConfirmation() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete message'),
        content: const Text('Are you sure you want to delete this message?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              widget.onDelete(widget.message.id);
            },
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }

  void _copyToClipboard() {
    Clipboard.setData(ClipboardData(text: widget.message.content));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Message copied to clipboard')),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (widget.message.isDeleted) {
      return _buildDeletedMessage();
    }

    return GestureDetector(
      onLongPress: _showMessageActions,
      child: Container(
        padding: EdgeInsets.only(
          left: 16,
          right: 16,
          top: _shouldShowAvatar ? 12 : 2,
          bottom: _shouldShowTimestamp ? 8 : 2,
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Avatar column
            SizedBox(
              width: 40,
              child: _shouldShowAvatar
                  ? _buildAvatar()
                  : _buildMessageStatus(),
            ),
            const SizedBox(width: 12),
            
            // Message content
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Header (name + timestamp) - only show if showing avatar
                  if (_shouldShowAvatar) _buildMessageHeader(),
                  
                  // Message content or edit field
                  if (_isEditing)
                    _buildEditField()
                  else
                    _buildMessageContent(),
                  
                  // Attachments
                  if (widget.message.hasAttachments) _buildAttachments(),
                  
                  // Reactions
                  if (widget.message.hasReactions || _showReactionPicker) _buildReactions(),
                  
                  // Reply/thread info
                  if (widget.message.replyCount > 0) _buildReplyCount(),
                  
                  // Timestamp for grouped messages
                  if (!_shouldShowAvatar && _shouldShowTimestamp) _buildInlineTimestamp(),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDeletedMessage() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        children: [
          const SizedBox(width: 40),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              '🗑️ This message was deleted',
              style: TextStyle(
                color: Colors.grey.shade500,
                fontStyle: FontStyle.italic,
                fontSize: 14,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAvatar() {
    return Container(
      width: 36,
      height: 36,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(6),
        color: Colors.grey.shade200,
      ),
      child: widget.message.senderAvatar != null
          ? ClipRRect(
              borderRadius: BorderRadius.circular(6),
              child: CachedNetworkImage(
                imageUrl: widget.message.senderAvatar!,
                width: 36,
                height: 36,
                fit: BoxFit.cover,
                placeholder: (context, url) => Container(
                  color: Colors.grey.shade200,
                  child: const Icon(Icons.person, size: 20),
                ),
                errorWidget: (context, url, error) => Container(
                  color: Colors.grey.shade200,
                  child: const Icon(Icons.person, size: 20),
                ),
              ),
            )
          : Icon(
              Icons.person,
              size: 20,
              color: Colors.grey.shade600,
            ),
    );
  }

  Widget _buildMessageStatus() {
    if (widget.message.isSending) {
      return Container(
        width: 12,
        height: 12,
        margin: const EdgeInsets.only(top: 4),
        child: CircularProgressIndicator(
          strokeWidth: 1.5,
          valueColor: AlwaysStoppedAnimation<Color>(Colors.grey.shade400),
        ),
      );
    }
    
    if (widget.message.hasFailed) {
      return Container(
        margin: const EdgeInsets.only(top: 4),
        child: Icon(
          Icons.error,
          size: 16,
          color: Colors.red.shade400,
        ),
      );
    }
    
    return const SizedBox.shrink();
  }

  Widget _buildMessageHeader() {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        children: [
          Text(
            widget.message.senderName,
            style: const TextStyle(
              fontWeight: FontWeight.w600,
              fontSize: 15,
              color: Colors.black87,
            ),
          ),
          const SizedBox(width: 8),
          Text(
            DateFormat('h:mm a').format(widget.message.createdAt),
            style: TextStyle(
              fontSize: 12,
              color: Colors.grey.shade500,
            ),
          ),
          if (widget.message.isEdited) ...[
            const SizedBox(width: 4),
            Text(
              '(edited)',
              style: TextStyle(
                fontSize: 12,
                color: Colors.grey.shade500,
                fontStyle: FontStyle.italic,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildMessageContent() {
    return SelectableText(
      widget.message.content,
      style: const TextStyle(
        fontSize: 15,
        height: 1.4,
        color: Colors.black87,
      ),
    );
  }

  Widget _buildEditField() {
    return Column(
      children: [
        TextField(
          controller: _editController,
          maxLines: null,
          decoration: const InputDecoration(
            border: OutlineInputBorder(),
            hintText: 'Edit message...',
            contentPadding: EdgeInsets.all(12),
          ),
          autofocus: true,
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            TextButton(
              onPressed: _cancelEdit,
              child: const Text('Cancel'),
            ),
            const SizedBox(width: 8),
            ElevatedButton(
              onPressed: _saveEdit,
              child: const Text('Save'),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildAttachments() {
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Column(
        children: widget.message.attachments!.map((attachment) {
          return _buildAttachmentItem(attachment);
        }).toList(),
      ),
    );
  }

  Widget _buildAttachmentItem(Attachment attachment) {
    if (attachment.isImage) {
      return Container(
        margin: const EdgeInsets.only(bottom: 8),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: CachedNetworkImage(
            imageUrl: attachment.fileUrl,
            placeholder: (context, url) => Container(
              height: 200,
              color: Colors.grey.shade200,
              child: const Center(child: CircularProgressIndicator()),
            ),
            errorWidget: (context, url, error) => Container(
              height: 200,
              color: Colors.grey.shade200,
              child: const Icon(Icons.error),
            ),
          ),
        ),
      );
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        border: Border.all(color: Colors.grey.shade300),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          Icon(
            attachment.isVideo ? Icons.play_circle : 
            attachment.isAudio ? Icons.audiotrack : 
            Icons.description,
            color: Colors.grey.shade600,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  attachment.fileName,
                  style: const TextStyle(fontWeight: FontWeight.w500),
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  attachment.fileSizeFormatted,
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.grey.shade600,
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.download),
            onPressed: () {
              // TODO: Download file
            },
          ),
        ],
      ),
    );
  }

  Widget _buildReactions() {
    return Container(
      margin: const EdgeInsets.only(top: 8),
      child: Wrap(
        spacing: 4,
        runSpacing: 4,
        children: [
          // Existing reactions
          if (widget.message.hasReactions)
            ...widget.message.reactions!.map((reaction) => _buildReactionChip(reaction)),
          
          // Reaction picker
          if (_showReactionPicker) _buildReactionPicker(),
          
          // Add reaction button
          if (!_showReactionPicker)
            _buildAddReactionButton(),
        ],
      ),
    );
  }

  Widget _buildReactionChip(Reaction reaction) {
    return GestureDetector(
      onTap: () => widget.onReactionTap(widget.message.id, reaction.emoji),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: reaction.userReacted ? Colors.blue.shade50 : Colors.grey.shade100,
          border: Border.all(
            color: reaction.userReacted ? Colors.blue.shade300 : Colors.grey.shade300,
          ),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(reaction.emoji, style: const TextStyle(fontSize: 14)),
            const SizedBox(width: 4),
            Text(
              reaction.count.toString(),
              style: TextStyle(
                fontSize: 12,
                color: reaction.userReacted ? Colors.blue.shade700 : Colors.grey.shade700,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildReactionPicker() {
    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: Colors.grey.shade300),
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.grey.withOpacity(0.1),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Wrap(
        spacing: 8,
        children: BusinessEmojis.list.take(8).map((emojiData) {
          return GestureDetector(
            onTap: () {
              widget.onReactionTap(widget.message.id, emojiData['emoji']!);
              setState(() {
                _showReactionPicker = false;
              });
            },
            child: Container(
              padding: const EdgeInsets.all(4),
              child: Text(
                emojiData['emoji']!,
                style: const TextStyle(fontSize: 20),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildAddReactionButton() {
    return GestureDetector(
      onTap: () {
        setState(() {
          _showReactionPicker = !_showReactionPicker;
        });
      },
      child: Container(
        padding: const EdgeInsets.all(6),
        decoration: BoxDecoration(
          color: Colors.grey.shade100,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Icon(
          Icons.add_reaction_outlined,
          size: 16,
          color: Colors.grey.shade600,
        ),
      ),
    );
  }

  Widget _buildReplyCount() {
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Text(
        '${widget.message.replyCount} ${widget.message.replyCount == 1 ? 'reply' : 'replies'}',
        style: TextStyle(
          fontSize: 12,
          color: Colors.blue.shade600,
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }

  Widget _buildInlineTimestamp() {
    return Padding(
      padding: const EdgeInsets.only(top: 2),
      child: Text(
        DateFormat('h:mm a').format(widget.message.createdAt),
        style: TextStyle(
          fontSize: 11,
          color: Colors.grey.shade400,
        ),
      ),
    );
  }
}

class _MessageActionsSheet extends StatelessWidget {
  final Message message;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  final VoidCallback onCopy;
  final VoidCallback onReact;
  final VoidCallback? onRetry;

  const _MessageActionsSheet({
    required this.message,
    required this.onEdit,
    required this.onDelete,
    required this.onCopy,
    required this.onReact,
    this.onRetry,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (onRetry != null) ...[
            ListTile(
              leading: const Icon(Icons.refresh, color: Colors.orange),
              title: const Text('Retry'),
              onTap: onRetry!,
            ),
            const Divider(),
          ],
          ListTile(
            leading: const Icon(Icons.add_reaction_outlined),
            title: const Text('Add reaction'),
            onTap: onReact,
          ),
          ListTile(
            leading: const Icon(Icons.copy),
            title: const Text('Copy text'),
            onTap: onCopy,
          ),
          // TODO: Add checks for message ownership
          ListTile(
            leading: const Icon(Icons.edit),
            title: const Text('Edit message'),
            onTap: onEdit,
          ),
          ListTile(
            leading: const Icon(Icons.delete, color: Colors.red),
            title: const Text('Delete message'),
            onTap: onDelete,
          ),
        ],
      ),
    );
  }
}
