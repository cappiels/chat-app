import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../../../data/models/task.dart';
import '../../../data/services/task_service.dart';
import 'edit_task_dialog.dart';

/// Widget for showing task details with edit/delete/complete actions
class TaskDetailsSheet extends StatefulWidget {
  final ChannelTask task;
  final String workspaceId;
  final String? workspaceRole; // 'admin', 'member', etc.
  final VoidCallback? onTaskUpdated;
  final VoidCallback? onTaskDeleted;

  const TaskDetailsSheet({
    Key? key,
    required this.task,
    required this.workspaceId,
    this.workspaceRole,
    this.onTaskUpdated,
    this.onTaskDeleted,
  }) : super(key: key);

  @override
  State<TaskDetailsSheet> createState() => _TaskDetailsSheetState();
}

class _TaskDetailsSheetState extends State<TaskDetailsSheet> {
  final TaskService _taskService = TaskService();
  final FirebaseAuth _auth = FirebaseAuth.instance;

  bool _isLoading = false;
  String? _error;
  late ChannelTask _task;

  // Task color mappings
  static const Map<String, Color> _statusColors = {
    'pending': Color(0xFFF3F4F6),
    'in_progress': Color(0xFFDBEAFE),
    'completed': Color(0xFFD1FAE5),
    'blocked': Color(0xFFFEE2E2),
    'cancelled': Color(0xFFF3F4F6),
  };

  static const Map<String, Color> _statusTextColors = {
    'pending': Color(0xFF374151),
    'in_progress': Color(0xFF1E40AF),
    'completed': Color(0xFF065F46),
    'blocked': Color(0xFF991B1B),
    'cancelled': Color(0xFF6B7280),
  };

  static const Map<String, Color> _priorityColors = {
    'low': Color(0xFFD1D5DB),
    'medium': Color(0xFF3B82F6),
    'high': Color(0xFFF97316),
    'urgent': Color(0xFFEF4444),
  };

  @override
  void initState() {
    super.initState();
    _task = widget.task;
  }

  String? get _currentUserId => _auth.currentUser?.uid;

  bool get _isAdmin => widget.workspaceRole == 'admin';
  bool get _isCreator => _task.createdBy == _currentUserId;
  bool get _isAssignee => _task.userIsAssignee || _task.assignees.contains(_currentUserId);

  // Permissions
  bool get _canEdit => _isAdmin || _isCreator;
  bool get _canDelete => _isAdmin || _isCreator;
  bool get _canMarkDone => _isAdmin || _isCreator || _isAssignee;
  bool get _canMarkDoneForOthers => _isAdmin || _isCreator;

  bool get _hasMultipleAssignees =>
      _task.requiresIndividualResponse &&
      (_task.assigneeDetails?.length ?? 0) > 1;

  Future<void> _handleMarkDone() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      if (_task.userCompleted || _task.isComplete) {
        // Unmark as complete
        await _taskService.markTaskIncomplete(
          workspaceId: widget.workspaceId,
          threadId: _task.threadId,
          taskId: _task.id,
        );
      } else {
        // Mark as complete
        await _taskService.markTaskComplete(
          workspaceId: widget.workspaceId,
          threadId: _task.threadId,
          taskId: _task.id,
        );
      }

