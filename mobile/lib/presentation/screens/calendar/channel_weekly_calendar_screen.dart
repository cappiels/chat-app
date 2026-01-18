import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../data/models/task.dart';
import '../../../data/models/thread.dart';
import '../../../data/models/workspace.dart';
import '../../../data/services/task_service.dart';
import '../../../data/services/workspace_service.dart';
import '../../widgets/tasks/weekly_event_dialog.dart';
import '../../widgets/calendar/workspace_channel_picker.dart';

class ChannelWeeklyCalendarScreen extends StatefulWidget {
  final Thread? thread;
  final Workspace? workspace;

  const ChannelWeeklyCalendarScreen({
    Key? key,
    this.thread,
    this.workspace,
  }) : super(key: key);

  @override
  State<ChannelWeeklyCalendarScreen> createState() => _ChannelWeeklyCalendarScreenState();
}

class _ChannelWeeklyCalendarScreenState extends State<ChannelWeeklyCalendarScreen> {
  final TaskService _taskService = TaskService();
  final WorkspaceService _workspaceService = WorkspaceService();
  final ScrollController _scrollController = ScrollController();
  
  List<ChannelTask> _tasks = [];
  List<Map<String, dynamic>> _taskData = [];
  bool _isLoading = false;
  String? _error;
  DateTime _currentWeekStart = DateTime.now();
  CalendarView _currentView = CalendarView.week;
  WorkspaceChannelSelection? _selection;
  
  // Time range for calendar (6 AM to 10 PM)
  static const int _startHour = 6;
  static const int _endHour = 22;
  static const double _hourHeight = 60.0;
  static const double _headerHeight = 80.0;
  
  // Task color mappings
  static const Map<String, Color> _priorityColors = {
    'low': Color(0xFF10B981),
    'medium': Color(0xFF3B82F6),
    'high': Color(0xFFF59E0B),
    'urgent': Color(0xFFEF4444),
  };

