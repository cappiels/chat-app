import 'package:flutter/material.dart';
import 'package:table_calendar/table_calendar.dart';
import 'package:intl/intl.dart';
import '../../../data/models/task.dart';
import '../../../data/models/thread.dart';
import '../../../data/models/workspace.dart';
import '../../../data/services/task_service.dart';
import '../../../data/services/workspace_service.dart';
import '../../widgets/tasks/quick_task_dialog.dart';
import '../../widgets/tasks/task_details_sheet.dart';
import '../../widgets/calendar/workspace_channel_picker.dart';

class ChannelCalendarScreen extends StatefulWidget {
  final Thread? thread;
  final Workspace? workspace;

  const ChannelCalendarScreen({
    Key? key,
    this.thread,
    this.workspace,
  }) : super(key: key);

  @override
  State<ChannelCalendarScreen> createState() => _ChannelCalendarScreenState();
}

class _ChannelCalendarScreenState extends State<ChannelCalendarScreen> {
  final TaskService _taskService = TaskService();
  final WorkspaceService _workspaceService = WorkspaceService();
  
  DateTime _focusedDay = DateTime.now();
  DateTime _selectedDay = DateTime.now();
  List<ChannelTask> _tasks = [];
  List<Map<String, dynamic>> _taskData = [];
  bool _isLoading = false;
  String? _error;
  WorkspaceChannelSelection? _selection;
  
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
    // Start in "all workspaces" mode if no specific thread/workspace provided
    if (widget.thread == null || widget.workspace == null) {
      _selection = WorkspaceChannelSelection(showAllWorkspaces: true);
    }
    _loadTasks();
  }

  Future<void> _loadTasks() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      if (_selection?.showAllWorkspaces == true) {
        // Fetch ALL workspaces
        final taskData = await _workspaceService.getAllWorkspacesTasks();
        setState(() {
          _taskData = taskData;
          _tasks = taskData.map((data) => ChannelTask.fromJson(data)).toList();
          _isLoading = false;
        });
      } else if (_selection?.workspace != null && _selection?.channel == null) {
        // Fetch all channels in workspace
        final taskData = await _workspaceService.getWorkspacesTasks(
          workspaceIds: _selection!.workspaceIds,
        );
        setState(() {
          _taskData = taskData;
          _tasks = taskData.map((data) => ChannelTask.fromJson(data)).toList();
          _isLoading = false;
        });
      } else if (_selection?.channel != null) {
        // Fetch specific channel
        final tasks = await _taskService.getChannelTasks(
          workspaceId: _selection!.workspace!.id,
          threadId: _selection!.channel!['id'].toString(),
          limit: 200,
        );
        setState(() {
          _taskData = [];
          _tasks = tasks;
          _isLoading = false;
        });
      } else if (widget.workspace != null && widget.thread != null) {
        // Fallback to current channel (only if both are provided)
        final tasks = await _taskService.getChannelTasks(
          workspaceId: widget.workspace!.id,
          threadId: widget.thread!.id,
          limit: 200,
        );
        setState(() {
          _taskData = [];
          _tasks = tasks;
          _isLoading = false;
        });
      } else {
        // No workspace/thread provided, fetch all workspaces
        final taskData = await _workspaceService.getAllWorkspacesTasks();
        setState(() {
          _taskData = taskData;
          _tasks = taskData.map((data) => ChannelTask.fromJson(data)).toList();
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
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
              'Filter Calendar',
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

  List<ChannelTask> _getTasksForDay(DateTime day) {
    final dayStr = DateFormat('yyyy-MM-dd').format(day);
    
    return _tasks.where((task) {
      if (task.isAllDay) {
        // For all-day tasks, check if day falls between start and end
        if (task.startDate != null) {
          final startStr = DateFormat('yyyy-MM-dd').format(task.startDate!);
          final endStr = task.endDate != null 
              ? DateFormat('yyyy-MM-dd').format(task.endDate!)
              : startStr;
          return dayStr.compareTo(startStr) >= 0 && dayStr.compareTo(endStr) <= 0;
        }
      } else {
        // For timed tasks, check start date
        if (task.startDate != null) {
          final taskDateStr = DateFormat('yyyy-MM-dd').format(task.startDate!);
          return taskDateStr == dayStr;
        }
      }
      
      // Check due date as fallback
      if (task.dueDate != null) {
        final dueDateStr = DateFormat('yyyy-MM-dd').format(task.dueDate!);
        return dueDateStr == dayStr;
      }
      
      return false;
    }).toList();
  }

  void _showTaskDetails(ChannelTask task) {
    // Determine workspace ID and role
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

  Widget _buildTaskCard(ChannelTask task) {
    // Find workspace name from taskData if showing all workspaces
    String? workspaceName;
    if (_selection?.showAllWorkspaces == true && _taskData.isNotEmpty) {
      final taskDataItem = _taskData.firstWhere(
        (data) => data['id'].toString() == task.id,
        orElse: () => {},
      );
      workspaceName = taskDataItem['workspace_name'];
    }

    return InkWell(
      onTap: () => _showTaskDetails(task),
      child: Container(
        margin: const EdgeInsets.only(top: 2, bottom: 2),
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
        decoration: BoxDecoration(
          color: _statusColors[task.status],
          borderRadius: BorderRadius.circular(4),
          border: Border(
            left: BorderSide(
              color: _priorityColors[task.priority] ?? Colors.grey,
              width: 3,
            ),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                if (task.isAllDay)
                  Icon(
                    Icons.calendar_today,
                    size: 10,
                    color: _statusTextColors[task.status],
                  )
                else
                  Icon(
                    Icons.access_time,
                    size: 10,
                    color: _statusTextColors[task.status],
                  ),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    task.title,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: _statusTextColors[task.status],
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            if (workspaceName != null) ...[
              const SizedBox(height: 4),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: Colors.purple.shade100,
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.business, size: 10, color: Colors.purple.shade700),
                    const SizedBox(width: 4),
                    Text(
                      workspaceName,
                      style: TextStyle(
                        fontSize: 10,
                        color: Colors.purple.shade700,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    String titleText = _selection?.showAllWorkspaces == true
        ? 'All Workspaces Calendar'
        : _selection?.workspace != null
            ? '${_selection!.workspace!.name} Calendar'
            : widget.thread != null
                ? '# ${widget.thread!.name} Calendar'
                : 'Calendar';

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
            icon: const Icon(Icons.today),
            onPressed: () {
              setState(() {
                _focusedDay = DateTime.now();
                _selectedDay = DateTime.now();
              });
            },
            tooltip: 'Today',
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
                          'Failed to load calendar',
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
              : RefreshIndicator(
                  onRefresh: _loadTasks,
                  child: SingleChildScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    child: Column(
                      children: [
                        // Stats bar
                        Container(
                          padding: const EdgeInsets.all(16),
                          color: Colors.grey[100],
                          child: Row(
                            children: [
                              Icon(Icons.task_alt, size: 20, color: Colors.grey[700]),
                              const SizedBox(width: 8),
                              Text(
                                '${_tasks.length} task${_tasks.length != 1 ? 's' : ''}',
                                style: TextStyle(
                                  fontSize: 14,
                                  color: Colors.grey[700],
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ],
                          ),
                        ),
                        
                        // Calendar
                        TableCalendar(
                          firstDay: DateTime.utc(2020, 1, 1),
                          lastDay: DateTime.utc(2030, 12, 31),
                          focusedDay: _focusedDay,
                          selectedDayPredicate: (day) => isSameDay(_selectedDay, day),
                          calendarFormat: CalendarFormat.month,
                          startingDayOfWeek: StartingDayOfWeek.sunday,
                          calendarStyle: CalendarStyle(
                            todayDecoration: BoxDecoration(
                              color: Colors.blue[300],
                              shape: BoxShape.circle,
                            ),
                            selectedDecoration: const BoxDecoration(
                              color: Colors.blue,
                              shape: BoxShape.circle,
                            ),
                            markerDecoration: const BoxDecoration(
                              color: Colors.blue,
                              shape: BoxShape.circle,
                            ),
                          ),
                          headerStyle: const HeaderStyle(
                            formatButtonVisible: false,
                            titleCentered: true,
                            titleTextStyle: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          onDaySelected: (selectedDay, focusedDay) {
                            setState(() {
                              _selectedDay = selectedDay;
                              _focusedDay = focusedDay;
                            });
                          },
                          onPageChanged: (focusedDay) {
                            _focusedDay = focusedDay;
                          },
                          eventLoader: (day) => _getTasksForDay(day),
                          calendarBuilders: CalendarBuilders(
                            markerBuilder: (context, date, events) {
                              if (events.isEmpty) return null;
                              
                              return Positioned(
                                bottom: 1,
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: Colors.blue,
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Text(
                                    '${events.length}',
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 9,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ),
                              );
                            },
                          ),
                        ),
                        
                        // Tasks for selected day
                        if (_getTasksForDay(_selectedDay).isNotEmpty) ...[
                          const Divider(height: 1),
                          Container(
                            padding: const EdgeInsets.all(16),
                            color: Colors.grey[50],
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Icon(Icons.event, size: 20, color: Colors.grey[700]),
                                    const SizedBox(width: 8),
                                    Text(
                                      DateFormat('EEEE, MMMM d, y').format(_selectedDay),
                                      style: const TextStyle(
                                        fontSize: 16,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 12),
                                ..._getTasksForDay(_selectedDay).map((task) {
                                  return Padding(
                                    padding: const EdgeInsets.only(bottom: 8),
                                    child: _buildTaskCard(task),
                                  );
                                }).toList(),
                              ],
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
      floatingActionButton: widget.thread != null && widget.workspace != null
          ? FloatingActionButton(
              onPressed: () {
                showDialog(
                  context: context,
                  builder: (context) => QuickTaskDialog(
                    thread: widget.thread!,
                    workspace: widget.workspace!,
                    onTaskCreated: () {
                      // Refresh tasks after creation
                      _loadTasks();
                    },
                  ),
                );
              },
              child: const Icon(Icons.add),
              tooltip: 'Create task',
            )
          : null,
    );
  }
}
