import 'package:flutter/material.dart';
import '../../../data/models/message.dart';
import 'package:intl/intl.dart';

class MessageBubble extends StatelessWidget {
  final Message message;
  final bool isOwnMessage;
  final VoidCallback onLongPress;
  
  const MessageBubble({
    super.key,
    required this.message,
    required this.isOwnMessage,
    required this.onLongPress,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onLongPress: onLongPress,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          mainAxisAlignment:
              isOwnMessage ? MainAxisAlignment.end : MainAxisAlignment.start,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Sender avatar (left side for others)
            if (!isOwnMessage) ...[
              _buildAvatar(),
              const SizedBox(width: 8),
            ],
            
            // Message content
            Flexible(
              child: Column(
                crossAxisAlignment: isOwnMessage
                    ? CrossAxisAlignment.end
                    : CrossAxisAlignment.start,
                children: [
                  // Sender name (only for others' messages)
                  if (!isOwnMessage) ...[
                    Padding(
                      padding: const EdgeInsets.only(left: 12, bottom: 4),
                      child: Text(
                        message.senderName,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: Colors.grey.shade700,
                        ),
                      ),
                    ),
                  ],
                  
                  // Message bubble
                  Container(
                    decoration: BoxDecoration(
                      color: isOwnMessage
                          ? Colors.blue.shade600
                          : Colors.grey.shade200,
                      borderRadius: BorderRadius.only(
                        topLeft: Radius.circular(isOwnMessage ? 18 : 4),
                        topRight: Radius.circular(isOwnMessage ? 4 : 18),
                        bottomLeft: const Radius.circular(18),
                        bottomRight: const Radius.circular(18),
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.05),
                          blurRadius: 4,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 10,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Reply preview (if replying to another message)
                        if (message.parentMessage != null)
                          _buildReplyPreview(message.parentMessage!),
                        
                        // Message content
                        Text(
                          message.isDeleted
                              ? '[Message deleted]'
                              : message.content,
                          style: TextStyle(
                            fontSize: 15,
                            color: isOwnMessage
                                ? Colors.white
                                : Colors.grey.shade900,
                            fontStyle: message.isDeleted
                                ? FontStyle.italic
                                : FontStyle.normal,
                          ),
                        ),
                        
                        // Attachments
                        if (message.hasAttachments) ...[
                          const SizedBox(height: 8),
                          _buildAttachments(),
                        ],
                        
                        // Timestamp and status
                        const SizedBox(height: 4),
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              _formatTime(message.createdAt),
                              style: TextStyle(
                                fontSize: 11,
                                color: isOwnMessage
                                    ? Colors.white.withOpacity(0.7)
                                    : Colors.grey.shade600,
                              ),
                            ),
                            if (message.isEdited) ...[
                              const SizedBox(width: 4),
                              Text(
                                '(edited)',
                                style: TextStyle(
                                  fontSize: 10,
                                  fontStyle: FontStyle.italic,
                                  color: isOwnMessage
                                      ? Colors.white.withOpacity(0.6)
                                      : Colors.grey.shade500,
                                ),
                              ),
                            ],
                            if (isOwnMessage) ...[
                              const SizedBox(width: 4),
                              _buildStatusIcon(),
                            ],
                          ],
                        ),
                      ],
                    ),
                  ),
                  
