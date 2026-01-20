import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../data/services/http_client.dart';
import '../../../data/models/thread.dart';
import '../chat/chat_screen.dart';
import '../../widgets/knowledge/save_to_kb_sheet.dart';

class TaskDetailScreen extends ConsumerStatefulWidget {
  final Map<String, dynamic> task;
  final Map<String, dynamic> workspace;

  const TaskDetailScreen({
    super.key,
    required this.task,
    required this.workspace,
  });

  @override
  ConsumerState<TaskDetailScreen> createState() => _TaskDetailScreenState();
}

class _TaskDetailScreenState extends ConsumerState<TaskDetailScreen> {
  final HttpClient _httpClient = HttpClient();
  final TextEditingController _replyController = TextEditingController();
  final ScrollController _scrollController = ScrollController();

  bool _loading = false;
  bool _loadingReplies = false;
  bool _sendingReply = false;
  List<Map<String, dynamic>> _replies = [];
  int _replyCount = 0;
  late Map<String, dynamic> _task;

  @override
  void initState() {
    super.initState();
    _task = Map<String, dynamic>.from(widget.task);
    _replyCount = _task['reply_count'] ?? 0;
    _loadReplies();
  }

  @override
  void dispose() {
    _replyController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  bool get _isCompleted =>
      _task['status'] == 'completed' ||
      _task['user_completed'] == true;

  bool get _isOverdue {
    final dueDate = _task['due_date'] ?? _task['end_date'];
    if (dueDate == null || _isCompleted) return false;
    try {
      return DateTime.parse(dueDate).isBefore(DateTime.now());
    } catch (e) {
      return false;
    }
  }

  bool get _canEdit {
    // Use the API's user_can_edit field if available
    if (_task['user_can_edit'] == true) return true;

    // Fallback checks
    final isCreator = _task['user_is_creator'] == true;
    final isAdmin = widget.workspace['role'] == 'admin' ||
                    widget.workspace['user_role'] == 'admin';
    return isCreator || isAdmin;
  }

  bool get _canMarkDoneForOthers => _canEdit;

  bool get _hasMultipleAssignees {
    final assigneeDetails = _task['assignee_details'] as List?;
    return (_task['requires_individual_response'] == true) &&
           (assigneeDetails?.length ?? 0) > 1;
  }

  Future<void> _toggleCompleteForUser(String userId, String userName, bool isCurrentlyCompleted) async {
    setState(() => _loading = true);

    try {
      final workspaceId = _task['workspace_id'];
      final threadId = _task['thread_id'];
      final taskId = _task['id'];
      final endpoint = '/api/workspaces/$workspaceId/threads/$threadId/tasks/$taskId/complete';

      if (isCurrentlyCompleted) {
        await _httpClient.delete('$endpoint?target_user_id=$userId');
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Marked incomplete for $userName')),
        );
      } else {
        await _httpClient.post(endpoint, data: {'target_user_id': userId});
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Marked complete for $userName')),
        );
      }

      Navigator.of(context).pop(true); // Return true to indicate change
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to update: $e')),
      );
    } finally {
      setState(() => _loading = false);
    }
  }

  Color _getPriorityColor(String? priority) {
    switch (priority) {
      case 'high':
      case 'urgent':
        return Colors.red;
      case 'medium':
        return Colors.yellow.shade700;
      case 'low':
        return Colors.green;
      default:
        return Colors.grey;
    }
  }

  String _formatDate(String? dateStr) {
    if (dateStr == null) return '';
    try {
      final date = DateTime.parse(dateStr);
      final now = DateTime.now();
      final today = DateTime(now.year, now.month, now.day);
      final tomorrow = today.add(const Duration(days: 1));
      final taskDate = DateTime(date.year, date.month, date.day);

      if (taskDate == today) return 'Today';
      if (taskDate == tomorrow) return 'Tomorrow';

      final months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ];
      final days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

      return '${days[date.weekday - 1]}, ${months[date.month - 1]} ${date.day}';
    } catch (e) {
      return '';
    }
  }

  String _formatTime(String? timeStr) {
    if (timeStr == null) return '';
    try {
      final parts = timeStr.split(':');
      if (parts.length < 2) return '';
      final hour = int.parse(parts[0]);
      final minute = parts[1];
      final ampm = hour >= 12 ? 'PM' : 'AM';
      final hour12 = hour % 12 == 0 ? 12 : hour % 12;
      return '$hour12:$minute $ampm';
    } catch (e) {
      return '';
    }
  }

  String _formatRelativeTime(String? dateStr) {
    if (dateStr == null) return '';
    try {
      final date = DateTime.parse(dateStr);
      final now = DateTime.now();
      final diff = now.difference(date);

      if (diff.inMinutes < 1) return 'Just now';
      if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
      if (diff.inHours < 24) return '${diff.inHours}h ago';
      if (diff.inDays < 7) return '${diff.inDays}d ago';
      return _formatDate(dateStr);
    } catch (e) {
      return '';
    }
  }

  Future<void> _loadReplies() async {
    setState(() => _loadingReplies = true);

    try {
      final workspaceId = _task['workspace_id'];
      final threadId = _task['thread_id'];
      final taskId = _task['id'];

      final response = await _httpClient.get(
        '/api/workspaces/$workspaceId/threads/$threadId/tasks/$taskId/replies'
      );

      final data = response.data;
      setState(() {
        _replies = List<Map<String, dynamic>>.from(data['replies'] ?? []);
        _replyCount = data['total'] ?? _replies.length;
      });
    } catch (e) {
      print('Error loading replies: $e');
    } finally {
      setState(() => _loadingReplies = false);
    }
  }

  Future<void> _sendReply() async {
    final content = _replyController.text.trim();
    if (content.isEmpty) return;

    setState(() => _sendingReply = true);

    try {
      final workspaceId = _task['workspace_id'];
      final threadId = _task['thread_id'];
      final taskId = _task['id'];

      final response = await _httpClient.post(
        '/api/workspaces/$workspaceId/threads/$threadId/tasks/$taskId/replies',
        data: {'content': content},
      );

      _replyController.clear();

      // Add the new reply to the list
      final newReply = response.data['reply'];
      setState(() {
        _replies.add(Map<String, dynamic>.from(newReply));
        _replyCount++;
      });

      // Scroll to bottom
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_scrollController.hasClients) {
          _scrollController.animateTo(
            _scrollController.position.maxScrollExtent,
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeOut,
          );
        }
      });
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to send reply: $e')),
      );
    } finally {
      setState(() => _sendingReply = false);
    }
  }

  Future<void> _toggleComplete() async {
    setState(() => _loading = true);

    try {
      final workspaceId = _task['workspace_id'];
      final threadId = _task['thread_id'];
      final taskId = _task['id'];
      final endpoint =
          '/api/workspaces/$workspaceId/threads/$threadId/tasks/$taskId/complete';

      if (_isCompleted) {
        await _httpClient.delete(endpoint);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Task marked incomplete')),
        );
      } else {
        await _httpClient.post(endpoint, data: {});
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Task completed!')),
        );
      }

      Navigator.of(context).pop(true); // Return true to indicate change
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to update task: $e')),
      );
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _deleteTask() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Task'),
        content: const Text('Are you sure you want to delete this task? This action cannot be undone.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('Delete'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    setState(() => _loading = true);

    try {
      final workspaceId = _task['workspace_id'];
      final threadId = _task['thread_id'];
      final taskId = _task['id'];

      await _httpClient.delete(
        '/api/workspaces/$workspaceId/threads/$threadId/tasks/$taskId'
      );

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Task deleted')),
      );

      Navigator.of(context).pop(true); // Return true to indicate change
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to delete task: $e')),
      );
    } finally {
      setState(() => _loading = false);
    }
  }

  void _showEditSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _TaskEditSheet(
        task: _task,
        workspace: widget.workspace,
        onSaved: (updatedTask) {
          setState(() {
            _task = updatedTask;
          });
        },
      ),
    );
  }

  Future<void> _openInChannel() async {
    final threadId = _task['thread_id'];
    if (threadId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No channel associated with this task')),
      );
      return;
    }

    setState(() => _loading = true);

    try {
      // Load the thread details
      final workspaceId = _task['workspace_id'];
      final response =
          await _httpClient.get('/api/workspaces/$workspaceId/threads');

      final threadsData = response.data['threads'] as List;
      final threadData = threadsData.firstWhere(
        (t) => t['id'] == threadId,
        orElse: () => null,
      );

      if (threadData == null) {
        throw Exception('Channel not found');
      }

      final thread = Thread.fromJson(threadData);

      if (!mounted) return;

      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (context) => ChatScreen(
            workspace: widget.workspace,
            thread: thread,
          ),
        ),
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to open channel: $e')),
      );
    } finally {
      setState(() => _loading = false);
    }
  }

  void _saveToKB() {
    final title = _task['title'] as String?;
    final description = _task['description'] as String? ?? '';
    final priority = _task['priority'] as String?;
    final status = _task['status'] as String?;
    final dueDate = _task['due_date'] ?? _task['end_date'];
    final assigneeNames = _task['assignee_names'] ?? _task['assigned_to_name'];

    // Build content from task details
    final contentParts = <String>[];
    if (title != null) contentParts.add('**Task:** $title');
    if (description.isNotEmpty) contentParts.add('\n$description');
    if (priority != null) contentParts.add('\n**Priority:** $priority');
    if (status != null) contentParts.add('**Status:** $status');
    if (dueDate != null) contentParts.add('**Due:** ${_formatDate(dueDate)}');
    if (assigneeNames != null) contentParts.add('**Assigned to:** $assigneeNames');

    SaveToKBSheet.show(
      context,
      workspaceId: _task['workspace_id'] as String,
      title: title,
      content: contentParts.join('\n'),
      sourceType: 'task',
      sourceId: _task['id'] as String?,
      metadata: {
        'task_id': _task['id'],
        'priority': priority,
        'status': status,
        'due_date': dueDate,
        'assignee_names': assigneeNames,
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final title = _task['title'] ?? 'Untitled';
    final description = _task['description'];
    final status = _task['status'] ?? 'pending';
    final priority = _task['priority'] ?? 'medium';
    final workspaceName = _task['workspace_name'] ?? '';
    final channelName = _task['channel_name'] ?? '';
    final dueDate = _task['due_date'] ?? _task['end_date'];
    final startDate = _task['start_date'];
    final location = _task['location'];
    final assigneeNames = _task['assignee_names'] ?? _task['assigned_to_name'];
    final progressInfo = _task['progress_info'];
    final totalAssignees = _task['total_assignees'] ?? 1;

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: const Text('Task Details'),
        backgroundColor: Colors.white,
        foregroundColor: Colors.grey.shade900,
        elevation: 0,
        actions: [
          // Save to Knowledge Base
          IconButton(
            icon: Icon(Icons.menu_book_rounded, color: Colors.indigo.shade600),
            onPressed: _loading ? null : _saveToKB,
            tooltip: 'Save to Knowledge Base',
          ),
          if (_canEdit) ...[
            IconButton(
              icon: const Icon(Icons.edit_outlined),
              onPressed: _loading ? null : _showEditSheet,
              tooltip: 'Edit task',
            ),
            IconButton(
              icon: Icon(Icons.delete_outline, color: Colors.red.shade400),
              onPressed: _loading ? null : _deleteTask,
              tooltip: 'Delete task',
            ),
          ],
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(
            color: Colors.grey.shade200,
            height: 1,
          ),
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: SingleChildScrollView(
              controller: _scrollController,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Task Header
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      border: Border(
                        bottom: BorderSide(color: Colors.grey.shade200),
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Title with checkbox
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // Completion checkbox
                            GestureDetector(
                              onTap: _loading ? null : _toggleComplete,
                              child: Container(
                                width: 28,
                                height: 28,
                                margin: const EdgeInsets.only(top: 2, right: 12),
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  border: Border.all(
                                    color: _isCompleted
                                        ? Colors.green
                                        : _getPriorityColor(priority),
                                    width: 2,
                                  ),
                                  color: _isCompleted ? Colors.green : Colors.transparent,
                                ),
                                child: _loading
                                    ? const SizedBox(
                                        width: 16,
                                        height: 16,
                                        child: CircularProgressIndicator(
                                          strokeWidth: 2,
                                          color: Colors.green,
                                        ),
                                      )
                                    : _isCompleted
                                        ? const Icon(
                                            Icons.check,
                                            size: 18,
                                            color: Colors.white,
                                          )
                                        : null,
                              ),
                            ),
                            // Title
                            Expanded(
                              child: Text(
                                title,
                                style: TextStyle(
                                  fontSize: 20,
                                  fontWeight: FontWeight.w600,
                                  color: _isCompleted
                                      ? Colors.grey.shade400
                                      : Colors.grey.shade900,
                                  decoration:
                                      _isCompleted ? TextDecoration.lineThrough : null,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),

                        // Status badges
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            _buildStatusBadge(status),
                            _buildPriorityBadge(priority),
                            if (_isOverdue)
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 12, vertical: 6),
                                decoration: BoxDecoration(
                                  color: Colors.red.shade50,
                                  borderRadius: BorderRadius.circular(20),
                                  border: Border.all(color: Colors.red.shade200),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(Icons.warning_amber,
                                        size: 14, color: Colors.red.shade700),
                                    const SizedBox(width: 4),
                                    Text(
                                      'Overdue',
                                      style: TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w500,
                                        color: Colors.red.shade700,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                          ],
                        ),
                      ],
                    ),
                  ),

                  // Task Metadata
                  Container(
                    padding: const EdgeInsets.all(20),
                    color: Colors.white,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Due date
                        if (dueDate != null) ...[
                          _buildMetadataRow(
                            icon: Icons.calendar_today,
                            label: 'Due Date',
                            value: _formatDate(dueDate),
                            valueColor:
                                _isOverdue ? Colors.red.shade600 : Colors.grey.shade700,
                          ),
                          const SizedBox(height: 16),
                        ],

                        // Start date
                        if (startDate != null && startDate != dueDate) ...[
                          _buildMetadataRow(
                            icon: Icons.access_time,
                            label: 'Start Date',
                            value: _formatDate(startDate),
                          ),
                          const SizedBox(height: 16),
                        ],

                        // Assignees section with completion status
                        if (_task['assignee_details'] != null && (_task['assignee_details'] as List).isNotEmpty) ...[
                          _buildAssigneeSection(),
                          const SizedBox(height: 16),
                        ] else if (assigneeNames != null) ...[
                          // Fallback to simple display if no detailed info
                          _buildMetadataRow(
                            icon: Icons.people_outline,
                            label: 'Assigned to',
                            value: assigneeNames,
                          ),
                          const SizedBox(height: 16),
                        ],

                        // Progress for group tasks (when no detailed assignee info)
                        if (progressInfo != null && totalAssignees > 1 && _task['assignee_details'] == null) ...[
                          _buildMetadataRow(
                            icon: Icons.person_outline,
                            label: 'Progress',
                            value: progressInfo,
                            valueColor: Colors.blue.shade600,
                          ),
                          const SizedBox(height: 16),
                        ],

                        // Location
                        if (location != null && location.isNotEmpty) ...[
                          _buildMetadataRow(
                            icon: Icons.location_on_outlined,
                            label: 'Location',
                            value: location,
                          ),
                          const SizedBox(height: 16),
                        ],

                        // Description
                        if (description != null && description.isNotEmpty) ...[
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.only(top: 16),
                            decoration: BoxDecoration(
                              border: Border(
                                top: BorderSide(color: Colors.grey.shade200),
                              ),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Description',
                                  style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w500,
                                    color: Colors.grey.shade700,
                                  ),
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  description,
                                  style: TextStyle(
                                    fontSize: 14,
                                    color: Colors.grey.shade600,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),

                  const SizedBox(height: 8),

                  // Channel Context with Chat Icon
                  Container(
                    padding: const EdgeInsets.all(20),
                    color: Colors.grey.shade50,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Workspace
                        _buildMetadataRow(
                          icon: Icons.business_outlined,
                          label: 'Workspace',
                          value: workspaceName,
                        ),
                        const SizedBox(height: 16),

                        // Channel with chat icon
                        Row(
                          children: [
                            Icon(Icons.tag, size: 20, color: Colors.grey.shade400),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Channel',
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w500,
                                      color: Colors.grey.shade600,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    '#$channelName',
                                    style: TextStyle(
                                      fontSize: 14,
                                      color: Colors.blue.shade600,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            // Chat icon with message count
                            InkWell(
                              onTap: _loading ? null : _openInChannel,
                              borderRadius: BorderRadius.circular(8),
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                decoration: BoxDecoration(
                                  color: _replyCount > 0 ? Colors.blue.shade50 : Colors.grey.shade100,
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(
                                      Icons.chat_bubble_outline,
                                      size: 18,
                                      color: _replyCount > 0 ? Colors.blue.shade600 : Colors.grey.shade500,
                                    ),
                                    if (_replyCount > 0) ...[
                                      const SizedBox(width: 4),
                                      Text(
                                        '$_replyCount',
                                        style: TextStyle(
                                          fontSize: 13,
                                          fontWeight: FontWeight.w600,
                                          color: Colors.blue.shade600,
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 8),

                  // Discussion Section
                  Container(
                    padding: const EdgeInsets.all(20),
                    color: Colors.white,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Icon(Icons.forum_outlined, size: 20, color: Colors.grey.shade600),
                            const SizedBox(width: 8),
                            Text(
                              'Discussion',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                                color: Colors.grey.shade800,
                              ),
                            ),
                            const SizedBox(width: 8),
                            if (_replyCount > 0)
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                decoration: BoxDecoration(
                                  color: Colors.blue.shade100,
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: Text(
                                  '$_replyCount',
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                    color: Colors.blue.shade700,
                                  ),
                                ),
                              ),
                          ],
                        ),
                        const SizedBox(height: 16),

                        // Replies list
                        if (_loadingReplies)
                          const Center(
                            child: Padding(
                              padding: EdgeInsets.all(20),
                              child: CircularProgressIndicator(),
                            ),
                          )
                        else if (_replies.isEmpty)
                          Container(
                            padding: const EdgeInsets.all(20),
                            decoration: BoxDecoration(
                              color: Colors.grey.shade50,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Center(
                              child: Column(
                                children: [
                                  Icon(
                                    Icons.chat_bubble_outline,
                                    size: 32,
                                    color: Colors.grey.shade400,
                                  ),
                                  const SizedBox(height: 8),
                                  Text(
                                    'No discussion yet',
                                    style: TextStyle(
                                      fontSize: 14,
                                      color: Colors.grey.shade600,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    'Start a conversation about this task',
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: Colors.grey.shade500,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          )
                        else
                          ListView.builder(
                            shrinkWrap: true,
                            physics: const NeverScrollableScrollPhysics(),
                            itemCount: _replies.length,
                            itemBuilder: (context, index) {
                              final reply = _replies[index];
                              return _buildReplyItem(reply);
                            },
                          ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 80), // Space for input
                ],
              ),
            ),
          ),

          // Reply input
          Container(
            padding: EdgeInsets.only(
              left: 16,
              right: 16,
              top: 12,
              bottom: MediaQuery.of(context).viewInsets.bottom > 0
                  ? 12
                  : MediaQuery.of(context).padding.bottom + 12,
            ),
            decoration: BoxDecoration(
              color: Colors.white,
              border: Border(
                top: BorderSide(color: Colors.grey.shade200),
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.05),
                  blurRadius: 10,
                  offset: const Offset(0, -2),
                ),
              ],
            ),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _replyController,
                    decoration: InputDecoration(
                      hintText: 'Add a comment...',
                      hintStyle: TextStyle(color: Colors.grey.shade500),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(24),
                        borderSide: BorderSide(color: Colors.grey.shade300),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(24),
                        borderSide: BorderSide(color: Colors.grey.shade300),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(24),
                        borderSide: BorderSide(color: Colors.blue.shade400, width: 1.5),
                      ),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                      filled: true,
                      fillColor: Colors.grey.shade50,
                    ),
                    maxLines: 3,
                    minLines: 1,
                    textInputAction: TextInputAction.send,
                    onSubmitted: (_) => _sendReply(),
                  ),
                ),
                const SizedBox(width: 8),
                Material(
                  color: Colors.blue.shade600,
                  borderRadius: BorderRadius.circular(24),
                  child: InkWell(
                    onTap: _sendingReply ? null : _sendReply,
                    borderRadius: BorderRadius.circular(24),
                    child: Container(
                      padding: const EdgeInsets.all(10),
                      child: _sendingReply
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Icon(
                              Icons.send,
                              size: 20,
                              color: Colors.white,
                            ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildReplyItem(Map<String, dynamic> reply) {
    final senderName = reply['sender_name'] ?? 'Unknown';
    final content = reply['content'] ?? '';
    final createdAt = reply['created_at'];
    final senderAvatar = reply['sender_avatar'];

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Avatar
          CircleAvatar(
            radius: 16,
            backgroundColor: Colors.blue.shade100,
            backgroundImage: senderAvatar != null ? NetworkImage(senderAvatar) : null,
            child: senderAvatar == null
                ? Text(
                    senderName.isNotEmpty ? senderName[0].toUpperCase() : '?',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: Colors.blue.shade700,
                    ),
                  )
                : null,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      senderName,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: Colors.grey.shade800,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      _formatRelativeTime(createdAt),
                      style: TextStyle(
                        fontSize: 11,
                        color: Colors.grey.shade500,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  content,
                  style: TextStyle(
                    fontSize: 14,
                    color: Colors.grey.shade700,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusBadge(String status) {
    Color bgColor;
    Color textColor;
    String label;

    switch (status) {
      case 'completed':
        bgColor = Colors.green.shade100;
        textColor = Colors.green.shade700;
        label = 'Completed';
        break;
      case 'in_progress':
        bgColor = Colors.blue.shade100;
        textColor = Colors.blue.shade700;
        label = 'In Progress';
        break;
      case 'blocked':
        bgColor = Colors.red.shade100;
        textColor = Colors.red.shade700;
        label = 'Blocked';
        break;
      case 'cancelled':
        bgColor = Colors.grey.shade200;
        textColor = Colors.grey.shade600;
        label = 'Cancelled';
        break;
      default:
        bgColor = Colors.grey.shade100;
        textColor = Colors.grey.shade700;
        label = 'Pending';
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w500,
          color: textColor,
        ),
      ),
    );
  }

  Widget _buildPriorityBadge(String priority) {
    Color bgColor;
    Color textColor;
    String label;

    switch (priority) {
      case 'urgent':
        bgColor = Colors.red.shade100;
        textColor = Colors.red.shade700;
        label = 'Urgent';
        break;
      case 'high':
        bgColor = Colors.orange.shade100;
        textColor = Colors.orange.shade700;
        label = 'High';
        break;
      case 'low':
        bgColor = Colors.green.shade100;
        textColor = Colors.green.shade700;
        label = 'Low';
        break;
      default:
        bgColor = Colors.yellow.shade100;
        textColor = Colors.yellow.shade800;
        label = 'Medium';
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        '$label Priority',
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w500,
          color: textColor,
        ),
      ),
    );
  }

  Widget _buildMetadataRow({
    required IconData icon,
    required String label,
    required String value,
    Color? valueColor,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 20, color: Colors.grey.shade400),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                  color: Colors.grey.shade600,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                value,
                style: TextStyle(
                  fontSize: 14,
                  color: valueColor ?? Colors.grey.shade800,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildAssigneeSection() {
    final assigneeDetails = _task['assignee_details'] as List? ?? [];
    final completions = _task['individual_completions'] as Map<String, dynamic>? ?? {};
    final requiresIndividual = _task['requires_individual_response'] == true;

    // Count completions
    final completedCount = completions.length;
    final totalCount = assigneeDetails.length;

    return Container(
      padding: const EdgeInsets.only(top: 16),
      decoration: BoxDecoration(
        border: Border(
          top: BorderSide(color: Colors.grey.shade200),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header with progress
          Row(
            children: [
              Icon(Icons.people_outline, size: 20, color: Colors.grey.shade600),
              const SizedBox(width: 8),
              Text(
                'Assignees',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: Colors.grey.shade800,
                ),
              ),
              const Spacer(),
              if (requiresIndividual && totalCount > 1)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: completedCount == totalCount
                        ? Colors.green.shade100
                        : Colors.blue.shade100,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    '$completedCount/$totalCount done',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: completedCount == totalCount
                          ? Colors.green.shade700
                          : Colors.blue.shade700,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),

          // Assignee list
          ...assigneeDetails.map((assignee) {
            final assigneeMap = assignee as Map<String, dynamic>;
            final assigneeId = assigneeMap['id'] as String? ?? '';
            final displayName = assigneeMap['display_name'] as String? ?? 'Unknown';
            final isCompleted = completions.containsKey(assigneeId);

            return Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: isCompleted ? Colors.green.shade50 : Colors.grey.shade100,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: isCompleted ? Colors.green.shade200 : Colors.grey.shade300,
                ),
              ),
              child: Row(
                children: [
                  // Avatar
                  CircleAvatar(
                    radius: 16,
                    backgroundColor: isCompleted ? Colors.green.shade100 : Colors.grey.shade300,
                    child: Text(
                      displayName.isNotEmpty ? displayName[0].toUpperCase() : '?',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                        color: isCompleted ? Colors.green.shade700 : Colors.grey.shade700,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),

                  // Name and status
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          displayName,
                          style: TextStyle(
                            fontWeight: FontWeight.w500,
                            color: isCompleted ? Colors.green.shade700 : Colors.grey.shade800,
                          ),
                        ),
                        if (isCompleted)
                          Text(
                            'Completed',
                            style: TextStyle(
                              fontSize: 12,
                              color: Colors.green.shade600,
                            ),
                          ),
                      ],
                    ),
                  ),

                  // Toggle button for admin/creator
                  if (_canMarkDoneForOthers && _hasMultipleAssignees)
                    IconButton(
                      icon: Icon(
                        isCompleted ? Icons.check_circle : Icons.radio_button_unchecked,
                        color: isCompleted ? Colors.green : Colors.grey,
                      ),
                      onPressed: _loading
                          ? null
                          : () => _toggleCompleteForUser(assigneeId, displayName, isCompleted),
                      tooltip: isCompleted ? 'Mark incomplete' : 'Mark complete',
                    )
                  else if (isCompleted)
                    Icon(Icons.check_circle, color: Colors.green.shade400, size: 20),
                ],
              ),
            );
          }).toList(),
        ],
      ),
    );
  }
}

// Task Edit Sheet Widget
class _TaskEditSheet extends StatefulWidget {
  final Map<String, dynamic> task;
  final Map<String, dynamic> workspace;
  final Function(Map<String, dynamic>) onSaved;

  const _TaskEditSheet({
    required this.task,
    required this.workspace,
    required this.onSaved,
  });

  @override
  State<_TaskEditSheet> createState() => _TaskEditSheetState();
}

class _TaskEditSheetState extends State<_TaskEditSheet> {
  final HttpClient _httpClient = HttpClient();
  final _formKey = GlobalKey<FormState>();

  late TextEditingController _titleController;
  late TextEditingController _descriptionController;

  String _status = 'pending';
  String _priority = 'medium';
  DateTime? _dueDate;
  bool _saving = false;

  // Assignee editing
  List<Map<String, dynamic>> _workspaceMembers = [];
  List<String> _selectedAssigneeIds = [];
  bool _loadingMembers = true;

  @override
  void initState() {
    super.initState();
    _titleController = TextEditingController(text: widget.task['title'] ?? '');
    _descriptionController = TextEditingController(text: widget.task['description'] ?? '');
    _status = widget.task['status'] ?? 'pending';
    _priority = widget.task['priority'] ?? 'medium';

    final dueDateStr = widget.task['due_date'] ?? widget.task['end_date'];
    if (dueDateStr != null) {
      try {
        _dueDate = DateTime.parse(dueDateStr);
      } catch (_) {}
    }

    // Initialize selected assignees from task data
    final assignees = widget.task['assignees'] as List?;
    if (assignees != null) {
      _selectedAssigneeIds = assignees.map((e) => e.toString()).toList();
    }

    _loadWorkspaceMembers();
  }

  Future<void> _loadWorkspaceMembers() async {
    try {
      final workspaceId = widget.workspace['id'];
      final response = await _httpClient.get('/api/workspaces/$workspaceId/members');

      if (response.data != null && response.data['members'] != null) {
        setState(() {
          _workspaceMembers = List<Map<String, dynamic>>.from(response.data['members']);
          _loadingMembers = false;
        });
      }
    } catch (e) {
      print('Error loading workspace members: $e');
      setState(() => _loadingMembers = false);
    }
  }

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _selectDueDate() async {
    final date = await showDatePicker(
      context: context,
      initialDate: _dueDate ?? DateTime.now(),
      firstDate: DateTime.now().subtract(const Duration(days: 365)),
      lastDate: DateTime.now().add(const Duration(days: 365 * 3)),
    );

    if (date != null) {
      setState(() => _dueDate = date);
    }
  }

  void _toggleAssignee(String userId) {
    setState(() {
      if (_selectedAssigneeIds.contains(userId)) {
        _selectedAssigneeIds.remove(userId);
      } else {
        _selectedAssigneeIds.add(userId);
      }
    });
  }

  Widget _buildAssigneeSelector() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Assignees',
          style: TextStyle(
            fontSize: 12,
            color: Colors.grey.shade600,
          ),
        ),
        const SizedBox(height: 8),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            border: Border.all(color: Colors.grey.shade400),
            borderRadius: BorderRadius.circular(12),
          ),
          child: _loadingMembers
              ? const Center(
                  child: SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                )
              : _workspaceMembers.isEmpty
                  ? Text(
                      'No members found',
                      style: TextStyle(color: Colors.grey.shade600),
                    )
                  : Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: _workspaceMembers.map((member) {
                        final userId = member['user_id'] ?? member['id'] ?? '';
                        final displayName = member['display_name'] ?? member['name'] ?? 'Unknown';
                        final isSelected = _selectedAssigneeIds.contains(userId);

                        return FilterChip(
                          label: Text(displayName),
                          selected: isSelected,
                          onSelected: (_) => _toggleAssignee(userId),
                          selectedColor: Colors.blue.shade100,
                          checkmarkColor: Colors.blue.shade700,
                          labelStyle: TextStyle(
                            color: isSelected ? Colors.blue.shade700 : Colors.grey.shade800,
                            fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                          ),
                          avatar: CircleAvatar(
                            backgroundColor: isSelected ? Colors.blue.shade200 : Colors.grey.shade300,
                            child: Text(
                              displayName.isNotEmpty ? displayName[0].toUpperCase() : '?',
                              style: TextStyle(
                                fontSize: 12,
                                color: isSelected ? Colors.blue.shade700 : Colors.grey.shade700,
                              ),
                            ),
                          ),
                        );
                      }).toList(),
                    ),
        ),
        if (_selectedAssigneeIds.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(
              '${_selectedAssigneeIds.length} assignee${_selectedAssigneeIds.length != 1 ? 's' : ''} selected',
              style: TextStyle(
                fontSize: 12,
                color: Colors.blue.shade600,
              ),
            ),
          ),
      ],
    );
  }

  Future<void> _saveTask() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _saving = true);

    try {
      final workspaceId = widget.task['workspace_id'];
      final threadId = widget.task['thread_id'];
      final taskId = widget.task['id'];

      final response = await _httpClient.put(
        '/api/workspaces/$workspaceId/threads/$threadId/tasks/$taskId',
        data: {
          'title': _titleController.text.trim(),
          'description': _descriptionController.text.trim(),
          'status': _status,
          'priority': _priority,
          'due_date': _dueDate?.toIso8601String(),
          'assignees': _selectedAssigneeIds,
        },
      );

      // Create updated task map
      final updatedTask = Map<String, dynamic>.from(widget.task);
      updatedTask['title'] = _titleController.text.trim();
      updatedTask['description'] = _descriptionController.text.trim();
      updatedTask['status'] = _status;
      updatedTask['priority'] = _priority;
      updatedTask['due_date'] = _dueDate?.toIso8601String();
      updatedTask['assignees'] = _selectedAssigneeIds;

      // Update assignee_details based on selected assignees
      final updatedAssigneeDetails = _workspaceMembers
          .where((m) => _selectedAssigneeIds.contains(m['user_id'] ?? m['id']))
          .map((m) => {
            'id': m['user_id'] ?? m['id'],
            'display_name': m['display_name'] ?? m['name'] ?? 'Unknown',
            'email': m['email'] ?? '',
          })
          .toList();
      updatedTask['assignee_details'] = updatedAssigneeDetails;
      updatedTask['total_assignees'] = updatedAssigneeDetails.length;

      widget.onSaved(updatedTask);

      if (mounted) {
        Navigator.of(context).pop();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Task updated')),
        );
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to save: $e')),
      );
    } finally {
      setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                // Handle bar
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: Colors.grey.shade300,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 20),

                // Header
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Edit Task',
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    TextButton(
                      onPressed: () => Navigator.of(context).pop(),
                      child: const Text('Cancel'),
                    ),
                  ],
                ),
                const SizedBox(height: 20),

                // Title field
                TextFormField(
                  controller: _titleController,
                  decoration: InputDecoration(
                    labelText: 'Title',
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  validator: (value) {
                    if (value == null || value.trim().isEmpty) {
                      return 'Title is required';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 16),

                // Description field
                TextFormField(
                  controller: _descriptionController,
                  decoration: InputDecoration(
                    labelText: 'Description',
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  maxLines: 3,
                ),
                const SizedBox(height: 16),

                // Status dropdown
                DropdownButtonFormField<String>(
                  value: _status,
                  decoration: InputDecoration(
                    labelText: 'Status',
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  items: const [
                    DropdownMenuItem(value: 'pending', child: Text('Pending')),
                    DropdownMenuItem(value: 'in_progress', child: Text('In Progress')),
                    DropdownMenuItem(value: 'completed', child: Text('Completed')),
                    DropdownMenuItem(value: 'blocked', child: Text('Blocked')),
                  ],
                  onChanged: (value) {
                    if (value != null) setState(() => _status = value);
                  },
                ),
                const SizedBox(height: 16),

                // Priority dropdown
                DropdownButtonFormField<String>(
                  value: _priority,
                  decoration: InputDecoration(
                    labelText: 'Priority',
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  items: const [
                    DropdownMenuItem(value: 'low', child: Text('Low')),
                    DropdownMenuItem(value: 'medium', child: Text('Medium')),
                    DropdownMenuItem(value: 'high', child: Text('High')),
                    DropdownMenuItem(value: 'urgent', child: Text('Urgent')),
                  ],
                  onChanged: (value) {
                    if (value != null) setState(() => _priority = value);
                  },
                ),
                const SizedBox(height: 16),

                // Due date picker
                InkWell(
                  onTap: _selectDueDate,
                  child: InputDecorator(
                    decoration: InputDecoration(
                      labelText: 'Due Date',
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      suffixIcon: const Icon(Icons.calendar_today),
                    ),
                    child: Text(
                      _dueDate != null
                          ? '${_dueDate!.month}/${_dueDate!.day}/${_dueDate!.year}'
                          : 'Select a date',
                      style: TextStyle(
                        color: _dueDate != null ? Colors.black : Colors.grey.shade600,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                // Assignees section
                _buildAssigneeSelector(),
                const SizedBox(height: 24),

                // Save button
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _saving ? null : _saveTask,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.blue.shade600,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: _saving
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Text(
                            'Save Changes',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                  ),
                ),
                const SizedBox(height: 20),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