  @override
  void initState() {
    super.initState();
    _currentWeekStart = _getWeekStart(DateTime.now());
    // Start in "all workspaces" mode if no specific thread/workspace provided
    if (widget.thread == null || widget.workspace == null) {
      _selection = WorkspaceChannelSelection(showAllWorkspaces: true);
    }
    _loadTasks();

    // Auto-scroll to current time
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _scrollToCurrentTime();
    });
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  DateTime _getWeekStart(DateTime date) {
    // Get Sunday of current week
    return date.subtract(Duration(days: date.weekday % 7));
  }

  void _scrollToCurrentTime() {
    final now = DateTime.now();
    if (now.hour >= _startHour && now.hour < _endHour) {
      final offset = (now.hour - _startHour) * _hourHeight;
      _scrollController.animateTo(
        offset,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
      );
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
          _tasks = taskData
              .map((data) => ChannelTask.fromJson(data))
              .where((task) => task.startDate != null)
              .toList();
          _isLoading = false;
        });
      } else if (_selection?.workspace != null && _selection?.channel == null) {
        // Fetch all channels in workspace
        final taskData = await _workspaceService.getWorkspacesTasks(
          workspaceIds: _selection!.workspaceIds,
        );
        setState(() {
          _taskData = taskData;
          _tasks = taskData
              .map((data) => ChannelTask.fromJson(data))
              .where((task) => task.startDate != null)
              .toList();
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
          _tasks = tasks.where((task) => task.startDate != null).toList();
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
          _tasks = tasks.where((task) => task.startDate != null).toList();
          _isLoading = false;
        });
      } else {
        // No workspace/thread provided, fetch all workspaces
        final taskData = await _workspaceService.getAllWorkspacesTasks();
        setState(() {
          _taskData = taskData;
          _tasks = taskData
              .map((data) => ChannelTask.fromJson(data))
              .where((task) => task.startDate != null)
              .toList();
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

  List<ChannelTask> _getTasksForDate(DateTime date) {
    final dayStr = DateFormat('yyyy-MM-dd').format(date);
    
    return _tasks.where((task) {
      if (task.isAllDay) {
        final startStr = DateFormat('yyyy-MM-dd').format(task.startDate!);
        final endStr = task.endDate != null 
            ? DateFormat('yyyy-MM-dd').format(task.endDate!)
            : startStr;
        return dayStr.compareTo(startStr) >= 0 && dayStr.compareTo(endStr) <= 0;
      } else {
        final taskDateStr = DateFormat('yyyy-MM-dd').format(task.startDate!);
        return taskDateStr == dayStr;
      }
    }).toList();
  }

  void _navigateWeek(int weeks) {
    setState(() {
      _currentWeekStart = _currentWeekStart.add(Duration(days: weeks * 7));
    });
    _loadTasks();
  }

  void _goToToday() {
    setState(() {
      _currentWeekStart = _getWeekStart(DateTime.now());
    });
    _loadTasks();
    _scrollToCurrentTime();
  }

  void _showEventDialog(ChannelTask? task, {DateTime? startTime, DateTime? endTime}) {
    if (widget.thread == null || widget.workspace == null) {
      // Can't create tasks without a specific thread/workspace
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Select a specific channel to create tasks')),
      );
      return;
    }
    showDialog(
      context: context,
      builder: (context) => WeeklyEventDialog(
        task: task,
        thread: widget.thread!,
        workspace: widget.workspace!,
        initialStartTime: startTime,
        initialEndTime: endTime,
        onTaskCreated: _loadTasks,
        onTaskUpdated: _loadTasks,
        onTaskDeleted: _loadTasks,
      ),
    );
  }

  Widget _buildHeader() {
    final weekDays = List.generate(7, (i) => _currentWeekStart.add(Duration(days: i)));
    final formatter = DateFormat('EEE d');
    
    return Container(
      height: _headerHeight,
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border(
          bottom: BorderSide(color: Colors.grey[300]!, width: 1),
        ),
      ),
      child: Column(
        children: [
          // Navigation bar
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              children: [
                IconButton(
                  icon: const Icon(Icons.chevron_left),
                  onPressed: () => _navigateWeek(-1),
                ),
                Expanded(
                  child: Center(
                    child: Text(
                      DateFormat('MMMM yyyy').format(_currentWeekStart),
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.chevron_right),
                  onPressed: () => _navigateWeek(1),
                ),
                IconButton(
                  icon: const Icon(Icons.today),
                  onPressed: _goToToday,
                  tooltip: 'Today',
                ),
              ],
            ),
          ),
          // Day headers
          Expanded(
            child: Row(
              children: [
                // Time column header
                SizedBox(
                  width: 60,
                  child: Container(),
                ),
                // Day columns
                ...weekDays.map((day) {
                  final isToday = DateFormat('yyyy-MM-dd').format(day) == 
                                  DateFormat('yyyy-MM-dd').format(DateTime.now());
                  return Expanded(
                    child: Container(
                      decoration: BoxDecoration(
                        border: Border(
                          left: BorderSide(color: Colors.grey[300]!, width: 1),
                        ),
                      ),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            DateFormat('EEE').format(day),
                            style: TextStyle(
                              fontSize: 12,
                              color: isToday ? Colors.blue : Colors.grey[600],
                              fontWeight: isToday ? FontWeight.bold : FontWeight.normal,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Container(
                            width: 32,
                            height: 32,
                            decoration: BoxDecoration(
                              color: isToday ? Colors.blue : Colors.transparent,
                              shape: BoxShape.circle,
                            ),
                            child: Center(
                              child: Text(
                                day.day.toString(),
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w600,
                                  color: isToday ? Colors.white : Colors.black87,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                }).toList(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildWeekView() {
    final weekDays = List.generate(7, (i) => _currentWeekStart.add(Duration(days: i)));
    final hours = List.generate(_endHour - _startHour, (i) => _startHour + i);
    
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Time column
        SizedBox(
          width: 60,
          child: Column(
            children: hours.map((hour) {
              return SizedBox(
                height: _hourHeight,
                child: Align(
                  alignment: Alignment.topRight,
                  child: Padding(
                    padding: const EdgeInsets.only(right: 8, top: 4),
                    child: Text(
                      DateFormat('ha').format(DateTime(2024, 1, 1, hour)),
                      style: TextStyle(
                        fontSize: 11,
                        color: Colors.grey[600],
                      ),
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
        ),
        // Day columns
        ...weekDays.map((day) {
          return Expanded(
            child: _buildDayColumn(day, hours),
          );
        }).toList(),
      ],
    );
  }

  Widget _buildDayColumn(DateTime day, List<int> hours) {
    final dayTasks = _getTasksForDate(day);
    final isToday = DateFormat('yyyy-MM-dd').format(day) == 
                    DateFormat('yyyy-MM-dd').format(DateTime.now());
    
    return GestureDetector(
      onTapDown: (details) {
        final localY = details.localPosition.dy;
        final hour = (localY / _hourHeight).floor() + _startHour;
        final minute = ((localY % _hourHeight) / _hourHeight * 60).floor();
        
        final startTime = DateTime(day.year, day.month, day.day, hour, minute);
        final endTime = startTime.add(const Duration(hours: 1));
        
        _showEventDialog(null, startTime: startTime, endTime: endTime);
      },
      child: Container(
        decoration: BoxDecoration(
          color: isToday ? Colors.blue.withOpacity(0.02) : Colors.transparent,
          border: Border(
            left: BorderSide(color: Colors.grey[300]!, width: 1),
          ),
        ),
        child: Stack(
          children: [
            // Hour lines
            ...hours.map((hour) {
              return Positioned(
                top: (hour - _startHour) * _hourHeight,
                left: 0,
                right: 0,
                child: Container(
                  height: 1,
                  color: Colors.grey[200],
                ),
              );
            }).toList(),
            // Current time indicator
            if (isToday) _buildCurrentTimeIndicator(),
            // Tasks
            ...dayTasks.map((task) => _buildTaskCard(task, day)).toList(),
          ],
        ),
      ),
    );
  }

  Widget _buildCurrentTimeIndicator() {
    final now = DateTime.now();
    if (now.hour < _startHour || now.hour >= _endHour) {
      return const SizedBox.shrink();
    }
    
    final minutes = now.hour * 60 + now.minute;
    final startMinutes = _startHour * 60;
    final offset = ((minutes - startMinutes) / 60) * _hourHeight;
    
    return Positioned(
      top: offset,
      left: 0,
      right: 0,
      child: Row(
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: const BoxDecoration(
              color: Colors.red,
              shape: BoxShape.circle,
            ),
          ),
          Expanded(
            child: Container(
              height: 2,
              color: Colors.red,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTaskCard(ChannelTask task, DateTime day) {
    // Calculate position and height
    double top = 0;
    double height = _hourHeight;
    
    if (!task.isAllDay && task.startDate != null) {
      final startTime = task.startDate!;
      final endTime = task.endDate ?? startTime.add(const Duration(hours: 1));
      
      // Calculate top position
      final startMinutes = startTime.hour * 60 + startTime.minute;
      final startDayMinutes = _startHour * 60;
      top = ((startMinutes - startDayMinutes) / 60) * _hourHeight;
      
      // Calculate height
      final duration = endTime.difference(startTime).inMinutes;
      height = (duration / 60) * _hourHeight;
    }
    
    final priority = task.priority;
    final color = _priorityColors[priority] ?? Colors.blue;
    
    return Positioned(
      top: top,
      left: 4,
      right: 4,
      height: height,
      child: GestureDetector(
        onTap: () => _showEventDialog(task),
        child: Container(
          margin: const EdgeInsets.only(bottom: 2),
          padding: const EdgeInsets.all(4),
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(4),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  if (!task.isAllDay)
                    Text(
                      DateFormat('h:mma').format(task.startDate!),
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  const Spacer(),
                  if (task.requiresIndividualResponse && task.progressInfo != null)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.black26,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        task.completionText,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 9,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 2),
              Expanded(
                child: Text(
                  task.title,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                  maxLines: height > 40 ? 2 : 1,
                  overflow: TextOverflow.ellipsis,
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
    String titleText = _selection?.showAllWorkspaces == true
        ? 'All Workspaces Weekly'
        : _selection?.workspace != null
            ? '${_selection!.workspace!.name} Weekly'
            : widget.thread != null
                ? '# ${widget.thread!.name} Weekly'
                : 'Weekly Calendar';

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
              : Column(
                  children: [
                    _buildHeader(),
                    Expanded(
                      child: SingleChildScrollView(
                        controller: _scrollController,
                        child: _buildWeekView(),
                      ),
                    ),
                  ],
                ),
      floatingActionButton: widget.thread != null && widget.workspace != null
          ? FloatingActionButton(
              onPressed: () => _showEventDialog(null),
              child: const Icon(Icons.add),
              tooltip: 'Create event',
            )
          : null,
    );
  }
}

enum CalendarView {
  day,
  week,
  month,
}
