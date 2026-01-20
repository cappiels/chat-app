import 'package:flutter/material.dart';
import '../../../data/models/knowledge_comment.dart';
import 'vote_buttons.dart';

class CommentThread extends StatelessWidget {
  final List<KnowledgeComment> comments;
  final bool isLocked;
  final String? currentUserId;
  final Function(String) onAddComment;
  final Function(String, String?) onReply;
  final Function(String, String) onEdit;
  final Function(String) onDelete;
  final Function(String, String) onVote;
  final Function(String) onRemoveVote;

  const CommentThread({
    super.key,
    required this.comments,
    this.isLocked = false,
    this.currentUserId,
    required this.onAddComment,
    required this.onReply,
    required this.onEdit,
    required this.onDelete,
    required this.onVote,
    required this.onRemoveVote,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Comment input
        if (!isLocked)
          _CommentInput(
            onSubmit: onAddComment,
            hintText: 'Add a comment...',
          )
        else
          Container(
            padding: const EdgeInsets.all(16),
            margin: const EdgeInsets.symmetric(horizontal: 16),
            decoration: BoxDecoration(
              color: Colors.grey.withOpacity(0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.lock_outline, size: 18, color: Colors.grey[600]),
                const SizedBox(width: 8),
                Text(
                  'This topic is locked. Comments are disabled.',
                  style: TextStyle(color: Colors.grey[600]),
                ),
              ],
            ),
          ),

        const SizedBox(height: 16),

        // Comments list
        if (comments.isEmpty)
          Center(
            child: Padding(
              padding: const EdgeInsets.all(32),
              child: Text(
                'No comments yet. Be the first to comment!',
                style: TextStyle(color: Colors.grey[500]),
              ),
            ),
          )
        else
          ...comments.map((comment) => _CommentTile(
                comment: comment,
                depth: 0,
                isLocked: isLocked,
                currentUserId: currentUserId,
                onReply: onReply,
                onEdit: onEdit,
                onDelete: onDelete,
                onVote: onVote,
                onRemoveVote: onRemoveVote,
              )),
      ],
    );
  }
}

class _CommentTile extends StatefulWidget {
  final KnowledgeComment comment;
  final int depth;
  final bool isLocked;
  final String? currentUserId;
  final Function(String, String?) onReply;
  final Function(String, String) onEdit;
  final Function(String) onDelete;
  final Function(String, String) onVote;
  final Function(String) onRemoveVote;

  const _CommentTile({
    required this.comment,
    required this.depth,
    required this.isLocked,
    this.currentUserId,
    required this.onReply,
    required this.onEdit,
    required this.onDelete,
    required this.onVote,
    required this.onRemoveVote,
  });

  @override
  State<_CommentTile> createState() => _CommentTileState();
}

class _CommentTileState extends State<_CommentTile> {
  bool _showReplyInput = false;
  bool _isEditing = false;
  final _editController = TextEditingController();

  @override
  void dispose() {
    _editController.dispose();
    super.dispose();
  }

