import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../data/models/task.dart';
import '../../../data/models/thread.dart';
import '../../../data/models/workspace.dart';
import '../../../data/services/task_service.dart';
import '../../../data/services/workspace_service.dart';
import '../../widgets/tasks/quick_task_dialog.dart';
import '../../widgets/tasks/task_details_sheet.dart';
import '../../widgets/calendar/workspace_channel_picker.dart';
import '../../widgets/calendar/channel_picker_dialog.dart';

class ChannelTimelineScreen extends StatefulWidget {
  final Thread? thread;
  final Workspace? workspace;

  const ChannelTimelineScreen({
    Key? key,
    this.thread,
    this.workspace,
  }) : super(key: key);

  @override
  State<ChannelTimelineScreen> createState() => _ChannelTimelineScreenState();
}

class _ChannelTimelineScreenState extends State<ChannelTimelineScreen> {
  final TaskService _taskService = TaskService();
  final WorkspaceService _workspaceService = WorkspaceService();
  final ScrollController _scrollController = ScrollController();
  
  List<ChannelTask> _tasks = [];
  List<Map<String, dynamic>> _taskData = [];
  bool _isLoading = false;
  String? _error;
  DateTime? _timelineStart;
  DateTime? _timelineEnd;
  WorkspaceChannelSelection? _selection;
  
