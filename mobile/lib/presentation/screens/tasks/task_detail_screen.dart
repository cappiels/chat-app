import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../data/services/http_client.dart';
import '../../../data/models/thread.dart';
import '../../../data/models/workspace.dart';
import '../chat/chat_screen.dart';

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
  bool _loading = false;

  bool get _isCompleted =>
      widget.task['status'] == 'completed' ||
      widget.task['user_completed'] == true;

  bool get _isOverdue {
    final dueDate = widget.task['due_date'] ?? widget.task['end_date'];
    if (dueDate == null || _isCompleted) return false;
    try {
      return DateTime.parse(dueDate).isBefore(DateTime.now());
    } catch (e) {
      return false;
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
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec'
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

  Future<void> _toggleComplete() async {
    setState(() => _loading = true);

    try {
      final workspaceId = widget.task['workspace_id'];
      final threadId = widget.task['thread_id'];
      final taskId = widget.task['id'];
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

  Future<void> _openInChannel() async {
    final threadId = widget.task['thread_id'];
    if (threadId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No channel associated with this task')),
      );
      return;
    }

    setState(() => _loading = true);

    try {
      // Load the thread details
      final workspaceId = widget.task['workspace_id'];
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

  @override
  Widget build(BuildContext context) {
    final task = widget.task;
    final title = task['title'] ?? 'Untitled';
    final description = task['description'];
    final status = task['status'] ?? 'pending';
    final priority = task['priority'] ?? 'medium';
    final workspaceName = task['workspace_name'] ?? '';
    final channelName = task['channel_name'] ?? '';
    final dueDate = task['due_date'] ?? task['end_date'];
    final startDate = task['start_date'];
    final location = task['location'];
    final assigneeNames = task['assignee_names'] ?? task['assigned_to_name'];
    final progressInfo = task['progress_info'];
    final totalAssignees = task['total_assignees'] ?? 1;

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
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(
            color: Colors.grey.shade200,
            height: 1,
          ),
        ),
      ),
      body: SingleChildScrollView(
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
                      // Status badge
                      _buildStatusBadge(status),
                      // Priority badge
                      _buildPriorityBadge(priority),
                      // Overdue badge
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

                  // Assignees
                  if (assigneeNames != null) ...[
                    _buildMetadataRow(
                      icon: Icons.people_outline,
                      label: 'Assigned to',
                      value: assigneeNames,
                    ),
                    const SizedBox(height: 16),
                  ],

                  // Progress for group tasks
                  if (progressInfo != null && totalAssignees > 1) ...[
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

            // Channel Context
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

                  // Channel
                  _buildMetadataRow(
                    icon: Icons.chat_bubble_outline,
                    label: 'Channel',
                    value: '#$channelName',
                    valueColor: Colors.blue.shade600,
                  ),
                  const SizedBox(height: 20),

                  // Open in Channel button
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: _loading ? null : _openInChannel,
                      icon: const Icon(Icons.chat_bubble),
                      label: const Text('Open in Channel'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.blue.shade600,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
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
}