                  // Reactions
                  if (message.hasReactions) ...[
                    const SizedBox(height: 4),
                    _buildReactions(),
                  ],
                ],
              ),
            ),
            
            // Sender avatar (right side for own messages)
            if (isOwnMessage) ...[
              const SizedBox(width: 8),
              _buildAvatar(),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildAvatar() {
    return Container(
      width: 36,
      height: 36,
      decoration: BoxDecoration(
        color: isOwnMessage ? Colors.blue.shade100 : Colors.grey.shade300,
        shape: BoxShape.circle,
      ),
      child: message.senderAvatar != null
          ? ClipOval(
              child: Image.network(
                message.senderAvatar!,
                fit: BoxFit.cover,
                errorBuilder: (context, error, stackTrace) =>
                    _buildAvatarFallback(),
              ),
            )
          : _buildAvatarFallback(),
    );
  }

  Widget _buildAvatarFallback() {
    final initials = _getInitials(message.senderName);
    return Center(
      child: Text(
        initials,
        style: TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.bold,
          color: isOwnMessage ? Colors.blue.shade700 : Colors.grey.shade700,
        ),
      ),
    );
  }

  String _getInitials(String name) {
    final parts = name.trim().split(' ');
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts[0][0].toUpperCase();
    return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
  }

  Widget _buildReplyPreview(ParentMessage parentMessage) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: isOwnMessage
            ? Colors.white.withOpacity(0.2)
            : Colors.grey.shade300,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: isOwnMessage
              ? Colors.white.withOpacity(0.3)
              : Colors.grey.shade400,
          width: 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            parentMessage.senderName,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: isOwnMessage
                  ? Colors.white.withOpacity(0.9)
                  : Colors.grey.shade700,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            parentMessage.content,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 12,
              color: isOwnMessage
                  ? Colors.white.withOpacity(0.8)
                  : Colors.grey.shade600,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAttachments() {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: message.attachments!.map((attachment) {
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: isOwnMessage
                ? Colors.white.withOpacity(0.2)
                : Colors.grey.shade300,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                _getFileIcon(attachment.mimeType),
                size: 16,
                color: isOwnMessage ? Colors.white : Colors.grey.shade700,
              ),
              const SizedBox(width: 8),
              Flexible(
                child: Text(
                  attachment.fileName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 13,
                    color: isOwnMessage ? Colors.white : Colors.grey.shade800,
                  ),
                ),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }

  IconData _getFileIcon(String? mimeType) {
    if (mimeType == null) return Icons.attach_file;
    
    if (mimeType.startsWith('image/')) return Icons.image;
    if (mimeType.startsWith('video/')) return Icons.videocam;
    if (mimeType.startsWith('audio/')) return Icons.audiotrack;
    if (mimeType.contains('pdf')) return Icons.picture_as_pdf;
    if (mimeType.contains('word') || mimeType.contains('document')) {
      return Icons.description;
    }
    if (mimeType.contains('sheet') || mimeType.contains('excel')) {
      return Icons.table_chart;
    }
    if (mimeType.contains('zip') || mimeType.contains('archive')) {
      return Icons.folder_zip;
    }
    
    return Icons.attach_file;
  }

  Widget _buildReactions() {
    // Group reactions by emoji
    final reactionCounts = <String, int>{};
    for (final reaction in message.reactions!) {
      reactionCounts[reaction.emoji] = (reactionCounts[reaction.emoji] ?? 0) + 1;
    }

    return Padding(
      padding: EdgeInsets.only(
        left: isOwnMessage ? 0 : 12,
        right: isOwnMessage ? 12 : 0,
      ),
      child: Wrap(
        spacing: 4,
        runSpacing: 4,
        children: reactionCounts.entries.map((entry) {
          return Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.grey.shade300),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.05),
                  blurRadius: 2,
                  offset: const Offset(0, 1),
                ),
              ],
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(entry.key, style: const TextStyle(fontSize: 14)),
                const SizedBox(width: 4),
                Text(
                  '${entry.value}',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: Colors.grey.shade700,
                  ),
                ),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildStatusIcon() {
    IconData icon;
    Color color;
    
    switch (message.status) {
      case MessageStatus.sending:
        icon = Icons.access_time;
        color = Colors.white.withOpacity(0.6);
        break;
      case MessageStatus.sent:
        icon = Icons.check;
        color = Colors.white.withOpacity(0.7);
        break;
      case MessageStatus.delivered:
        icon = Icons.done_all;
        color = Colors.white.withOpacity(0.7);
        break;
      case MessageStatus.read:
        icon = Icons.done_all;
        color = Colors.white;
        break;
      case MessageStatus.failed:
        icon = Icons.error_outline;
        color = Colors.red.shade300;
        break;
    }
    
    return Icon(icon, size: 14, color: color);
  }

  String _formatTime(DateTime time) {
    final now = DateTime.now();
    final difference = now.difference(time);
    
    if (difference.inMinutes < 1) {
      return 'now';
    } else if (difference.inMinutes < 60) {
      return '${difference.inMinutes}m ago';
    } else if (difference.inHours < 24) {
      return '${difference.inHours}h ago';
    } else if (difference.inDays < 7) {
      return '${difference.inDays}d ago';
    } else {
      return DateFormat('MMM d').format(time);
    }
  }
}