  // Task color mappings
  static const Map<String, Color> _statusColors = {
    'pending': Color(0xFF9CA3AF),
    'in_progress': Color(0xFF3B82F6),
    'completed': Color(0xFF10B981),
    'blocked': Color(0xFFEF4444),
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
    // Start in "all workspaces" mode if no specific thread/workspace provided
    if (widget.thread == null || widget.workspace == null) {
      _selection = WorkspaceChannelSelection(showAllWorkspaces: true);
    }
    _loadTasks();
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _showWorkspacePicker(BuildContext context) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (context) => Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
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
            const Text(
              'Filter Timeline',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 16),
            WorkspaceChannelPicker(
              currentWorkspace: widget.workspace,
              onSelectionChange: (selection) {
                Navigator.pop(context);
                setState(() => _selection = selection);
                _loadTasks();
              },
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  Future<void> _loadTasks() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      List<ChannelTask> tasks;

      if (_selection?.showAllWorkspaces == true) {
        // Fetch ALL workspaces
        final taskData = await _workspaceService.getAllWorkspacesTasks();
        _taskData = taskData;
        tasks = taskData.map((data) => ChannelTask.fromJson(data)).toList();
      } else if (_selection?.workspace != null && _selection?.channel == null) {
        // Fetch all channels in workspace
        final taskData = await _workspaceService.getWorkspacesTasks(
          workspaceIds: _selection!.workspaceIds,
        );
        _taskData = taskData;
        tasks = taskData.map((data) => ChannelTask.fromJson(data)).toList();
      } else if (_selection?.channel != null) {
        // Fetch specific channel
        tasks = await _taskService.getChannelTasks(
          workspaceId: _selection!.workspace!.id,
          threadId: _selection!.channel!['id'].toString(),
          limit: 200,
        );
        _taskData = [];
      } else if (widget.workspace != null && widget.thread != null) {
        // Fallback to current channel (only if both are provided)
        tasks = await _taskService.getChannelTasks(
          workspaceId: widget.workspace!.id,
          threadId: widget.thread!.id,
          limit: 200,
        );
        _taskData = [];
      } else {
        // No workspace/thread provided, fetch all workspaces
        final taskData = await _workspaceService.getAllWorkspacesTasks();
        _taskData = taskData;
        tasks = taskData.map((data) => ChannelTask.fromJson(data)).toList();
      }
      
      // Calculate timeline bounds
      DateTime? minDate;
      DateTime? maxDate;
      
      for (var task in tasks) {
        if (task.startDate != null) {
          if (minDate == null || task.startDate!.isBefore(minDate)) {
            minDate = task.startDate;
          }
        }
        if (task.endDate != null) {
          if (maxDate == null || task.endDate!.isAfter(maxDate)) {
            maxDate = task.endDate;
          }
        }
        if (task.dueDate != null) {
          if (maxDate == null || task.dueDate!.isAfter(maxDate)) {
            maxDate = task.dueDate;
          }
        }
      }
      
      // Add padding to timeline
      if (minDate != null && maxDate != null) {
        _timelineStart = minDate.subtract(const Duration(days: 7));
        _timelineEnd = maxDate.add(const Duration(days: 7));
      } else {
        // Default to current month
        final now = DateTime.now();
        _timelineStart = DateTime(now.year, now.month, 1);
        _timelineEnd = DateTime(now.year, now.month + 1, 0);
      }
      
      setState(() {
        _tasks = tasks;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  String _formatDateRange(DateTime? start, DateTime? end) {
    if (start == null && end == null) return 'No dates';
    
    final format = DateFormat('MMM d, yyyy');
    if (start != null && end != null) {
      return '${format.format(start)} - ${format.format(end)}';
    } else if (start != null) {
      return format.format(start);
    } else {
      return format.format(end!);
    }
  }

  double _getTimelinePosition(DateTime? date) {
    if (date == null || _timelineStart == null || _timelineEnd == null) {
      return 0;
    }
    
    final startMs = _timelineStart!.millisecondsSinceEpoch;
    final endMs = _timelineEnd!.millisecondsSinceEpoch;
    final dateMs = date.millisecondsSinceEpoch;
    
    if (dateMs < startMs) return 0;
    if (dateMs > endMs) return 1;
    
    return (dateMs - startMs) / (endMs - startMs);
  }

  double _getTaskBarWidth(ChannelTask task) {
    if (_timelineStart == null || _timelineEnd == null) return 0.05;
    
    final startDate = task.startDate;
    final endDate = task.endDate ?? task.startDate;
    
    if (startDate == null || endDate == null) return 0.05; // Milestone
    
    final totalTimelineMs = _timelineEnd!.millisecondsSinceEpoch - 
                           _timelineStart!.millisecondsSinceEpoch;
    final taskDurationMs = endDate.millisecondsSinceEpoch - 
                          startDate.millisecondsSinceEpoch;
    
    final width = taskDurationMs / totalTimelineMs;
    return width.clamp(0.02, 1.0); // Min 2% width
  }

  List<ChannelTask> _organizeTaskHierarchy() {
    final Map<String, ChannelTask> taskMap = {};
    final List<ChannelTask> rootTasks = [];
    
    // Create map for quick lookup (task.id is now String UUID)
    for (var task in _tasks) {
      taskMap[task.id] = task;
    }
    
    // Organize hierarchy
    for (var task in _tasks) {
      if (task.parentTaskId != null && taskMap.containsKey(task.parentTaskId)) {
        // This is a subtask - will be handled separately
        continue;
      } else {
        // Root level task
        rootTasks.add(task);
      }
    }
    
    return rootTasks;
  }

  List<DateTime> _generateTimelineWeeks() {
    if (_timelineStart == null || _timelineEnd == null) return [];
    
    final weeks = <DateTime>[];
    DateTime current = DateTime(_timelineStart!.year, _timelineStart!.month, _timelineStart!.day);
    
    while (current.isBefore(_timelineEnd!)) {
      weeks.add(current);
      current = current.add(const Duration(days: 7));
    }
    
    return weeks;
  }

  void _showTaskDetails(ChannelTask task) {
    final workspaceId = _selection?.workspace?.id ?? widget.workspace?.id ?? task.workspaceId;
    final workspaceRole = _selection?.workspace?.role ?? widget.workspace?.role;

    showTaskDetailsSheet(
      context: context,
      task: task,
      workspaceId: workspaceId,
      workspaceRole: workspaceRole,
      onTaskUpdated: _loadTasks,
      onTaskDeleted: _loadTasks,
    );
  }

  Widget _buildTaskRow(ChannelTask task, int depth) {
    final hasStartEnd = task.startDate != null && task.endDate != null;
    final progress = task.progressPercentage;
    final barWidth = _getTaskBarWidth(task);
    final barLeft = _getTimelinePosition(task.startDate);
    
    return Container(
      decoration: BoxDecoration(
        color: depth > 0 ? Colors.grey[50] : null,
        border: Border(
          bottom: BorderSide(color: Colors.grey[200]!, width: 1),
        ),
      ),
      child: InkWell(
        onTap: () => _showTaskDetails(task),
        child: Padding(
          padding: EdgeInsets.only(
            left: 16.0 + (depth * 24.0),
            right: 16,
            top: 12,
            bottom: 12,
          ),
          child: Row(
            children: [
              // Task info (30% of screen)
              Expanded(
                flex: 3,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 12,
                          height: 12,
                          decoration: BoxDecoration(
                            color: _statusColors[task.status],
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            task.title,
                            style: const TextStyle(
                              fontWeight: FontWeight.w600,
                              fontSize: 14,
                            ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        if (task.assigneeDetails != null && 
                            task.assigneeDetails!.isNotEmpty) ...[
                          Icon(Icons.person, size: 12, color: Colors.grey[600]),
                          const SizedBox(width: 4),
                          Text(
                            task.assigneeDetails!.first.displayName,
                            style: TextStyle(
                              fontSize: 11,
                              color: Colors.grey[600],
                            ),
                          ),
                          if (task.assigneeDetails!.length > 1) ...[
                            const SizedBox(width: 4),
                            Text(
                              '+${task.assigneeDetails!.length - 1}',
                              style: TextStyle(
                                fontSize: 11,
                                color: Colors.grey[600],
                              ),
                            ),
                          ],
                          const SizedBox(width: 8),
                        ],
                        if (task.estimatedHours != null) ...[
                          Icon(Icons.access_time, size: 12, color: Colors.grey[600]),
                          const SizedBox(width: 4),
                          Text(
                            '${task.estimatedHours}h',
                            style: TextStyle(
                              fontSize: 11,
                              color: Colors.grey[600],
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
              
              const SizedBox(width: 16),
              
              // Timeline bar (70% of screen)
              Expanded(
                flex: 7,
                child: Container(
                  height: 32,
                  decoration: BoxDecoration(
                    color: Colors.grey[100],
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: hasStartEnd
                      ? LayoutBuilder(
                          builder: (context, constraints) {
                            return Stack(
                              children: [
                                Positioned(
                                  left: barLeft * constraints.maxWidth,
                                  width: barWidth * constraints.maxWidth,
                                  top: 4,
                                  bottom: 4,
                                  child: Container(
                                    decoration: BoxDecoration(
                                      color: _statusColors[task.status],
                                      borderRadius: BorderRadius.circular(3),
                                      border: Border(
                                        left: BorderSide(
                                          color: _priorityColors[task.priority] ?? Colors.grey,
                                          width: 3,
                                        ),
                                      ),
                                    ),
                                    child: Stack(
                                      children: [
                                        // Progress overlay
                                        if (progress > 0)
                                          Positioned.fill(
                                            child: FractionallySizedBox(
                                              widthFactor: progress / 100,
                                              alignment: Alignment.centerLeft,
                                              child: Container(
                                                decoration: BoxDecoration(
                                                  color: Colors.black.withOpacity(0.2),
                                                  borderRadius: const BorderRadius.only(
                                                    topLeft: Radius.circular(3),
                                                    bottomLeft: Radius.circular(3),
                                                  ),
                                                ),
                                              ),
                                            ),
                                          ),
                                        // Task title in bar
                                        Center(
                                          child: Padding(
                                            padding: const EdgeInsets.symmetric(horizontal: 8),
                                            child: Text(
                                              task.title,
                                              style: const TextStyle(
                                                color: Colors.white,
                                                fontSize: 11,
                                                fontWeight: FontWeight.w600,
                                              ),
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ],
                            );
                          },
                        )
                      : Center(
                          child: Transform.rotate(
                            angle: 0.785398, // 45 degrees in radians
                            child: Container(
                              width: 12,
                              height: 12,
                              decoration: BoxDecoration(
                                color: _statusColors[task.status],
                                border: Border.all(color: Colors.white, width: 2),
                              ),
                            ),
                          ),
                        ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final organizedTasks = _organizeTaskHierarchy();
    final timelineWeeks = _generateTimelineWeeks();
    
    String titleText = _selection?.showAllWorkspaces == true
        ? 'All Workspaces Timeline'
        : _selection?.workspace != null
            ? '${_selection!.workspace!.name} Timeline'
            : widget.thread != null
                ? '# ${widget.thread!.name} Timeline'
                : 'Timeline';
    
    return Scaffold(
      appBar: AppBar(
        title: Text(
          titleText,
          style: const TextStyle(fontSize: 16),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.filter_list),
            onPressed: () => _showWorkspacePicker(context),
            tooltip: 'Filter workspaces',
          ),
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadTasks,
            tooltip: 'Refresh',
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.error_outline,
                          size: 64,
                          color: Colors.red[300],
                        ),
                        const SizedBox(height: 16),
                        const Text(
                          'Failed to load timeline',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          _error!,
                          textAlign: TextAlign.center,
                          style: TextStyle(color: Colors.grey[600]),
                        ),
                        const SizedBox(height: 24),
                        ElevatedButton(
                          onPressed: _loadTasks,
                          child: const Text('Try Again'),
                        ),
                      ],
                    ),
                  ),
                )
              : _tasks.isEmpty
                  ? Center(
                      child: Padding(
                        padding: const EdgeInsets.all(20),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.timeline,
                              size: 64,
                              color: Colors.purple[200],
                            ),
                            const SizedBox(height: 16),
                            Text(
                              widget.thread != null
                                  ? 'No tasks in # ${widget.thread!.name}'
                                  : 'No tasks found',
                              style: const TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Create tasks to see them in timeline view',
                              textAlign: TextAlign.center,
                              style: TextStyle(color: Colors.grey[600]),
                            ),
                          ],
                        ),
                      ),
                    )
                  : Column(
                      children: [
                        // Stats bar
                        Container(
                          padding: const EdgeInsets.all(16),
                          color: Colors.grey[100],
                          child: Row(
                            children: [
                              Icon(Icons.timeline, size: 20, color: Colors.grey[700]),
                              const SizedBox(width: 8),
                              Text(
                                '${_tasks.length} task${_tasks.length != 1 ? 's' : ''}',
                                style: TextStyle(
                                  fontSize: 14,
                                  color: Colors.grey[700],
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                              if (_timelineStart != null && _timelineEnd != null) ...[
                                const SizedBox(width: 4),
                                Text(
                                  '• ${_formatDateRange(_timelineStart, _timelineEnd)}',
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: Colors.grey[600],
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                        
                        // Timeline header
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                          decoration: BoxDecoration(
                            color: Colors.grey[200],
                            border: Border(
                              bottom: BorderSide(color: Colors.grey[300]!, width: 2),
                            ),
                          ),
                          child: Row(
                            children: [
                              const Expanded(
                                flex: 3,
                                child: Text(
                                  'TASKS',
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.bold,
                                    color: Colors.black87,
                                    letterSpacing: 0.5,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 16),
                              Expanded(
                                flex: 7,
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: timelineWeeks.take(4).map((week) {
                                    return Text(
                                      DateFormat('MMM d').format(week),
                                      style: TextStyle(
                                        fontSize: 10,
                                        color: Colors.grey[700],
                                      ),
                                    );
                                  }).toList(),
                                ),
                              ),
                            ],
                          ),
                        ),
                        
                        // Task rows
                        Expanded(
                          child: ListView.builder(
                            controller: _scrollController,
                            itemCount: organizedTasks.length,
                            itemBuilder: (context, index) {
                              return _buildTaskRow(organizedTasks[index], 0);
                            },
                          ),
                        ),
                      ],
                    ),
      floatingActionButton: _buildFloatingActionButton(),
    );
  }

  Widget? _buildFloatingActionButton() {
    // Determine the workspace and channel for task creation
    final effectiveWorkspace = _selection?.workspace ?? widget.workspace;
    final effectiveChannel = _selection?.channel;
    final effectiveThread = widget.thread;
    final selectedChannels = _selection?.channels ?? [];
    final selectedWorkspaces = _selection?.workspaces ?? [];

    // Check if we have a valid channel to create tasks in
    final bool hasMultipleChannels = selectedChannels.length > 1;
    final bool hasSingleChannel = (effectiveWorkspace != null && effectiveChannel != null) ||
                                  selectedChannels.length == 1;
    final bool canCreateTask = hasSingleChannel || hasMultipleChannels ||
                               (widget.workspace != null && widget.thread != null);

    if (!canCreateTask) {
      // Show disabled FAB with tooltip
      return FloatingActionButton(
        onPressed: () {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Select a workspace and channel to create tasks'),
              duration: Duration(seconds: 2),
            ),
          );
        },
        backgroundColor: Colors.grey.shade400,
        child: const Icon(Icons.add, color: Colors.white70),
        tooltip: 'Select a channel first',
      );
    }

    return FloatingActionButton(
      onPressed: () async {
        // Check if multiple channels are selected - need to pick one
        if (hasMultipleChannels) {
          final pickedChannel = await ChannelPickerDialog.show(
            context: context,
            selectedChannels: selectedChannels,
            workspaces: selectedWorkspaces,
          );

          if (pickedChannel == null) return; // User cancelled

          // Find the workspace for this channel
          final workspace = selectedWorkspaces.firstWhere(
            (ws) => ws.id == pickedChannel.workspaceId,
            orElse: () => selectedWorkspaces.first,
          );

          final threadForTask = Thread(
            id: pickedChannel.channelId,
            name: pickedChannel.channel['name'] ?? 'Channel',
            workspaceId: pickedChannel.workspaceId,
            type: 'channel',
            createdAt: DateTime.now(),
            updatedAt: DateTime.now(),
          );

          if (!mounted) return;
          showDialog(
            context: context,
            builder: (context) => QuickTaskDialog(
              thread: threadForTask,
              workspace: workspace,
              onTaskCreated: () {
                _loadTasks();
              },
            ),
          );
          return;
        }

        // Single channel selected - use it directly
        Thread threadForTask;
        Workspace workspaceForTask;

        if (selectedChannels.length == 1) {
          final channelData = selectedChannels.first;
          final workspace = selectedWorkspaces.firstWhere(
            (ws) => ws.id == channelData.workspaceId,
            orElse: () => selectedWorkspaces.first,
          );
          threadForTask = Thread(
            id: channelData.channelId,
            name: channelData.channel['name'] ?? 'Channel',
            workspaceId: channelData.workspaceId,
            type: 'channel',
            createdAt: DateTime.now(),
            updatedAt: DateTime.now(),
          );
          workspaceForTask = workspace;
        } else if (effectiveChannel != null) {
          threadForTask = Thread(
            id: effectiveChannel['id'].toString(),
            name: effectiveChannel['name'] ?? 'Channel',
            workspaceId: effectiveWorkspace!.id,
            type: 'channel',
            createdAt: DateTime.now(),
            updatedAt: DateTime.now(),
          );
          workspaceForTask = effectiveWorkspace;
        } else {
          threadForTask = effectiveThread!;
          workspaceForTask = widget.workspace!;
        }

        showDialog(
          context: context,
          builder: (context) => QuickTaskDialog(
            thread: threadForTask,
            workspace: workspaceForTask,
            onTaskCreated: () {
              _loadTasks();
            },
          ),
        );
      },
      child: const Icon(Icons.add),
      tooltip: 'Create task',
    );
  }
}
