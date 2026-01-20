import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../../../data/models/knowledge_topic.dart';
import '../../../data/models/knowledge_comment.dart';
import '../../../data/services/knowledge_service.dart';
import '../../widgets/knowledge/vote_buttons.dart';
import '../../widgets/knowledge/comment_thread.dart';
import '../../widgets/chat/rich_text_content.dart';

class TopicDetailScreen extends ConsumerStatefulWidget {
  final String workspaceId;
  final String topicId;
  final VoidCallback? onTopicDeleted;

  const TopicDetailScreen({
    super.key,
    required this.workspaceId,
    required this.topicId,
    this.onTopicDeleted,
  });

  @override
  ConsumerState<TopicDetailScreen> createState() => _TopicDetailScreenState();
}

class _TopicDetailScreenState extends ConsumerState<TopicDetailScreen> {
  KnowledgeTopic? _topic;
  List<KnowledgeComment> _comments = [];
  bool _isLoading = true;
  bool _isCommentsLoading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    await Future.wait([
      _loadTopic(),
      _loadComments(),
    ]);
  }

  Future<void> _loadTopic() async {
    setState(() => _isLoading = true);

    try {
      final service = ref.read(knowledgeServiceProvider);
      final topic = await service.getTopic(widget.workspaceId, widget.topicId);

      if (mounted) {
        setState(() {
          _topic = topic;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to load topic: $e')),
        );
      }
    }
  }

  Future<void> _loadComments() async {
    setState(() => _isCommentsLoading = true);

    try {
      final service = ref.read(knowledgeServiceProvider);
      final comments =
          await service.getComments(widget.workspaceId, widget.topicId);

      if (mounted) {
        setState(() {
          _comments = comments;
          _isCommentsLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isCommentsLoading = false);
      }
    }
  }

  Future<void> _handleTopicVote(String voteType) async {
    try {
      final service = ref.read(knowledgeServiceProvider);
      final response = await service.voteOnTopic(
        widget.workspaceId,
        widget.topicId,
        voteType,
      );

      setState(() {
        _topic = _topic?.copyWith(
          userVote: voteType,
          upvotesCount: response.upvotesCount,
          downvotesCount: response.downvotesCount,
        );
      });
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to vote: $e')),
      );
    }
  }

  Future<void> _handleRemoveTopicVote() async {
    try {
      final service = ref.read(knowledgeServiceProvider);
      final response = await service.removeTopicVote(
        widget.workspaceId,
        widget.topicId,
      );

      setState(() {
        _topic = _topic?.copyWith(
          userVote: null,
          upvotesCount: response.upvotesCount,
          downvotesCount: response.downvotesCount,
        );
      });
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to remove vote: $e')),
      );
    }
  }

  Future<void> _handleLock(bool locked) async {
    try {
      final service = ref.read(knowledgeServiceProvider);
      final topic = await service.lockTopic(
        widget.workspaceId,
        widget.topicId,
        locked,
      );

      setState(() => _topic = topic);

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(locked ? 'Topic locked' : 'Topic unlocked')),
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to ${locked ? 'lock' : 'unlock'} topic: $e')),
      );
    }
  }

  Future<void> _handlePin(bool pinned) async {
    try {
      final service = ref.read(knowledgeServiceProvider);
      final topic = await service.pinTopic(
        widget.workspaceId,
        widget.topicId,
        pinned,
      );

      setState(() => _topic = topic);

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(pinned ? 'Topic pinned' : 'Topic unpinned')),
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to ${pinned ? 'pin' : 'unpin'} topic: $e')),
      );
    }
  }

  Future<void> _handleDelete() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Topic?'),
        content: const Text(
          'This will permanently delete this topic and all its comments. This action cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text(
              'Delete',
              style: TextStyle(color: Colors.red),
            ),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      try {
        final service = ref.read(knowledgeServiceProvider);
        await service.deleteTopic(widget.workspaceId, widget.topicId);

        widget.onTopicDeleted?.call();
        if (mounted) Navigator.pop(context);
      } catch (e) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to delete topic: $e')),
        );
      }
    }
  }

  Future<void> _handleAddComment(String content) async {
    try {
      final service = ref.read(knowledgeServiceProvider);
      final comment =
          await service.addComment(widget.workspaceId, widget.topicId, content);

      setState(() {
        _comments = [..._comments, comment];
        _topic = _topic?.copyWith(
          commentCount: (_topic?.commentCount ?? 0) + 1,
        );
      });
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to add comment: $e')),
      );
    }
  }

  Future<void> _handleReply(String content, String? parentCommentId) async {
    try {
      final service = ref.read(knowledgeServiceProvider);
      final comment = await service.addComment(
        widget.workspaceId,
        widget.topicId,
        content,
        parentCommentId: parentCommentId,
      );

      setState(() {
        _comments = _addReplyToComments(_comments, parentCommentId!, comment);
        _topic = _topic?.copyWith(
          commentCount: (_topic?.commentCount ?? 0) + 1,
        );
      });
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to add reply: $e')),
      );
    }
  }

  List<KnowledgeComment> _addReplyToComments(
    List<KnowledgeComment> comments,
    String parentId,
    KnowledgeComment newReply,
  ) {
    return comments.map((c) {
      if (c.id == parentId) {
        return c.copyWith(replies: [...c.replies, newReply]);
      }
      if (c.replies.isNotEmpty) {
        return c.copyWith(
          replies: _addReplyToComments(c.replies, parentId, newReply),
        );
      }
      return c;
    }).toList();
  }

  Future<void> _handleEditComment(String commentId, String content) async {
    try {
      final service = ref.read(knowledgeServiceProvider);
      final updated = await service.editComment(
        widget.workspaceId,
        commentId,
        content,
      );

      setState(() {
        _comments = _updateCommentInTree(_comments, commentId, updated);
      });
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to edit comment: $e')),
      );
    }
  }

  List<KnowledgeComment> _updateCommentInTree(
    List<KnowledgeComment> comments,
    String commentId,
    KnowledgeComment updated,
  ) {
    return comments.map((c) {
      if (c.id == commentId) {
        return updated.copyWith(replies: c.replies);
      }
      if (c.replies.isNotEmpty) {
        return c.copyWith(
          replies: _updateCommentInTree(c.replies, commentId, updated),
        );
      }
      return c;
    }).toList();
  }

  Future<void> _handleDeleteComment(String commentId) async {
    try {
      final service = ref.read(knowledgeServiceProvider);
      await service.deleteComment(widget.workspaceId, commentId);

      setState(() {
        _comments = _removeCommentFromTree(_comments, commentId);
        _topic = _topic?.copyWith(
          commentCount: (_topic?.commentCount ?? 1) - 1,
        );
      });
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to delete comment: $e')),
      );
    }
  }

  List<KnowledgeComment> _removeCommentFromTree(
    List<KnowledgeComment> comments,
    String commentId,
  ) {
    return comments
        .where((c) => c.id != commentId)
        .map((c) => c.copyWith(
              replies: _removeCommentFromTree(c.replies, commentId),
            ))
        .toList();
  }

  Future<void> _handleCommentVote(String commentId, String voteType) async {
    try {
      final service = ref.read(knowledgeServiceProvider);
      final response = await service.voteOnComment(
        widget.workspaceId,
        commentId,
        voteType,
      );

      setState(() {
        _comments = _updateVoteInTree(
          _comments,
          commentId,
          voteType,
          response.upvotesCount,
          response.downvotesCount,
        );
      });
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to vote: $e')),
      );
    }
  }

  Future<void> _handleRemoveCommentVote(String commentId) async {
    try {
      final service = ref.read(knowledgeServiceProvider);
      final response = await service.removeCommentVote(
        widget.workspaceId,
        commentId,
      );

      setState(() {
        _comments = _updateVoteInTree(
          _comments,
          commentId,
          null,
          response.upvotesCount,
          response.downvotesCount,
        );
      });
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to remove vote: $e')),
      );
    }
  }

  List<KnowledgeComment> _updateVoteInTree(
    List<KnowledgeComment> comments,
    String commentId,
    String? userVote,
    int upvotes,
    int downvotes,
  ) {
    return comments.map((c) {
      if (c.id == commentId) {
        return c.copyWith(
          userVote: userVote,
          upvotesCount: upvotes,
          downvotesCount: downvotes,
        );
      }
      if (c.replies.isNotEmpty) {
        return c.copyWith(
          replies: _updateVoteInTree(c.replies, commentId, userVote, upvotes, downvotes),
        );
      }
      return c;
    }).toList();
  }

  String _formatDate(DateTime date) {
    return '${date.month}/${date.day}/${date.year} at ${date.hour}:${date.minute.toString().padLeft(2, '0')}';
  }

  Color _parseColor(String? colorString) {
    if (colorString == null || colorString.isEmpty) {
      return Colors.indigo;
    }
    try {
      final hex = colorString.replaceFirst('#', '');
      return Color(int.parse('FF$hex', radix: 16));
    } catch (e) {
      return Colors.indigo;
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final currentUserId = FirebaseAuth.instance.currentUser?.uid;

    if (_isLoading || _topic == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Loading...')),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    final topic = _topic!;
    final categoryColor = _parseColor(topic.categoryColor);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Topic'),
        actions: [
          if (topic.userCanModerate || topic.isOwner)
            PopupMenuButton<String>(
              icon: const Icon(Icons.more_vert),
              onSelected: (value) {
                switch (value) {
                  case 'lock':
                    _handleLock(!topic.isLocked);
                    break;
                  case 'pin':
                    _handlePin(!topic.isPinned);
                    break;
                  case 'delete':
                    _handleDelete();
                    break;
                }
              },
              itemBuilder: (ctx) => [
                if (topic.userCanModerate) ...[
                  PopupMenuItem(
                    value: 'lock',
                    child: Row(
                      children: [
                        Icon(
                          topic.isLocked ? Icons.lock_open : Icons.lock,
                          size: 20,
                        ),
                        const SizedBox(width: 12),
                        Text(topic.isLocked ? 'Unlock' : 'Lock'),
                      ],
                    ),
                  ),
                  PopupMenuItem(
                    value: 'pin',
                    child: Row(
                      children: [
                        Icon(
                          topic.isPinned ? Icons.push_pin_outlined : Icons.push_pin,
                          size: 20,
                        ),
                        const SizedBox(width: 12),
                        Text(topic.isPinned ? 'Unpin' : 'Pin'),
                      ],
                    ),
                  ),
                ],
                if (topic.userCanModerate || topic.isOwner)
                  const PopupMenuItem(
                    value: 'delete',
                    child: Row(
                      children: [
                        Icon(Icons.delete_outline, size: 20, color: Colors.red),
                        SizedBox(width: 12),
                        Text('Delete', style: TextStyle(color: Colors.red)),
                      ],
                    ),
                  ),
              ],
            ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _loadData,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Topic content card
              Card(
                margin: const EdgeInsets.all(16),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Vote column
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: isDark ? Colors.grey[900] : Colors.grey[50],
                            borderRadius: const BorderRadius.only(
                              topLeft: Radius.circular(12),
                              bottomLeft: Radius.circular(12),
                            ),
                          ),
                          child: VoteButtons(
                            upvotes: topic.upvotesCount,
                            downvotes: topic.downvotesCount,
                            userVote: topic.userVote,
                            onVote: _handleTopicVote,
                            onRemoveVote: _handleRemoveTopicVote,
                            size: VoteButtonsSize.large,
                          ),
                        ),

                        // Content
                        Expanded(
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                // Badges
                                Wrap(
                                  spacing: 8,
                                  runSpacing: 4,
                                  children: [
                                    if (topic.isPinned)
                                      _Badge(
                                        icon: Icons.push_pin_rounded,
                                        label: 'Pinned',
                                        color: Colors.amber,
                                      ),
                                    if (topic.isLocked)
                                      _Badge(
                                        icon: Icons.lock_rounded,
                                        label: 'Locked',
                                        color: Colors.grey,
                                      ),
                                    if (topic.categoryName != null)
                                      _Badge(
                                        label: topic.categoryName!,
                                        color: categoryColor,
                                      ),
                                  ],
                                ),

                                const SizedBox(height: 12),

                                // Title
                                Text(
                                  topic.title,
                                  style: theme.textTheme.headlineSmall?.copyWith(
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),

                                const SizedBox(height: 12),

                                // Meta info
                                Row(
                                  children: [
                                    if (topic.creatorAvatar != null)
                                      CircleAvatar(
                                        radius: 12,
                                        backgroundImage:
                                            NetworkImage(topic.creatorAvatar!),
                                      )
                                    else
                                      CircleAvatar(
                                        radius: 12,
                                        backgroundColor: isDark
                                            ? Colors.grey[700]
                                            : Colors.grey[300],
                                        child: Icon(
                                          Icons.person,
                                          size: 14,
                                          color: isDark
                                              ? Colors.grey[400]
                                              : Colors.grey[600],
                                        ),
                                      ),
                                    const SizedBox(width: 8),
                                    Text(
                                      topic.creatorName ?? 'Unknown',
                                      style: theme.textTheme.bodySmall?.copyWith(
                                        fontWeight: FontWeight.w500,
                                      ),
                                    ),
                                    const SizedBox(width: 12),
                                    Icon(
                                      Icons.access_time,
                                      size: 14,
                                      color: Colors.grey[500],
                                    ),
                                    const SizedBox(width: 4),
                                    Text(
                                      _formatDate(topic.createdAt),
                                      style: theme.textTheme.bodySmall?.copyWith(
                                        color: Colors.grey[500],
                                      ),
                                    ),
                                  ],
                                ),

                                const SizedBox(height: 16),

                                // Content with @mentions support
                                FormattedTextContent(
                                  content: topic.content,
                                  style: theme.textTheme.bodyLarge,
                                ),

                                const SizedBox(height: 16),

                                // Stats
                                Row(
                                  children: [
                                    Icon(
                                      Icons.visibility_outlined,
                                      size: 16,
                                      color: Colors.grey[500],
                                    ),
                                    const SizedBox(width: 4),
                                    Text(
                                      '${topic.viewsCount} views',
                                      style: TextStyle(color: Colors.grey[500]),
                                    ),
                                    const SizedBox(width: 16),
                                    Icon(
                                      Icons.chat_bubble_outline,
                                      size: 16,
                                      color: Colors.grey[500],
                                    ),
                                    const SizedBox(width: 4),
                                    Text(
                                      '${topic.commentCount} comments',
                                      style: TextStyle(color: Colors.grey[500]),
                                    ),
                                  ],
                                ),

                                // Source info
                                if (topic.sourceType == 'message')
                                  Container(
                                    margin: const EdgeInsets.only(top: 12),
                                    padding: const EdgeInsets.all(12),
                                    decoration: BoxDecoration(
                                      color: Colors.blue.withOpacity(0.1),
                                      borderRadius: BorderRadius.circular(8),
                                      border: Border.all(
                                        color: Colors.blue.withOpacity(0.3),
                                      ),
                                    ),
                                    child: Row(
                                      children: [
                                        Icon(
                                          Icons.bookmark_added,
                                          size: 18,
                                          color: Colors.blue[700],
                                        ),
                                        const SizedBox(width: 8),
                                        Text(
                                          'Saved from chat message',
                                          style: TextStyle(
                                            color: Colors.blue[700],
                                            fontSize: 13,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              // Comments section header
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Row(
                  children: [
                    const Icon(Icons.chat_bubble_outline),
                    const SizedBox(width: 8),
                    Text(
                      'Comments (${topic.commentCount})',
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 16),

              // Comments
              if (_isCommentsLoading)
                const Center(
                  child: Padding(
                    padding: EdgeInsets.all(32),
                    child: CircularProgressIndicator(),
                  ),
                )
              else
                CommentThread(
                  comments: _comments,
                  isLocked: topic.isLocked,
                  currentUserId: currentUserId,
                  onAddComment: _handleAddComment,
                  onReply: _handleReply,
                  onEdit: _handleEditComment,
                  onDelete: _handleDeleteComment,
                  onVote: _handleCommentVote,
                  onRemoveVote: _handleRemoveCommentVote,
                ),

              const SizedBox(height: 80),
            ],
          ),
        ),
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  final IconData? icon;
  final String label;
  final Color color;

  const _Badge({
    this.icon,
    required this.label,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(isDark ? 0.2 : 0.1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 14, color: color),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w500,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}
