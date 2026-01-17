import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'dart:math' as math;
import '../../../data/services/subscription_service.dart';
import '../../../data/services/workspace_service.dart';
import '../../../data/services/task_service.dart';
import '../../../data/services/http_client.dart';
import '../../../data/models/workspace.dart';
import '../../../data/models/task.dart';
import '../../../data/models/thread.dart';
import '../../widgets/tasks/quick_task_dialog.dart';

class WorkspaceSelectionScreen extends ConsumerStatefulWidget {
  final VoidCallback? onSignOut;
  final Function(Map<String, dynamic>)? onSelectWorkspace;
  
  const WorkspaceSelectionScreen({
    super.key,
    this.onSignOut,
    this.onSelectWorkspace,
  });

  @override
  ConsumerState<WorkspaceSelectionScreen> createState() => _WorkspaceSelectionScreenState();
}

class _WorkspaceSelectionScreenState extends ConsumerState<WorkspaceSelectionScreen>
    with TickerProviderStateMixin {

  // Task color mappings for detail sheet
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

  late AnimationController _fadeController;
  late AnimationController _slideController;
  late Animation<double> _fadeAnimation;
  late Animation<Offset> _slideAnimation;
  
  final HttpClient _httpClient = HttpClient();
  late final SubscriptionService _subscriptionService;
  late final WorkspaceService _workspaceService;
  late final TaskService _taskService;
  
  List<Workspace> _workspaces = [];
  List<ChannelTask> _myTasks = [];
  bool _loadingWorkspaces = true;
  bool _loadingTasks = true;
  String _searchQuery = '';
  String _newWorkspaceName = '';
  String _newWorkspaceDescription = '';
  bool _creating = false;
  int _selectedBottomNavIndex = 0; // 0 = Today (tasks), 1 = Calendar, 2 = Workspaces, 3 = Knowledge
  bool _canCreateWorkspace = true;
  String _subscriptionTier = 'free';
  String? _selectedAssigneeFilter; // null = all, 'me' = assigned to me, 'by_me' = created by me
  String? _taskLoadError;

  // Task fade-out animation state
  final Map<String, AnimationController> _taskFadeControllers = {};
  final Set<String> _tasksBeingRemoved = {};

  // Quick add: track last used channel and cache threads
  String? _lastUsedWorkspaceId;
  String? _lastUsedThreadId;
  final Map<String, List<Thread>> _threadCache = {};
  
  final TextEditingController _searchController = TextEditingController();
  final TextEditingController _nameController = TextEditingController();
  final TextEditingController _descriptionController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _subscriptionService = SubscriptionService(_httpClient);
    _workspaceService = WorkspaceService();
    _taskService = TaskService();
    
    _fadeController = AnimationController(
      duration: const Duration(milliseconds: 800),
      vsync: this,
    );
    _slideController = AnimationController(
      duration: const Duration(milliseconds: 1000),
      vsync: this,
    );
    
    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _fadeController, curve: Curves.easeOut),
    );
    _slideAnimation = Tween<Offset>(begin: const Offset(0, 0.2), end: Offset.zero).animate(
      CurvedAnimation(parent: _slideController, curve: Curves.easeOutCubic),
    );
    
    _loadData();
    _fadeController.forward();
    _slideController.forward();
  }

  @override
  void dispose() {
    _fadeController.dispose();
    _slideController.dispose();
    _searchController.dispose();
    _nameController.dispose();
    _descriptionController.dispose();
    // Dispose task fade-out animation controllers
    for (final controller in _taskFadeControllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _loadData() async {
    await Future.wait([
      _loadMyTasks(),
      _loadWorkspaces(),
    ]);
  }

  Future<void> _loadMyTasks() async {
    try {
      setState(() {
        _loadingTasks = true;
        _taskLoadError = null;
      });
      
      print('🔄 Loading my tasks from backend API...');
      final tasks = await _taskService.getMyTasks();
      setState(() {
        _myTasks = tasks;
        _loadingTasks = false;
        _taskLoadError = null;
      });
      print('✅ Loaded ${tasks.length} tasks from backend');
    } catch (e) {
      print('❌ Error loading tasks: $e');
      setState(() {
        _myTasks = [];
        _loadingTasks = false;
        _taskLoadError = e.toString();
      });
    }
  }

  // Group tasks by date
  Map<String, List<ChannelTask>> _groupTasksByDate(List<ChannelTask> tasks) {
    final Map<String, List<ChannelTask>> grouped = {};
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    
    for (final task in tasks) {
      DateTime? taskDate = task.dueDate ?? task.startDate;
      if (taskDate == null) {
        // Tasks without dates go to "No Date" section
        grouped.putIfAbsent('No Date', () => []).add(task);
        continue;
      }
      
      final dateOnly = DateTime(taskDate.year, taskDate.month, taskDate.day);
      String key;
      
      if (dateOnly.isBefore(today)) {
        key = 'Overdue';
      } else if (dateOnly.isAtSameMomentAs(today)) {
        key = 'Today';
      } else if (dateOnly.isAtSameMomentAs(today.add(const Duration(days: 1)))) {
        key = 'Tomorrow';
      } else {
        key = DateFormat('EEEE, MMM d').format(dateOnly);
      }
      
      grouped.putIfAbsent(key, () => []).add(task);
    }
    
    return grouped;
  }

  // Get sorted date keys (Overdue first, then Today, Tomorrow, future dates, No Date last)
  List<String> _getSortedDateKeys(Map<String, List<ChannelTask>> groupedTasks) {
    final keys = groupedTasks.keys.toList();
    final order = ['Overdue', 'Today', 'Tomorrow'];
    
    keys.sort((a, b) {
      final aIndex = order.indexOf(a);
      final bIndex = order.indexOf(b);
      
      if (a == 'No Date') return 1;
      if (b == 'No Date') return -1;
      if (aIndex >= 0 && bIndex >= 0) return aIndex.compareTo(bIndex);
      if (aIndex >= 0) return -1;
      if (bIndex >= 0) return 1;
      return a.compareTo(b);
    });
    
    return keys;
  }

  // Filter tasks based on assignee filter
  List<ChannelTask> get _filteredTasks {
    if (_selectedAssigneeFilter == null) return _myTasks;
    // Note: The API already filters by my_tasks=true which includes both assigned to me AND created by me
    // For more granular filtering, we'd need additional API parameters
    return _myTasks;
  }

  // Optimistic UI update for task completion - no screen blink!
  Future<void> _toggleTaskCompletion(ChannelTask task) async {
    // Track last used channel for quick add
    _lastUsedWorkspaceId = task.workspaceId;
    _lastUsedThreadId = task.threadId;

    final taskIndex = _myTasks.indexWhere((t) => t.id == task.id);
    if (taskIndex == -1) return;

    final wasCompleted = task.userCompleted || task.isComplete;
    final originalTask = _myTasks[taskIndex];
    
    // Step 1: Optimistically update UI immediately (no loading state!)
    setState(() {
      _myTasks[taskIndex] = ChannelTask(
        id: task.id,
        threadId: task.threadId,
        workspaceId: task.workspaceId,
        title: task.title,
        description: task.description,
        startDate: task.startDate,
        endDate: task.endDate,
        dueDate: task.dueDate,
        assignedTo: task.assignedTo,
        assignees: task.assignees,
        assignedTeams: task.assignedTeams,
        assignmentMode: task.assignmentMode,
        requiresIndividualResponse: task.requiresIndividualResponse,
        status: wasCompleted ? 'pending' : 'completed',
        priority: task.priority,
        tags: task.tags,
        estimatedHours: task.estimatedHours,
        actualHours: task.actualHours,
        isAllDay: task.isAllDay,
        startTime: task.startTime,
        endTime: task.endTime,
        parentTaskId: task.parentTaskId,
        dependencies: task.dependencies,
        googleCalendarEventId: task.googleCalendarEventId,
        googleTaskId: task.googleTaskId,
        completedAt: wasCompleted ? null : DateTime.now(),
        createdBy: task.createdBy,
        createdAt: task.createdAt,
        updatedAt: DateTime.now(),
        createdByName: task.createdByName,
        channelName: task.channelName,
        progressInfo: task.progressInfo,
        isComplete: !wasCompleted,
        totalAssignees: task.totalAssignees,
        individualAssigneeCount: task.individualAssigneeCount,
        teamCount: task.teamCount,
        assigneeDetails: task.assigneeDetails,
        teamDetails: task.teamDetails,
        userCanEdit: task.userCanEdit,
        userIsAssignee: task.userIsAssignee,
        userCompleted: !wasCompleted,
        individualCompletions: task.individualCompletions,
      );
    });
    
    // Step 2: Call API in background
    try {
      if (wasCompleted) {
        await _taskService.markTaskIncomplete(
          workspaceId: task.workspaceId,
          threadId: task.threadId,
          taskId: task.id,
        );
      } else {
        await _taskService.markTaskComplete(
          workspaceId: task.workspaceId,
          threadId: task.threadId,
          taskId: task.id,
        );
      }
      // Success! Start fade-out animation for completed tasks
      if (!wasCompleted) {
        _scheduleFadeOut(task.id);
      }
    } catch (e) {
      // Step 3: Revert on failure
      setState(() {
        _myTasks[taskIndex] = originalTask;
      });
      _showErrorSnackBar('Failed to update task: $e');
    }
  }

  // Schedule a task to fade out and be removed after 1 second
  void _scheduleFadeOut(String taskId) {
    Future.delayed(const Duration(seconds: 1), () {
      if (!mounted) return;

      final controller = AnimationController(
        duration: const Duration(milliseconds: 500),
        vsync: this,
      );

      setState(() {
        _taskFadeControllers[taskId] = controller;
        _tasksBeingRemoved.add(taskId);
      });

      controller.forward().then((_) {
        if (!mounted) return;
        setState(() {
          _myTasks.removeWhere((t) => t.id == taskId);
          _taskFadeControllers.remove(taskId)?.dispose();
          _tasksBeingRemoved.remove(taskId);
        });
      });
    });
  }

  Future<void> _loadWorkspaces() async {
    try {
      setState(() => _loadingWorkspaces = true);
      
      print('🔄 Attempting to load workspaces from backend API...');
      final workspaces = await _workspaceService.getWorkspaces();
      
      try {
        final subStatus = await _subscriptionService.getSubscriptionStatus();
        _subscriptionTier = subStatus?.planName ?? 'free';
        final workspaceCount = workspaces.length;
        _canCreateWorkspace = !(_subscriptionTier == 'free' && workspaceCount >= 1);
        print('🔐 Subscription: $_subscriptionTier, Can create: $_canCreateWorkspace');
      } catch (e) {
        print('⚠️ Could not fetch subscription status: $e');
        _canCreateWorkspace = true;
      }
      
      setState(() {
        _workspaces = workspaces;
        _loadingWorkspaces = false;
      });
      print('✅ Loaded ${workspaces.length} workspaces from backend');
    } catch (e) {
      print('❌ Error loading workspaces: $e');
      setState(() {
        _workspaces = [];
        _loadingWorkspaces = false;
      });
      _showErrorSnackBar('Failed to load workspaces: $e');
    }
  }

  void _showErrorSnackBar(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Colors.red.shade600,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }

  void _showSuccessSnackBar(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Colors.green.shade600,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }

  List<Workspace> get _filteredWorkspaces {
    if (_searchQuery.isEmpty) return _workspaces;
    return _workspaces.where((workspace) {
      final name = workspace.name.toLowerCase();
      final description = workspace.description?.toLowerCase() ?? '';
      final query = _searchQuery.toLowerCase();
      return name.contains(query) || description.contains(query);
    }).toList();
  }

  void _showCalendarViewSelector() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                margin: const EdgeInsets.only(top: 12),
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const Padding(
                padding: EdgeInsets.all(16),
                child: Text(
                  'Select Calendar View',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
              ),
              ListTile(
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.purple.shade50,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(Icons.calendar_month, color: Colors.purple.shade600),
                ),
                title: const Text('Monthly Calendar'),
                subtitle: const Text('View tasks across months'),
                onTap: () {
                  Navigator.pop(context);
                  _navigateToCalendarView('monthly');
                },
              ),
              ListTile(
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.teal.shade50,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(Icons.view_week, color: Colors.teal.shade600),
                ),
                title: const Text('Weekly Calendar'),
                subtitle: const Text('Week view with time blocking'),
                onTap: () {
                  Navigator.pop(context);
                  _navigateToCalendarView('weekly');
                },
              ),
              ListTile(
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.orange.shade50,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(Icons.timeline, color: Colors.orange.shade600),
                ),
                title: const Text('Timeline'),
                subtitle: const Text('Gantt chart with dependencies'),
                onTap: () {
                  Navigator.pop(context);
                  _navigateToCalendarView('timeline');
                },
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }

  void _navigateToCalendarView(String viewType) {
    // TODO: Navigate to actual calendar screens
    _showSuccessSnackBar('Opening $viewType view...');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Colors.grey.shade50, Colors.white, Colors.grey.shade50],
            stops: const [0.0, 0.5, 1.0],
          ),
        ),
        child: SafeArea(child: _buildBodyContent()),
      ),
      bottomNavigationBar: _buildBottomNavigation(),
      floatingActionButton: _selectedBottomNavIndex == 0 
          ? FloatingActionButton(
              onPressed: _showQuickAddTask,
              backgroundColor: Colors.red.shade500,
              child: const Icon(Icons.add, color: Colors.white, size: 28),
            )
          : null,
    );
  }

  Widget _buildBodyContent() {
    switch (_selectedBottomNavIndex) {
      case 0: return _buildTodayView();
      case 1: return _buildKnowledgePlaceholder(); // Calendar handled by popup
      case 2: return _buildWorkspacesView();
      case 3: return _buildKnowledgePlaceholder();
      default: return _buildTodayView();
    }
  }

  // ==================== TODAY VIEW (All Tasks Grouped by Date) ====================
  Widget _buildTodayView() {
    final now = DateTime.now();
    final dateFormatter = DateFormat('MMM d');
    final dayFormatter = DateFormat('EEEE');
    
    final groupedTasks = _groupTasksByDate(_filteredTasks);
    final sortedKeys = _getSortedDateKeys(groupedTasks);
    
    return RefreshIndicator(
      onRefresh: _loadMyTasks,
      child: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: FadeTransition(
              opacity: _fadeAnimation,
              child: SlideTransition(
                position: _slideAnimation,
                child: Container(
                  padding: const EdgeInsets.fromLTRB(24, 16, 24, 8),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          IconButton(
                            icon: const Icon(Icons.more_horiz, color: Colors.red),
                            onPressed: () {},
                          ),
                          GestureDetector(
                            onTap: widget.onSignOut,
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(color: Colors.grey.shade200),
                              ),
                              child: Text(
                                'Sign Out',
                                style: TextStyle(fontSize: 12, color: Colors.grey.shade600, fontWeight: FontWeight.w500),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      const Text('Today', style: TextStyle(fontSize: 32, fontWeight: FontWeight.bold, color: Colors.black87)),
                      const SizedBox(height: 4),
                      Text(
                        '${dateFormatter.format(now)} · ${dayFormatter.format(now)}',
                        style: TextStyle(fontSize: 14, color: Colors.grey.shade600, fontWeight: FontWeight.w500),
                      ),
                      const SizedBox(height: 12),
                      // Filter chips
                      _buildFilterChips(),
                      const SizedBox(height: 8),
                      Divider(color: Colors.grey.shade200, thickness: 1),
                    ],
                  ),
                ),
              ),
            ),
          ),
          
          if (_loadingTasks)
            const SliverFillRemaining(child: Center(child: CircularProgressIndicator()))
          else if (_taskLoadError != null)
            SliverFillRemaining(child: _buildErrorState())
          else if (_myTasks.isEmpty)
            SliverFillRemaining(child: _buildEmptyTasksState())
          else
            ..._buildGroupedTaskList(groupedTasks, sortedKeys),
        ],
      ),
    );
  }

  Widget _buildFilterChips() {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          _buildFilterChip('All Tasks', null),
          const SizedBox(width: 8),
          _buildFilterChip('Assigned to Me', 'me'),
          const SizedBox(width: 8),
          _buildFilterChip('Created by Me', 'by_me'),
        ],
      ),
    );
  }

  Widget _buildFilterChip(String label, String? value) {
    final isSelected = _selectedAssigneeFilter == value;
    return GestureDetector(
      onTap: () => setState(() => _selectedAssigneeFilter = value),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? Colors.blue.shade600 : Colors.grey.shade100,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected ? Colors.blue.shade600 : Colors.grey.shade300,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w500,
            color: isSelected ? Colors.white : Colors.grey.shade700,
          ),
        ),
      ),
    );
  }

  List<Widget> _buildGroupedTaskList(Map<String, List<ChannelTask>> groupedTasks, List<String> sortedKeys) {
    final widgets = <Widget>[];
    
    for (final dateKey in sortedKeys) {
      final tasks = groupedTasks[dateKey]!;
      
      // Date header
      widgets.add(
        SliverToBoxAdapter(
          child: Container(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Row(
              children: [
                Text(
                  dateKey,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: dateKey == 'Overdue' ? Colors.red.shade600 : Colors.grey.shade700,
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  '(${tasks.length})',
                  style: TextStyle(
                    fontSize: 14,
                    color: Colors.grey.shade500,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(child: Divider(color: Colors.grey.shade200)),
              ],
            ),
          ),
        ),
      );
      
      // Tasks for this date
      widgets.add(
        SliverList(
          delegate: SliverChildBuilderDelegate(
            (context, index) => _buildTaskItem(tasks[index]),
            childCount: tasks.length,
          ),
        ),
      );
    }
    
    return widgets;
  }

  Widget _buildErrorState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline, size: 80, color: Colors.red.shade300),
            const SizedBox(height: 24),
            Text('Failed to Load Tasks', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.grey.shade700)),
            const SizedBox(height: 12),
            Text(
              _taskLoadError ?? 'Unknown error occurred',
              style: TextStyle(fontSize: 14, color: Colors.grey.shade500),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: _loadMyTasks,
              icon: const Icon(Icons.refresh),
              label: const Text('Retry'),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.blue.shade600,
                foregroundColor: Colors.white,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyTasksState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.check_circle_outline, size: 80, color: Colors.grey.shade300),
            const SizedBox(height: 24),
            Text('No Tasks Found', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.grey.shade700)),
            const SizedBox(height: 12),
            Text('Tasks assigned to you or created by you will appear here.', style: TextStyle(fontSize: 16, color: Colors.grey.shade500), textAlign: TextAlign.center),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: _loadMyTasks,
              icon: const Icon(Icons.refresh),
              label: const Text('Refresh'),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.blue.shade600,
                foregroundColor: Colors.white,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTaskItem(ChannelTask task) {
    Color priorityColor;
    switch (task.priority) {
      case 'high': priorityColor = Colors.red.shade400; break;
      case 'medium': priorityColor = Colors.orange.shade400; break;
      default: priorityColor = Colors.blue.shade400;
    }

    // Check if this task is fading out
    final fadeController = _taskFadeControllers[task.id];
    final isFading = _tasksBeingRemoved.contains(task.id);

    Widget taskWidget = Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade100),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: () => _showTaskDetails(task),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                GestureDetector(
                  onTap: () => _toggleTaskCompletion(task),
                  child: Container(
                    width: 24,
                    height: 24,
                    margin: const EdgeInsets.only(top: 2),
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: task.userCompleted || task.isComplete ? Colors.green : priorityColor,
                        width: 2,
                      ),
                      color: task.userCompleted || task.isComplete ? Colors.green : Colors.transparent,
                    ),
                    child: task.userCompleted || task.isComplete
                        ? const Icon(Icons.check, size: 16, color: Colors.white)
                        : null,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        task.title,
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w500,
                          color: task.userCompleted || task.isComplete ? Colors.grey.shade400 : Colors.black87,
                          decoration: task.userCompleted || task.isComplete ? TextDecoration.lineThrough : null,
                        ),
                      ),
                      if (task.description != null && task.description!.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(task.description!, style: TextStyle(fontSize: 14, color: Colors.grey.shade500), maxLines: 1, overflow: TextOverflow.ellipsis),
                      ],
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 12,
                        runSpacing: 4,
                        children: [
                          if (task.startTime != null)
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.access_time, size: 14, color: Colors.green.shade600),
                                const SizedBox(width: 4),
                                Text(
                                  '${task.startTime}${task.endTime != null ? '-${task.endTime}' : ''}',
                                  style: TextStyle(fontSize: 12, color: Colors.green.shade600, fontWeight: FontWeight.w500),
                                ),
                              ],
                            ),
                          if (task.requiresIndividualResponse && task.progressInfo != null)
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.group, size: 14, color: Colors.grey.shade500),
                                const SizedBox(width: 4),
                                Text(task.completionText, style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
                              ],
                            ),
                          if (task.tags.isNotEmpty)
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.label_outline, size: 14, color: Colors.grey.shade500),
                                const SizedBox(width: 4),
                                Text(task.tags.length.toString(), style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
                              ],
                            ),
                          if (task.channelName != null)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(
                                color: Colors.grey.shade100,
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(task.channelName!, style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );

    // Wrap with fade animation if task is being removed
    if (isFading && fadeController != null) {
      return AnimatedBuilder(
        animation: fadeController,
        builder: (context, child) => Opacity(
          opacity: 1.0 - fadeController.value,
          child: child,
        ),
        child: taskWidget,
      );
    }

    return taskWidget;
  }

  // ==================== TASK DETAIL SHEET ====================
  void _showTaskDetails(ChannelTask task) {
    // Track last used channel for quick add
    _lastUsedWorkspaceId = task.workspaceId;
    _lastUsedThreadId = task.threadId;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.6,
        minChildSize: 0.4,
        maxChildSize: 0.9,
        expand: false,
        builder: (context, scrollController) => _buildTaskDetailsSheet(
          task,
          scrollController,
        ),
      ),
    );
  }

  Widget _buildTaskDetailsSheet(ChannelTask task, ScrollController scrollController) {
    final dateFormat = DateFormat('MMM d, yyyy');

    return Container(
      padding: const EdgeInsets.all(20),
      child: ListView(
        controller: scrollController,
        children: [
          // Handle bar
          Center(
            child: Container(
              width: 40,
              height: 4,
              margin: const EdgeInsets.only(bottom: 20),
              decoration: BoxDecoration(
                color: Colors.grey[300],
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),

          // Title
          Text(
            task.title,
            style: const TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 16),

          // Status and Priority
          Row(
            children: [
              Container(
                width: 12,
                height: 12,
                decoration: BoxDecoration(
                  color: _statusColors[task.status] ?? Colors.grey,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 8),
              Text(
                task.status.replaceAll('_', ' ').toUpperCase(),
                style: TextStyle(
                  color: _statusTextColors[task.status],
                  fontWeight: FontWeight.w600,
                  fontSize: 12,
                ),
              ),
              const SizedBox(width: 16),
              if (task.priority != 'medium') ...[
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: _priorityColors[task.priority]?.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    task.priority.toUpperCase(),
                    style: TextStyle(
                      color: _priorityColors[task.priority],
                      fontWeight: FontWeight.w600,
                      fontSize: 11,
                    ),
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 20),

          // Description
          if (task.description != null && task.description!.isNotEmpty) ...[
            Text(
              task.description!,
              style: TextStyle(
                fontSize: 16,
                color: Colors.grey[700],
                height: 1.5,
              ),
            ),
            const SizedBox(height: 20),
          ],

          // Channel name
          if (task.channelName != null)
            _buildDetailRow(
              icon: Icons.tag,
              label: 'Channel',
              value: task.channelName!,
            ),

          // Details grid
          _buildDetailRow(
            icon: Icons.calendar_today,
            label: 'Start Date',
            value: task.startDate != null
                ? dateFormat.format(task.startDate!)
                : 'Not set',
          ),
          if (task.endDate != null)
            _buildDetailRow(
              icon: Icons.event,
              label: 'End Date',
              value: dateFormat.format(task.endDate!),
            ),
          if (task.dueDate != null)
            _buildDetailRow(
              icon: Icons.flag,
              label: 'Due Date',
              value: dateFormat.format(task.dueDate!),
            ),
          if (task.startTime != null)
            _buildDetailRow(
              icon: Icons.access_time,
              label: 'Time',
              value: '${task.startTime}${task.endTime != null ? ' - ${task.endTime}' : ''}',
            ),
          if (task.estimatedHours != null)
            _buildDetailRow(
              icon: Icons.hourglass_empty,
              label: 'Estimated Hours',
              value: '${task.estimatedHours}h',
            ),
          if (task.assigneeDetails != null && task.assigneeDetails!.isNotEmpty)
            _buildDetailRow(
              icon: Icons.person,
              label: 'Assigned To',
              value: task.assigneeDetails!
                  .map((a) => a.displayName)
                  .join(', '),
            ),
          if (task.teamDetails != null && task.teamDetails!.isNotEmpty)
            _buildDetailRow(
              icon: Icons.group,
              label: 'Teams',
              value: task.teamDetails!
                  .map((t) => t.displayName)
                  .join(', '),
            ),

          // Progress for multi-assignee tasks
          if (task.requiresIndividualResponse && task.progressInfo != null) ...[
            const SizedBox(height: 20),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.blue[50],
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Individual Progress',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    task.completionText,
                    style: TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                      color: Colors.blue[700],
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Each assignee marks done individually',
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.grey[600],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildDetailRow({
    required IconData icon,
    required String label,
    required String value,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 20, color: Colors.grey[600]),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.grey[600],
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ==================== QUICK ADD TASK ====================
  Future<List<Thread>> _loadThreadsForWorkspace(String workspaceId) async {
    // Check cache first
    if (_threadCache.containsKey(workspaceId)) {
      return _threadCache[workspaceId]!;
    }

    try {
      final response = await _httpClient.get('/api/workspaces/$workspaceId/threads');
      final threadsData = response.data['threads'] as List;
      final threads = threadsData.map((data) => Thread.fromJson(data)).toList();
      _threadCache[workspaceId] = threads;
      return threads;
    } catch (e) {
      print('Error loading threads: $e');
      return [];
    }
  }

  Future<void> _showQuickAddTask() async {
    // Determine which workspace/thread to use
    String? workspaceId = _lastUsedWorkspaceId;
    String? threadId = _lastUsedThreadId;

    // If no last used, try to get from first task
    if ((workspaceId == null || threadId == null) && _myTasks.isNotEmpty) {
      workspaceId = _myTasks.first.workspaceId;
      threadId = _myTasks.first.threadId;
    }

    // If still no workspace, try first workspace
    if (workspaceId == null && _workspaces.isNotEmpty) {
      workspaceId = _workspaces.first.id;
    }

    if (workspaceId == null) {
      _showErrorSnackBar('Please create a workspace first');
      return;
    }

    // Find the workspace
    final workspace = _workspaces.firstWhere(
      (w) => w.id == workspaceId,
      orElse: () => _workspaces.first,
    );

    // Load threads for this workspace
    final threads = await _loadThreadsForWorkspace(workspace.id);
    if (threads.isEmpty) {
      _showErrorSnackBar('Please create a channel first');
      return;
    }

    // Find the target thread (last used or first available)
    Thread thread;
    if (threadId != null) {
      thread = threads.firstWhere(
        (t) => t.id == threadId,
        orElse: () => threads.first,
      );
    } else {
      thread = threads.first;
    }

    // Update last used for next time
    _lastUsedWorkspaceId = workspace.id;
    _lastUsedThreadId = thread.id;

    // Show the dialog
    if (!mounted) return;
    showDialog(
      context: context,
      builder: (context) => QuickTaskDialog(
        thread: thread,
        workspace: workspace,
        onTaskCreated: () {
          _loadMyTasks(); // Refresh tasks after creation
        },
      ),
    );
  }

  // ==================== WORKSPACES VIEW ====================
  Widget _buildWorkspacesView() {
    if (_loadingWorkspaces) return _buildLoadingScreen();
    return CustomScrollView(
      slivers: [
        _buildWorkspacesHeader(),
        _buildSearchBar(),
        _buildWorkspaceGrid(),
      ],
    );
  }

  Widget _buildLoadingScreen() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              boxShadow: [BoxShadow(color: Colors.grey.withOpacity(0.1), spreadRadius: 2, blurRadius: 10, offset: const Offset(0, 2))],
            ),
            child: const Icon(Icons.message_rounded, size: 48, color: Colors.grey),
          ),
          const SizedBox(height: 32),
          SizedBox(
            width: 40,
            height: 40,
            child: CircularProgressIndicator(strokeWidth: 3, valueColor: AlwaysStoppedAnimation<Color>(Colors.blue.shade600)),
          ),
          const SizedBox(height: 24),
          Text('Loading your workspaces...', style: TextStyle(fontSize: 16, color: Colors.grey.shade600, fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }

  Widget _buildWorkspacesHeader() {
    return SliverToBoxAdapter(
      child: FadeTransition(
        opacity: _fadeAnimation,
        child: SlideTransition(
          position: _slideAnimation,
          child: Container(
            padding: const EdgeInsets.all(24),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: Colors.grey.shade200),
                        boxShadow: [BoxShadow(color: Colors.grey.withOpacity(0.1), spreadRadius: 1, blurRadius: 4, offset: const Offset(0, 1))],
                      ),
                      child: Icon(Icons.message_rounded, size: 24, color: Colors.grey.shade700),
                    ),
                    const SizedBox(width: 16),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('crew', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.black87)),
                        Text('Your Workspaces', style: TextStyle(fontSize: 14, color: Colors.grey.shade600)),
                      ],
                    ),
                  ],
                ),
                GestureDetector(
                  onTap: widget.onSignOut,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.grey.shade200),
                    ),
                    child: Text('Sign Out', style: TextStyle(fontSize: 14, color: Colors.grey.shade600, fontWeight: FontWeight.w500)),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildSearchBar() {
    return SliverToBoxAdapter(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 24),
        child: Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Colors.grey.shade200),
            boxShadow: [BoxShadow(color: Colors.grey.withOpacity(0.05), spreadRadius: 1, blurRadius: 8, offset: const Offset(0, 2))],
          ),
          child: TextField(
            controller: _searchController,
            decoration: InputDecoration(
              hintText: 'Search workspaces...',
              prefixIcon: Icon(Icons.search_rounded, color: Colors.grey.shade400),
              border: InputBorder.none,
              contentPadding: const EdgeInsets.all(20),
              hintStyle: TextStyle(color: Colors.grey.shade500, fontSize: 16),
            ),
            onChanged: (value) => setState(() => _searchQuery = value),
          ),
        ),
      ),
    );
  }

  Widget _buildWorkspaceGrid() {
    final showCreateCard = _canCreateWorkspace;
    return SliverPadding(
      padding: const EdgeInsets.all(24),
      sliver: SliverGrid(
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 1,
          childAspectRatio: 3.2,
          mainAxisSpacing: 16,
        ),
        delegate: SliverChildBuilderDelegate(
          (context, index) {
            if (index < _filteredWorkspaces.length) {
              return _buildWorkspaceCard(_filteredWorkspaces[index], index);
            } else if (showCreateCard) {
              return _buildCreateWorkspaceCard();
            } else {
              return _buildUpgradePromptCard();
            }
          },
          childCount: _filteredWorkspaces.length + 1,
        ),
      ),
    );
  }

  Widget _buildWorkspaceCard(Workspace workspace, int index) {
    Color workspaceColor = Colors.blue;
    final colorName = workspace.color;
    switch (colorName) {
      case 'purple': workspaceColor = Colors.purple.shade500; break;
      case 'blue': workspaceColor = Colors.blue.shade500; break;
      case 'green': workspaceColor = Colors.green.shade500; break;
      case 'red': workspaceColor = Colors.red.shade500; break;
      case 'orange': workspaceColor = Colors.orange.shade500; break;
      case 'teal': workspaceColor = Colors.teal.shade500; break;
      case 'indigo': workspaceColor = Colors.indigo.shade500; break;
      default: workspaceColor = Colors.blue.shade500;
    }
    
    return GestureDetector(
      onTap: () => widget.onSelectWorkspace?.call(workspace.toJson()),
      child: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Colors.white, Colors.white.withOpacity(0.8)]),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: Colors.white.withOpacity(0.3)),
          boxShadow: [BoxShadow(color: Colors.grey.withOpacity(0.1), spreadRadius: 2, blurRadius: 12, offset: const Offset(0, 4))],
        ),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Row(
            children: [
              Container(
                width: 60,
                height: 60,
                decoration: BoxDecoration(
                  color: workspaceColor,
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [BoxShadow(color: workspaceColor.withOpacity(0.3), spreadRadius: 1, blurRadius: 8, offset: const Offset(0, 2))],
                ),
                child: const Icon(Icons.workspaces_rounded, color: Colors.white, size: 28),
              ),
              const SizedBox(width: 20),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(workspace.name, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.black87), maxLines: 1, overflow: TextOverflow.ellipsis),
                    const SizedBox(height: 4),
                    Text(workspace.description ?? 'No description', style: TextStyle(fontSize: 13, color: Colors.grey.shade600), maxLines: 1, overflow: TextOverflow.ellipsis),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Icon(Icons.people_rounded, size: 16, color: Colors.grey.shade500),
                        const SizedBox(width: 6),
                        Text('${workspace.memberCount}', style: TextStyle(fontSize: 12, color: Colors.grey.shade500, fontWeight: FontWeight.w500)),
                        const SizedBox(width: 4),
                        Text('·', style: TextStyle(fontSize: 12, color: Colors.grey.shade400)),
                        const SizedBox(width: 4),
                        Flexible(child: Text(workspace.lastActivity, style: TextStyle(fontSize: 12, color: Colors.grey.shade500, fontWeight: FontWeight.w500), maxLines: 1, overflow: TextOverflow.ellipsis)),
                        if (workspace.isAdmin) ...[
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(color: Colors.blue.shade50, borderRadius: BorderRadius.circular(8)),
                            child: Text('Admin', style: TextStyle(fontSize: 10, color: Colors.blue.shade700, fontWeight: FontWeight.w600)),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
              Icon(Icons.chevron_right_rounded, color: Colors.grey.shade400, size: 28),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCreateWorkspaceCard() {
    return GestureDetector(
      onTap: () => _showCreateWorkspaceDialog(),
      child: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Colors.grey.shade50, Colors.white.withOpacity(0.5)]),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: Colors.grey.shade300, style: BorderStyle.solid, width: 2),
        ),
        child: Container(
          padding: const EdgeInsets.all(20),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(color: Colors.grey.shade100, borderRadius: BorderRadius.circular(14)),
                child: Icon(Icons.add_rounded, size: 28, color: Colors.grey.shade600),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text('Create New Workspace', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.grey.shade700)),
                    const SizedBox(height: 2),
                    Text('Start a new workspace', style: TextStyle(fontSize: 13, color: Colors.grey.shade500)),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildUpgradePromptCard() {
    return GestureDetector(
      onTap: () => _showSubscriptionLimitDialog(),
      child: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Colors.orange.shade50, Colors.white.withOpacity(0.5)]),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: Colors.orange.shade200, width: 2),
        ),
        child: Container(
          padding: const EdgeInsets.all(20),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(color: Colors.orange.shade100, borderRadius: BorderRadius.circular(14)),
                child: Icon(Icons.workspace_premium, size: 28, color: Colors.orange.shade700),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text('Upgrade to Pro', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.orange.shade700)),
                    const SizedBox(height: 2),
                    Text('Create unlimited workspaces', style: TextStyle(fontSize: 13, color: Colors.orange.shade600)),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showCreateWorkspaceDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Create New Workspace', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: _nameController,
              autofocus: true,
              decoration: InputDecoration(
                hintText: 'Workspace name',
                filled: true,
                fillColor: Colors.grey.shade50,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                contentPadding: const EdgeInsets.all(16),
              ),
              onChanged: (value) => setState(() => _newWorkspaceName = value),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _descriptionController,
              maxLines: 3,
              decoration: InputDecoration(
                hintText: 'Description (optional)',
                filled: true,
                fillColor: Colors.grey.shade50,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                contentPadding: const EdgeInsets.all(16),
              ),
              onChanged: (value) => setState(() => _newWorkspaceDescription = value),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(context).pop();
              _nameController.clear();
              _descriptionController.clear();
              setState(() { _newWorkspaceName = ''; _newWorkspaceDescription = ''; });
            },
            child: Text('Cancel', style: TextStyle(color: Colors.grey.shade600)),
          ),
          ElevatedButton(
            onPressed: _newWorkspaceName.trim().isEmpty ? null : () async {
              await _createWorkspace();
              if (mounted) Navigator.of(context).pop();
            },
            style: ElevatedButton.styleFrom(backgroundColor: Colors.blue.shade600, foregroundColor: Colors.white),
            child: _creating
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, valueColor: AlwaysStoppedAnimation<Color>(Colors.white)))
                : const Text('Create'),
          ),
        ],
      ),
    );
  }

  Future<void> _createWorkspace() async {
    setState(() => _creating = true);
    try {
      final newWorkspace = await _workspaceService.createWorkspace(
        name: _newWorkspaceName,
        description: _newWorkspaceDescription.isEmpty ? null : _newWorkspaceDescription,
      );
      setState(() {
        _workspaces.insert(0, newWorkspace);
        _nameController.clear();
        _descriptionController.clear();
        _newWorkspaceName = '';
        _newWorkspaceDescription = '';
        _creating = false;
      });
      _showSuccessSnackBar('Workspace created successfully!');
    } catch (e) {
      setState(() => _creating = false);
      final errorMessage = e.toString();
      if (errorMessage.contains('403') || errorMessage.contains('Subscription')) {
        _showSubscriptionLimitDialog();
      } else {
        _showErrorSnackBar('Failed to create workspace: $e');
      }
    }
  }

  void _showSubscriptionLimitDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Row(children: [Icon(Icons.workspace_premium, color: Colors.orange), SizedBox(width: 12), Text('Workspace Limit')]),
        content: const Text('Upgrade to a paid plan to create unlimited workspaces.'),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Maybe Later')),
          ElevatedButton(
            onPressed: () {
              Navigator.of(context).pop();
              _showSuccessSnackBar('Subscription upgrade coming soon!');
            },
            style: ElevatedButton.styleFrom(backgroundColor: Colors.blue.shade600, foregroundColor: Colors.white),
            child: const Text('View Plans'),
          ),
        ],
      ),
    );
  }

  Widget _buildKnowledgePlaceholder() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(color: Colors.green.withOpacity(0.1), borderRadius: BorderRadius.circular(24)),
              child: const Icon(Icons.library_books, size: 64, color: Colors.green),
            ),
            const SizedBox(height: 24),
            Text('Knowledge Base', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.grey.shade800)),
            const SizedBox(height: 12),
            Text('Organized knowledge with categories and tagging', style: TextStyle(fontSize: 16, color: Colors.grey.shade600), textAlign: TextAlign.center),
          ],
        ),
      ),
    );
  }

  Widget _buildBottomNavigation() {
    return BottomNavigationBar(
      currentIndex: _selectedBottomNavIndex,
      onTap: (index) {
        if (index == 1) {
          // Calendar - show popup selector instead of navigating
          _showCalendarViewSelector();
        } else {
          setState(() => _selectedBottomNavIndex = index);
        }
      },
      type: BottomNavigationBarType.fixed,
      selectedItemColor: Colors.blue.shade600,
      unselectedItemColor: Colors.grey.shade500,
      selectedFontSize: 12,
      unselectedFontSize: 11,
      items: const [
        BottomNavigationBarItem(icon: Icon(Icons.today_outlined), activeIcon: Icon(Icons.today), label: 'Today'),
        BottomNavigationBarItem(icon: Icon(Icons.calendar_month_outlined), activeIcon: Icon(Icons.calendar_month), label: 'Calendar'),
        BottomNavigationBarItem(icon: Icon(Icons.workspaces_outlined), activeIcon: Icon(Icons.workspaces), label: 'Workspaces'),
        BottomNavigationBarItem(icon: Icon(Icons.library_books_outlined), activeIcon: Icon(Icons.library_books), label: 'Knowledge'),
      ],
    );
  }
}