  String _formatDate(DateTime date) {
    final now = DateTime.now();
    final diff = now.difference(date);

    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    return '${date.month}/${date.day}/${date.year}';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final canEdit = widget.comment.userId == widget.currentUserId;

    return Padding(
      padding: EdgeInsets.only(
        left: 16 + (widget.depth * 20).toDouble(),
        right: 16,
        top: 8,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Comment border for replies
          if (widget.depth > 0)
            Container(
              decoration: BoxDecoration(
                border: Border(
                  left: BorderSide(
                    color: isDark ? Colors.grey[700]! : Colors.grey[300]!,
                    width: 2,
                  ),
                ),
              ),
              padding: const EdgeInsets.only(left: 12),
              child: _buildCommentContent(context, theme, isDark, canEdit),
            )
          else
            _buildCommentContent(context, theme, isDark, canEdit),

          // Replies
          if (widget.comment.replies.isNotEmpty)
            ...widget.comment.replies.map((reply) => _CommentTile(
                  comment: reply,
                  depth: widget.depth + 1,
                  isLocked: widget.isLocked,
                  currentUserId: widget.currentUserId,
                  onReply: widget.onReply,
                  onEdit: widget.onEdit,
                  onDelete: widget.onDelete,
                  onVote: widget.onVote,
                  onRemoveVote: widget.onRemoveVote,
                )),
        ],
      ),
    );
  }

  Widget _buildCommentContent(
    BuildContext context,
    ThemeData theme,
    bool isDark,
    bool canEdit,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Vote buttons
            VoteButtons(
              upvotes: widget.comment.upvotesCount,
              downvotes: widget.comment.downvotesCount,
              userVote: widget.comment.userVote,
              onVote: (type) => widget.onVote(widget.comment.id, type),
              onRemoveVote: () => widget.onRemoveVote(widget.comment.id),
              size: VoteButtonsSize.small,
            ),
            const SizedBox(width: 8),

            // Content
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Header
                  Row(
                    children: [
                      if (widget.comment.userAvatar != null)
                        CircleAvatar(
                          radius: 12,
                          backgroundImage:
                              NetworkImage(widget.comment.userAvatar!),
                        )
                      else
                        CircleAvatar(
                          radius: 12,
                          backgroundColor:
                              isDark ? Colors.grey[700] : Colors.grey[300],
                          child: Icon(
                            Icons.person,
                            size: 14,
                            color: isDark ? Colors.grey[400] : Colors.grey[600],
                          ),
                        ),
                      const SizedBox(width: 8),
                      Text(
                        widget.comment.userName ?? 'Unknown',
                        style: theme.textTheme.bodySmall?.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        _formatDate(widget.comment.createdAt),
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: Colors.grey[500],
                        ),
                      ),
                      if (widget.comment.isEdited)
                        Text(
                          ' (edited)',
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: Colors.grey[500],
                            fontStyle: FontStyle.italic,
                          ),
                        ),
                    ],
                  ),

                  const SizedBox(height: 4),

                  // Body
                  if (_isEditing)
                    _CommentInput(
                      initialValue: widget.comment.content,
                      onSubmit: (content) {
                        widget.onEdit(widget.comment.id, content);
                        setState(() => _isEditing = false);
                      },
                      onCancel: () => setState(() => _isEditing = false),
                      hintText: 'Edit comment...',
                    )
                  else
                    Text(
                      widget.comment.content,
                      style: theme.textTheme.bodyMedium,
                    ),

                  const SizedBox(height: 6),

                  // Actions
                  if (!_isEditing)
                    Row(
                      children: [
                        if (!widget.isLocked && widget.depth < 4)
                          _ActionButton(
                            icon: Icons.reply,
                            label: 'Reply',
                            onTap: () =>
                                setState(() => _showReplyInput = !_showReplyInput),
                          ),
                        if (canEdit) ...[
                          const SizedBox(width: 16),
                          _ActionButton(
                            icon: Icons.edit_outlined,
                            label: 'Edit',
                            onTap: () => setState(() => _isEditing = true),
                          ),
                        ],
                        if (canEdit || widget.comment.isOwner) ...[
                          const SizedBox(width: 16),
                          _ActionButton(
                            icon: Icons.delete_outline,
                            label: 'Delete',
                            onTap: () => _confirmDelete(context),
                          ),
                        ],
                      ],
                    ),
                ],
              ),
            ),
          ],
        ),

        // Reply input
        if (_showReplyInput)
          Padding(
            padding: const EdgeInsets.only(left: 40, top: 8),
            child: _CommentInput(
              onSubmit: (content) {
                widget.onReply(content, widget.comment.id);
                setState(() => _showReplyInput = false);
              },
              onCancel: () => setState(() => _showReplyInput = false),
              hintText: 'Reply to ${widget.comment.userName}...',
            ),
          ),
      ],
    );
  }

  void _confirmDelete(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Comment?'),
        content: const Text(
          'This will permanently delete this comment. This action cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(ctx);
              widget.onDelete(widget.comment.id);
            },
            child: const Text(
              'Delete',
              style: TextStyle(color: Colors.red),
            ),
          ),
        ],
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _ActionButton({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(4),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14, color: Colors.grey[600]),
            const SizedBox(width: 4),
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                color: Colors.grey[600],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CommentInput extends StatefulWidget {
  final String hintText;
  final String? initialValue;
  final Function(String) onSubmit;
  final VoidCallback? onCancel;

  const _CommentInput({
    required this.hintText,
    this.initialValue,
    required this.onSubmit,
    this.onCancel,
  });

  @override
  State<_CommentInput> createState() => _CommentInputState();
}

class _CommentInputState extends State<_CommentInput> {
  late final TextEditingController _controller;
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.initialValue);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _submit() {
    final content = _controller.text.trim();
    if (content.isNotEmpty && !_isSubmitting) {
      setState(() => _isSubmitting = true);
      widget.onSubmit(content);
      _controller.clear();
      setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: isDark ? Colors.grey[900] : Colors.grey[100],
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: isDark ? Colors.grey[800]! : Colors.grey[300]!,
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(
            child: TextField(
              controller: _controller,
              maxLines: null,
              minLines: 1,
              decoration: InputDecoration(
                hintText: widget.hintText,
                border: InputBorder.none,
                contentPadding: const EdgeInsets.all(12),
              ),
              textInputAction: TextInputAction.newline,
            ),
          ),
          if (widget.onCancel != null)
            IconButton(
              icon: const Icon(Icons.close, size: 20),
              onPressed: widget.onCancel,
              color: Colors.grey[600],
            ),
          IconButton(
            icon: _isSubmitting
                ? SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Theme.of(context).primaryColor,
                    ),
                  )
                : const Icon(Icons.send, size: 20),
            onPressed: _submit,
            color: Theme.of(context).primaryColor,
          ),
        ],
      ),
    );
  }
}
