import 'package:flutter/material.dart';
import '../../../data/models/message.dart';
import '../../../data/models/attachment.dart';
import '../../../data/models/workspace.dart';
import '../../../data/services/message_service.dart';
import 'package:intl/intl.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'image_viewer.dart';
import 'delete_message_dialog.dart';

class MessageBubble extends StatelessWidget {
  final Message message;
  final bool isOwnMessage;
  final VoidCallback onLongPress;
  final Workspace? workspace;
  final String workspaceId;
  final String threadId;
  final VoidCallback? onMessageDeleted;
  
  const MessageBubble({
    super.key,
    required this.message,
    required this.isOwnMessage,
    required this.onLongPress,
    this.workspace,
    required this.workspaceId,
    required this.threadId,
    this.onMessageDeleted,
  });

  bool get _canDelete {
    // Can delete if it's your own message OR if you're an admin
    return isOwnMessage || (workspace?.isAdmin ?? false);
  }

  Future<void> _handleDelete(BuildContext context) async {
    if (!_canDelete) return;

    // Show confirmation dialog
    final confirmed = await DeleteMessageDialog.show(
      context,
      isAdmin: workspace?.isAdmin ?? false,
      isOwnMessage: isOwnMessage,
    );

    if (confirmed != true) return;

    try {
      // Show loading indicator
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Row(
              children: [
                SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                  ),
                ),
                SizedBox(width: 12),
                Text('Deleting message...'),
              ],
            ),
            duration: Duration(seconds: 2),
          ),
        );
      }

      // Delete the message
      await MessageService().deleteMessage(
        workspaceId: workspaceId,
        threadId: threadId,
        messageId: message.id,
      );

      if (context.mounted) {
        ScaffoldMessenger.of(context).hideCurrentSnackBar();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Row(
              children: [
                Icon(Icons.check_circle, color: Colors.white, size: 20),
                SizedBox(width: 12),
                Text('Message deleted'),
              ],
            ),
            backgroundColor: Colors.green,
            duration: Duration(seconds: 2),
          ),
        );

        // Notify parent to refresh messages
        onMessageDeleted?.call();
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).hideCurrentSnackBar();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: [
                const Icon(Icons.error_outline, color: Colors.white, size: 20),
                const SizedBox(width: 12),
                Expanded(
                  child: Text('Failed to delete message: ${e.toString()}'),
                ),
              ],
            ),
            backgroundColor: Colors.red.shade600,
            duration: const Duration(seconds: 4),
            action: SnackBarAction(
              label: 'Dismiss',
              textColor: Colors.white,
              onPressed: () {},
            ),
          ),
        );
      }
    }
  }

  void _showMessageOptions(BuildContext context) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Handle bar
            Container(
              margin: const EdgeInsets.only(top: 12, bottom: 8),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey.shade300,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            
            // Message options
            ListTile(
              leading: const Icon(Icons.reply),
              title: const Text('Reply'),
              onTap: () {
                Navigator.pop(context);
                // Handle reply action
              },
            ),
            
            if (isOwnMessage)
              ListTile(
                leading: const Icon(Icons.edit),
                title: const Text('Edit'),
                onTap: () {
                  Navigator.pop(context);
                  // Handle edit action
                },
              ),
            
            ListTile(
              leading: const Icon(Icons.content_copy),
              title: const Text('Copy'),
              onTap: () {
                Navigator.pop(context);
                // Handle copy action
              },
            ),
            
            if (_canDelete)
              ListTile(
                leading: Icon(Icons.delete, color: Colors.red.shade600),
                title: Text(
                  'Delete',
                  style: TextStyle(color: Colors.red.shade600),
                ),
                onTap: () {
                  Navigator.pop(context);
                  _handleDelete(context);
                },
              ),
            
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onLongPress: () => _showMessageOptions(context),
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
    // Separate images from other attachments
    final images = message.attachments!
        .where((a) => a.mimeType.startsWith('image/'))
        .toList();
    final others = message.attachments!
        .where((a) => !a.mimeType.startsWith('image/'))
        .toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Image Grid
        if (images.isNotEmpty) _buildImageGrid(images),
        
        // Other Attachments
        ...others.map((attachment) {
          // Display videos inline
          if (attachment.mimeType?.startsWith('video/') ?? false) {
            return _buildVideoAttachment(attachment);
          }
          
          // Display other files as download links
          return _buildFileAttachment(attachment);
        }).toList(),
      ],
    );
  }

  Widget _buildImageGrid(List<Attachment> images) {
    if (images.isEmpty) return const SizedBox.shrink();
    
    // Single image - full width
    if (images.length == 1) {
      return _buildInlineImage(images[0]);
    }
    
    // Multiple images - 2 column grid
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: GridView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          crossAxisSpacing: 4,
          mainAxisSpacing: 4,
          childAspectRatio: 1,
        ),
        itemCount: images.length,
        itemBuilder: (context, index) {
          final attachment = images[index];
          final fileSize = _formatFileSize(attachment.fileSizeBytes);
          
          // Generate direct URL for Google Drive images
          String imageUrl = attachment.fileUrl;
          
          if (imageUrl.contains('drive.google.com') && imageUrl.contains('/file/d/')) {
            final fileIdMatch = RegExp(r'/file/d/([^/]+)').firstMatch(imageUrl);
            if (fileIdMatch != null && fileIdMatch.groupCount >= 1) {
              final fileId = fileIdMatch.group(1);
              imageUrl = 'https://drive.google.com/uc?export=view&id=$fileId';
            }
          }
          
          return GestureDetector(
            onTap: () {
              ImageViewer.show(
                context,
                imageUrl: imageUrl,
                fileName: attachment.fileName,
                fileSize: fileSize,
              );
            },
            child: Stack(
              fit: StackFit.expand,
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: CachedNetworkImage(
                    imageUrl: imageUrl,
                    fit: BoxFit.cover,
                    placeholder: (context, url) => Container(
                      color: isOwnMessage 
                          ? Colors.white.withOpacity(0.2)
                          : Colors.grey.shade300,
                      child: const Center(
                        child: CircularProgressIndicator(strokeWidth: 2),
                      ),
                    ),
                    errorWidget: (context, url, error) => Container(
                      color: isOwnMessage 
                          ? Colors.white.withOpacity(0.2)
                          : Colors.grey.shade300,
                      child: const Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.broken_image, size: 32, color: Colors.grey),
                          SizedBox(height: 4),
                          Text('Failed', 
                            style: TextStyle(color: Colors.grey, fontSize: 10)),
                        ],
                      ),
                    ),
                  ),
                ),
                // Gradient overlay on hover/focus (shown on bottom)
                Positioned(
                  bottom: 0,
                  left: 0,
                  right: 0,
                  child: Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.bottomCenter,
                        end: Alignment.topCenter,
                        colors: [
                          Colors.black.withOpacity(0.6),
                          Colors.transparent,
                        ],
                      ),
                      borderRadius: const BorderRadius.only(
                        bottomLeft: Radius.circular(8),
                        bottomRight: Radius.circular(8),
                      ),
                    ),
                    padding: const EdgeInsets.all(4),
                    child: Text(
                      attachment.fileName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 9,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildInlineImage(Attachment attachment) {
    final fileSize = _formatFileSize(attachment.fileSizeBytes);
    
    // Generate direct URL for Google Drive images
    String imageUrl = attachment.fileUrl;
    
    // If URL is a Google Drive view link, convert to direct link
    if (imageUrl.contains('drive.google.com') && imageUrl.contains('/file/d/')) {
      final fileIdMatch = RegExp(r'/file/d/([^/]+)').firstMatch(imageUrl);
      if (fileIdMatch != null && fileIdMatch.groupCount >= 1) {
        final fileId = fileIdMatch.group(1);
        imageUrl = 'https://drive.google.com/uc?export=view&id=$fileId';
      }
    }
    
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Builder(
            builder: (context) => GestureDetector(
              onTap: () {
                // Open full-screen image viewer
                ImageViewer.show(
                  context,
                  imageUrl: imageUrl,
                  fileName: attachment.fileName,
                  fileSize: fileSize,
                );
              },
              child: Stack(
                children: [
                  Container(
                    constraints: const BoxConstraints(
                      maxWidth: 300,
                      maxHeight: 300,
                    ),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(12),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.1),
                          blurRadius: 6,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: CachedNetworkImage(
                        imageUrl: imageUrl,
                        fit: BoxFit.cover,
                        placeholder: (context, url) => Container(
                          height: 200,
                          color: isOwnMessage 
                              ? Colors.white.withOpacity(0.2)
                              : Colors.grey.shade300,
                          child: const Center(
                            child: CircularProgressIndicator(),
                          ),
                        ),
                        errorWidget: (context, url, error) => Container(
                          height: 200,
                          color: isOwnMessage 
                              ? Colors.white.withOpacity(0.2)
                              : Colors.grey.shade300,
                          child: const Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.broken_image, size: 48, color: Colors.grey),
                              SizedBox(height: 8),
                              Text('Image failed to load', 
                                style: TextStyle(color: Colors.grey, fontSize: 12)),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                  // Tap to expand hint icon
                  Positioned(
                    top: 8,
                    right: 8,
                    child: Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: Colors.black.withOpacity(0.5),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: const Icon(
                        Icons.zoom_in,
                        color: Colors.white,
                        size: 16,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          // File name and size below image
          Padding(
            padding: const EdgeInsets.only(left: 4, top: 4),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Flexible(
                  child: Text(
                    attachment.fileName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 11,
                      color: isOwnMessage
                          ? Colors.white.withOpacity(0.8)
                          : Colors.grey.shade600,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  fileSize,
                  style: TextStyle(
                    fontSize: 11,
                    color: isOwnMessage
                        ? Colors.white.withOpacity(0.7)
                        : Colors.grey.shade500,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildVideoAttachment(Attachment attachment) {
    final fileSize = _formatFileSize(attachment.fileSizeBytes);
    
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Container(
        constraints: const BoxConstraints(maxWidth: 250),
        decoration: BoxDecoration(
          color: isOwnMessage
              ? Colors.white.withOpacity(0.2)
              : Colors.grey.shade300,
          borderRadius: BorderRadius.circular(12),
        ),
        padding: const EdgeInsets.all(12),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.play_circle_fill,
              size: 32,
              color: isOwnMessage ? Colors.white : Colors.grey.shade700,
            ),
            const SizedBox(width: 12),
            Flexible(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    attachment.fileName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: isOwnMessage ? Colors.white : Colors.grey.shade900,
                    ),
                  ),
                  Text(
                    fileSize,
                    style: TextStyle(
                      fontSize: 11,
                      color: isOwnMessage
                          ? Colors.white.withOpacity(0.7)
                          : Colors.grey.shade600,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFileAttachment(Attachment attachment) {
    final fileSize = _formatFileSize(attachment.fileSizeBytes);
    
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Container(
        constraints: const BoxConstraints(maxWidth: 250),
        decoration: BoxDecoration(
          color: isOwnMessage
              ? Colors.white.withOpacity(0.2)
              : Colors.grey.shade300,
          borderRadius: BorderRadius.circular(8),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
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
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    attachment.fileName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 13,
                      color: isOwnMessage ? Colors.white : Colors.grey.shade800,
                    ),
                  ),
                  Text(
                    fileSize,
                    style: TextStyle(
                      fontSize: 11,
                      color: isOwnMessage
                          ? Colors.white.withOpacity(0.7)
                          : Colors.grey.shade600,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _formatFileSize(int? bytes) {
    if (bytes == null || bytes == 0) return '0 Bytes';
    
    const k = 1024;
    final sizes = ['Bytes', 'KB', 'MB', 'GB'];
    final i = (bytes == 0) ? 0 : (bytes.bitLength - 1) ~/ 10;
    final size = bytes / (1 << (i * 10));
    
    return '${size.toStringAsFixed(2)} ${sizes[i.clamp(0, sizes.length - 1)]}';
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