      widget.onTaskUpdated?.call();
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(_task.userCompleted ? 'Task marked as incomplete' : 'Task marked as complete'),
            backgroundColor: Colors.green,
          ),
        );
      }
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  Future<void> _handleMarkDoneForUser(String userId, String userName, bool isCompleted) async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      if (isCompleted) {
        await _taskService.markTaskIncompleteForUser(
          workspaceId: widget.workspaceId,
          threadId: _task.threadId,
          taskId: _task.id,
          targetUserId: userId,
        );
      } else {
        await _taskService.markTaskCompleteForUser(
          workspaceId: widget.workspaceId,
          threadId: _task.threadId,
          taskId: _task.id,
          targetUserId: userId,
        );
      }

      widget.onTaskUpdated?.call();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(isCompleted
                ? 'Marked incomplete for $userName'
                : 'Marked complete for $userName'),
            backgroundColor: Colors.green,
          ),
        );
        Navigator.pop(context);
      }
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  Future<void> _handleMarkAllDone() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Mark All Complete'),
        content: const Text('This will mark the task as complete for all assignees. Continue?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.green),
            child: const Text('Mark All Complete'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      await _taskService.markTaskCompleteForAll(
        workspaceId: widget.workspaceId,
        threadId: _task.threadId,
        taskId: _task.id,
      );

      widget.onTaskUpdated?.call();
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Task marked complete for all assignees'),
            backgroundColor: Colors.green,
          ),
        );
      }
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  Future<void> _handleDelete() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Task'),
        content: Text('Are you sure you want to delete "${_task.title}"? This action cannot be undone.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Delete'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      await _taskService.deleteTask(
        workspaceId: widget.workspaceId,
        threadId: _task.threadId,
        taskId: _task.id,
      );

      widget.onTaskDeleted?.call();
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Task deleted'),
            backgroundColor: Colors.orange,
          ),
        );
      }
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  void _handleEdit() {
    Navigator.pop(context);
    showDialog(
      context: context,
      builder: (context) => EditTaskDialog(
        task: _task,
        workspaceId: widget.workspaceId,
        onTaskUpdated: widget.onTaskUpdated,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final dateFormat = DateFormat('MMM d, yyyy');

    return Container(
      padding: const EdgeInsets.all(20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Handle bar
          Center(
            child: Container(
              width: 40,
              height: 4,
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color: Colors.grey[300],
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),

          // Scrollable content
          Flexible(
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Title and status
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Text(
                          _task.title,
                          style: const TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                      if (_task.isComplete)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: Colors.green[100],
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.check_circle, size: 14, color: Colors.green[700]),
                              const SizedBox(width: 4),
                              Text(
                                'Complete',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: Colors.green[700],
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 12),

                  // Status and Priority
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          color: _statusColors[_task.status] ?? Colors.grey[200],
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          _task.status.replaceAll('_', ' ').toUpperCase(),
                          style: TextStyle(
                            color: _statusTextColors[_task.status] ?? Colors.grey[700],
                            fontWeight: FontWeight.w600,
                            fontSize: 12,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      if (_task.priority != 'medium')
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                          decoration: BoxDecoration(
                            color: _priorityColors[_task.priority]?.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                _task.priority == 'urgent'
                                    ? Icons.priority_high
                                    : Icons.flag,
                                size: 14,
                                color: _priorityColors[_task.priority],
                              ),
                              const SizedBox(width: 4),
                              Text(
                                _task.priority.toUpperCase(),
                                style: TextStyle(
                                  color: _priorityColors[_task.priority],
                                  fontWeight: FontWeight.w600,
                                  fontSize: 11,
                                ),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // Description
                  if (_task.description != null && _task.description!.isNotEmpty) ...[
                    Text(
                      _task.description!,
                      style: TextStyle(
                        fontSize: 15,
                        color: Colors.grey[700],
                        height: 1.5,
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],

                  // Details
                  _buildDetailRow(Icons.calendar_today, 'Start', _task.startDate != null ? dateFormat.format(_task.startDate!) : 'Not set'),
                  if (_task.endDate != null)
                    _buildDetailRow(Icons.event, 'End', dateFormat.format(_task.endDate!)),
                  if (_task.dueDate != null)
                    _buildDetailRow(Icons.flag_outlined, 'Due', dateFormat.format(_task.dueDate!)),
                  if (_task.estimatedHours != null)
                    _buildDetailRow(Icons.access_time, 'Estimated', '${_task.estimatedHours}h'),
                  if (_task.createdByName != null)
                    _buildDetailRow(Icons.person_outline, 'Created by', _task.createdByName!),

                  // Assignees section
                  if (_task.assigneeDetails != null && _task.assigneeDetails!.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    const Divider(),
                    const SizedBox(height: 12),
                    Text(
                      'Assignees',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: Colors.grey[800],
                      ),
                    ),
                    const SizedBox(height: 8),
                    ..._buildAssigneeList(),
                  ],

                  // Progress for group tasks
                  if (_hasMultipleAssignees && _task.progressInfo != null) ...[
                    const SizedBox(height: 16),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.blue[50],
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        children: [
                          Icon(Icons.group, size: 20, color: Colors.blue[700]),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Individual Progress',
                                  style: TextStyle(
                                    fontWeight: FontWeight.w600,
                                    color: Colors.blue[700],
                                  ),
                                ),
                                Text(
                                  _task.completionText,
                                  style: TextStyle(
                                    fontSize: 18,
                                    fontWeight: FontWeight.bold,
                                    color: Colors.blue[800],
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],

                  // Error message
                  if (_error != null) ...[
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.red[50],
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        children: [
                          Icon(Icons.error_outline, color: Colors.red[700], size: 20),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              _error!,
                              style: TextStyle(color: Colors.red[700], fontSize: 13),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],

                  const SizedBox(height: 24),

                  // Action buttons
                  _buildActionButtons(),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDetailRow(IconData icon, String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Icon(icon, size: 18, color: Colors.grey[600]),
          const SizedBox(width: 10),
          Text(
            '$label: ',
            style: TextStyle(
              fontSize: 14,
              color: Colors.grey[600],
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }

  List<Widget> _buildAssigneeList() {
    final assignees = _task.assigneeDetails ?? [];
    final completions = _task.individualCompletions ?? {};

    return assignees.map((assignee) {
      final isCompleted = completions.containsKey(assignee.id);
      final isCurrentUser = assignee.id == _currentUserId;

      return Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: isCompleted ? Colors.green[50] : Colors.grey[100],
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: isCompleted ? Colors.green[200]! : Colors.grey[300]!,
          ),
        ),
        child: Row(
          children: [
            CircleAvatar(
              radius: 16,
              backgroundColor: isCompleted ? Colors.green[100] : Colors.grey[300],
              child: Text(
                assignee.displayName.isNotEmpty ? assignee.displayName[0].toUpperCase() : '?',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                  color: isCompleted ? Colors.green[700] : Colors.grey[700],
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        assignee.displayName,
                        style: TextStyle(
                          fontWeight: FontWeight.w500,
                          color: isCompleted ? Colors.green[700] : Colors.grey[800],
                        ),
                      ),
                      if (isCurrentUser)
                        Container(
                          margin: const EdgeInsets.only(left: 6),
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: Colors.blue[100],
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            'You',
                            style: TextStyle(
                              fontSize: 10,
                              color: Colors.blue[700],
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                    ],
                  ),
                  if (isCompleted)
                    Text(
                      'Completed',
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.green[600],
                      ),
                    ),
                ],
              ),
            ),
            if (_canMarkDoneForOthers && _hasMultipleAssignees)
              IconButton(
                icon: Icon(
                  isCompleted ? Icons.check_circle : Icons.radio_button_unchecked,
                  color: isCompleted ? Colors.green : Colors.grey,
                ),
                onPressed: _isLoading
                    ? null
                    : () => _handleMarkDoneForUser(assignee.id, assignee.displayName, isCompleted),
                tooltip: isCompleted ? 'Mark incomplete' : 'Mark complete',
              ),
          ],
        ),
      );
    }).toList();
  }

  Widget _buildActionButtons() {
    return Column(
      children: [
        // Primary action - Mark Done
        if (_canMarkDone && !_task.isComplete) ...[
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: _isLoading ? null : _handleMarkDone,
              icon: _isLoading
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Icon(Icons.check_circle_outline),
              label: Text(_task.userCompleted ? 'Mark Incomplete' : 'Mark Complete'),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.green,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
          ),
          const SizedBox(height: 10),
        ],

        // Mark All Done (for group tasks, admin/creator only)
        if (_canMarkDoneForOthers && _hasMultipleAssignees && !_task.isComplete) ...[
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: _isLoading ? null : _handleMarkAllDone,
              icon: const Icon(Icons.done_all),
              label: const Text('Mark All Assignees Complete'),
              style: OutlinedButton.styleFrom(
                foregroundColor: Colors.green[700],
                side: BorderSide(color: Colors.green[300]!),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
          ),
          const SizedBox(height: 10),
        ],

        // Edit and Delete buttons
        Row(
          children: [
            if (_canEdit)
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _isLoading ? null : _handleEdit,
                  icon: const Icon(Icons.edit_outlined),
                  label: const Text('Edit'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.blue[700],
                    side: BorderSide(color: Colors.blue[300]!),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                ),
              ),
            if (_canEdit && _canDelete)
              const SizedBox(width: 10),
            if (_canDelete)
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _isLoading ? null : _handleDelete,
                  icon: const Icon(Icons.delete_outline),
                  label: const Text('Delete'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.red[700],
                    side: BorderSide(color: Colors.red[300]!),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                ),
              ),
          ],
        ),
      ],
    );
  }
}

/// Shows the task details sheet
void showTaskDetailsSheet({
  required BuildContext context,
  required ChannelTask task,
  required String workspaceId,
  String? workspaceRole,
  VoidCallback? onTaskUpdated,
  VoidCallback? onTaskDeleted,
}) {
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (context) => DraggableScrollableSheet(
      initialChildSize: 0.7,
      minChildSize: 0.4,
      maxChildSize: 0.95,
      expand: false,
      builder: (context, scrollController) => TaskDetailsSheet(
        task: task,
        workspaceId: workspaceId,
        workspaceRole: workspaceRole,
        onTaskUpdated: onTaskUpdated,
        onTaskDeleted: onTaskDeleted,
      ),
    ),
  );
}
