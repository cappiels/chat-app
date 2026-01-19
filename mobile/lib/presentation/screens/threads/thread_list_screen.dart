import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../data/services/workspace_service.dart';
import '../../../data/services/http_client.dart';
import '../../../data/models/thread.dart';
import '../../../data/models/workspace.dart';
import '../chat/chat_screen.dart';
import '../calendar/channel_calendar_screen.dart';
import '../timeline/channel_timeline_screen.dart';
import '../calendar/channel_weekly_calendar_screen.dart';

class ThreadListScreen extends ConsumerStatefulWidget {
  final Map<String, dynamic> workspace;
  final VoidCallback onBack;
  
  const ThreadListScreen({
    super.key,
    required this.workspace,
    required this.onBack,
  });

  @override
  ConsumerState<ThreadListScreen> createState() => _ThreadListScreenState();
}

class _ThreadListScreenState extends ConsumerState<ThreadListScreen> {
  final HttpClient _httpClient = HttpClient();
  late final WorkspaceService _workspaceService;
  
  List<Thread> _threads = [];
  bool _loading = true;
  int _selectedBottomNavIndex = 0;
  Thread? _selectedThread;
  int _previousNavIndex = 0;

  // Today view state
  List<Map<String, dynamic>> _myTasks = [];
  bool _tasksLoading = false;
  String _taskFilter = 'all'; // 'all', 'assigned', 'created', 'completed'
  
  @override
  void initState() {
    super.initState();
    _workspaceService = WorkspaceService();
    _loadThreads();
  }

  Future<void> _loadThreads() async {
    try {
      setState(() => _loading = true);
      
      final workspaceId = widget.workspace['id'];
      print('🔄 Loading REAL channels from API for workspace: $workspaceId');
      
      // Load real threads from API using HttpClient directly
      try {
        final response = await _httpClient.get(
          '/api/workspaces/$workspaceId/threads',
        );
        
        final threadsData = response.data['threads'] as List;
        final loadedThreads = threadsData.map((threadData) => Thread.fromJson(threadData)).toList();
        
        setState(() {
          _threads = loadedThreads;
          // Sort threads: unread first
          _threads.sort((a, b) {
            if (a.unreadCount > 0 && b.unreadCount == 0) return -1;
            if (a.unreadCount == 0 && b.unreadCount > 0) return 1;
            return b.updatedAt.compareTo(a.updatedAt);
          });
          _loading = false;
          
          // Auto-select first thread if none selected (for Calendar/Timeline/Knowledge/Weekly views)
          if (_selectedThread == null && _threads.isNotEmpty) {
            _selectedThread = _threads.first;
          }
        });
        
        print('✅ Loaded ${_threads.length} REAL channels from API');
      } catch (apiError) {
        print('❌ API error loading threads: $apiError');
        
        // Show error to user
        setState(() {
          _threads = [];
          _loading = false;
        });
        
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Failed to load channels: $apiError'),
              action: SnackBarAction(
                label: 'Retry',
                onPressed: _loadThreads,
              ),
            ),
          );
        }
      }
    } catch (e) {
      print('❌ Error loading channels: $e');
      setState(() {
        _threads = [];
        _loading = false;
      });
    }
  }

  Future<void> _loadMyTasks() async {
    if (_tasksLoading) return;

    setState(() => _tasksLoading = true);

    try {
      final response = await _httpClient.get(
        '/api/tasks/all',
        queryParameters: {'my_tasks': 'true', 'limit': '100'},
      );

      final tasksData = response.data['tasks'] as List? ?? [];
      setState(() {
        _myTasks = tasksData.cast<Map<String, dynamic>>();
        _tasksLoading = false;
      });
      print('✅ Loaded ${_myTasks.length} tasks for Today view');
    } catch (e) {
      print('❌ Error loading tasks: $e');
      setState(() {
        _myTasks = [];
        _tasksLoading = false;
      });
    }
  }

  List<Map<String, dynamic>> _getFilteredTasks() {
    return _myTasks.where((task) {
      final isCompleted = task['status'] == 'completed' || task['user_completed'] == true;

      if (_taskFilter == 'assigned' && task['user_is_assignee'] != true) return false;
      if (_taskFilter == 'created' && task['created_by'] != null) {
        // Would need user ID comparison here
      }
      if (_taskFilter == 'completed') return isCompleted;

      // For 'all' and other filters, exclude completed tasks
      return !isCompleted;
    }).toList();
  }

  // REMOVED: No more demo threads - load from API only
  List<Thread> _get_REMOVED_DemoThreads() {
    final now = DateTime.now();
    final workspaceId = widget.workspace['id'] as String;
    final workspaceName = widget.workspace['name'] as String;
    
    // Create workspace-specific demo threads using workspace ID as seed
    final seed = workspaceId.hashCode % 3;
    
    final List<Thread> threads = [];
    
    // Always include a general channel
    threads.add(Thread(
      id: '${workspaceId}_general',
      name: 'general',
      description: '$workspaceName general discussions',
      type: 'channel',
      workspaceId: workspaceId,
      createdAt: now.subtract(const Duration(days: 30)),
          updatedAt: now.subtract(Duration(minutes: 5 + seed)),
      unreadCount: seed == 0 ? 3 : 0,
      memberCount: 12,
      lastMessage: LastMessage(
        id: 'msg_1',
        content: 'Welcome to $workspaceName! 🎉',
        senderName: 'Team Lead',
            createdAt: now.subtract(Duration(minutes: 5 + seed)),
        messageType: 'text',
      ),
    ));
    
    // Add workspace-specific channels based on seed
    if (seed == 0) {
      threads.add(Thread(
        id: '${workspaceId}_dev',
        name: 'development',
        description: 'Development updates and code reviews',
        type: 'channel',
        workspaceId: workspaceId,
        createdAt: now.subtract(const Duration(days: 25)),
        updatedAt: now.subtract(const Duration(hours: 2)),
        unreadCount: 0,
        memberCount: 8,
        lastMessage: LastMessage(
          id: 'msg_2',
          content: 'The new API is looking great 🚀',
          senderName: 'Jane Smith',
          createdAt: now.subtract(const Duration(hours: 2)),
          messageType: 'text',
        ),
      ));
      threads.add(Thread(
        id: '${workspaceId}_design',
        name: 'design',
        description: 'Design feedback and UI discussions',
        type: 'channel',
        workspaceId: workspaceId,
        createdAt: now.subtract(const Duration(days: 20)),
        updatedAt: now.subtract(const Duration(hours: 4)),
        unreadCount: 7,
        memberCount: 5,
        lastMessage: LastMessage(
          id: 'msg_3',
          content: 'Can we review the new mockups?',
          senderName: 'Bob Wilson',
          createdAt: now.subtract(const Duration(hours: 4)),
          messageType: 'text',
        ),
      ));
    } else if (seed == 1) {
      threads.add(Thread(
        id: '${workspaceId}_marketing',
        name: 'marketing',
        description: 'Marketing campaigns and content',
        type: 'channel',
        workspaceId: workspaceId,
        createdAt: now.subtract(const Duration(days: 15)),
        updatedAt: now.subtract(const Duration(hours: 1)),
        unreadCount: 2,
        memberCount: 6,
        lastMessage: LastMessage(
          id: 'msg_4',
          content: 'New campaign launching next week!',
          senderName: 'Marketing Team',
          createdAt: now.subtract(const Duration(hours: 1)),
          messageType: 'text',
        ),
      ));
      threads.add(Thread(
        id: '${workspaceId}_announcements',
        name: 'announcements',
        description: 'Important team announcements',
        type: 'channel',
        workspaceId: workspaceId,
        createdAt: now.subtract(const Duration(days: 10)),
        updatedAt: now.subtract(const Duration(hours: 6)),
        unreadCount: 1,
        memberCount: 15,
        lastMessage: LastMessage(
          id: 'msg_5',
          content: 'Team meeting scheduled for tomorrow',
          senderName: 'Admin',
          createdAt: now.subtract(const Duration(hours: 6)),
          messageType: 'text',
        ),
      ));
    } else {
      threads.add(Thread(
        id: '${workspaceId}_support',
        name: 'support',
        description: 'Customer support and tickets',
        type: 'channel',
        workspaceId: workspaceId,
        createdAt: now.subtract(const Duration(days: 12)),
        updatedAt: now.subtract(const Duration(minutes: 30)),
        unreadCount: 5,
        memberCount: 4,
        lastMessage: LastMessage(
          id: 'msg_6',
          content: 'New ticket assigned to you',
          senderName: 'Support Bot',
          createdAt: now.subtract(const Duration(minutes: 30)),
          messageType: 'text',
        ),
      ));
      threads.add(Thread(
        id: '${workspaceId}_random',
        name: 'random',
        description: 'Off-topic discussions and fun',
        type: 'channel',
        workspaceId: workspaceId,
        createdAt: now.subtract(const Duration(days: 5)),
        updatedAt: now.subtract(const Duration(hours: 3)),
        unreadCount: 0,
        memberCount: 10,
        lastMessage: LastMessage(
          id: 'msg_7',
          content: 'Happy Friday everyone! 🎉',
          senderName: 'Team Member',
          createdAt: now.subtract(const Duration(hours: 3)),
          messageType: 'text',
        ),
      ));
    }
    
    return threads;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: widget.onBack,
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              widget.workspace['name'] ?? 'Workspace',
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            Text(
              '${_threads.length} channels',
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.normal),
            ),
          ],
        ),
        backgroundColor: Colors.blue.shade600,
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      body: _buildBody(),
      bottomNavigationBar: _buildBottomNavigation(),
    );
  }

  Widget _buildBody() {
    switch (_selectedBottomNavIndex) {
      case 0:
        return _buildTodayView();
      case 1:
        return _buildThreadList();
      case 2:
        return _buildCalendarView();
      case 3:
        return _buildTimelineView();
      case 4:
        return _buildWeeklyCalendarPlaceholder();
      default:
        return _buildThreadList();
    }
  }

  Widget _buildTodayView() {
    // Load tasks on first view
    if (_myTasks.isEmpty && !_tasksLoading) {
      _loadMyTasks();
    }

    final now = DateTime.now();
    final dateStr = '${_getMonthName(now.month)} ${now.day}';
    final dayStr = _getDayName(now.weekday);

    return RefreshIndicator(
      onRefresh: _loadMyTasks,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            Text(
              'Today',
              style: TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.bold,
                color: Colors.grey.shade900,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              '$dateStr · $dayStr',
              style: TextStyle(
                fontSize: 14,
                color: Colors.grey.shade500,
              ),
            ),
            const SizedBox(height: 16),

            // Filter chips
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  _buildFilterChip('All Tasks', 'all'),
                  const SizedBox(width: 8),
                  _buildFilterChip('Assigned to Me', 'assigned'),
                  const SizedBox(width: 8),
                  _buildFilterChip('Created by Me', 'created'),
                  const SizedBox(width: 8),
                  _buildFilterChip('Completed', 'completed', isGreen: true),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Divider
            Container(height: 1, color: Colors.grey.shade200),
            const SizedBox(height: 16),

            // Tasks
            if (_tasksLoading)
              const Center(
                child: Padding(
                  padding: EdgeInsets.all(32),
                  child: CircularProgressIndicator(),
                ),
              )
            else if (_getFilteredTasks().isEmpty)
              Center(
                child: Padding(
                  padding: const EdgeInsets.all(32),
                  child: Column(
                    children: [
                      Icon(Icons.check_circle_outline, size: 64, color: Colors.grey.shade300),
                      const SizedBox(height: 16),
                      Text(
                        'No Tasks Found',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w600,
                          color: Colors.grey.shade700,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Tasks assigned to you will appear here',
                        style: TextStyle(fontSize: 14, color: Colors.grey.shade500),
                      ),
                    ],
                  ),
                ),
              )
            else
              ..._getFilteredTasks().map((task) => _buildTaskItem(task)),

            // Back to workspaces button
            const SizedBox(height: 24),
            Center(
              child: TextButton.icon(
                onPressed: widget.onBack,
                icon: const Icon(Icons.arrow_back),
                label: const Text('Back to Workspaces'),
                style: TextButton.styleFrom(
                  foregroundColor: Colors.grey.shade600,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFilterChip(String label, String filter, {bool isGreen = false}) {
    final isSelected = _taskFilter == filter;
    return GestureDetector(
      onTap: () => setState(() => _taskFilter = filter),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected
              ? (isGreen ? Colors.green.shade600 : Colors.blue.shade600)
              : Colors.grey.shade100,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w500,
            color: isSelected ? Colors.white : Colors.grey.shade600,
          ),
        ),
      ),
    );
  }

  Widget _buildTaskItem(Map<String, dynamic> task) {
    final isCompleted = task['status'] == 'completed' || task['user_completed'] == true;
    final title = task['title'] ?? 'Untitled';
    final workspaceName = task['workspace_name'] ?? '';
    final channelName = task['channel_name'] ?? '';
    final dueDate = task['due_date'] ?? task['end_date'];
    final priority = task['priority'] ?? 'medium';

    Color priorityColor;
    switch (priority) {
      case 'high':
        priorityColor = Colors.red.shade500;
        break;
      case 'medium':
        priorityColor = Colors.yellow.shade700;
        break;
      case 'low':
        priorityColor = Colors.green.shade500;
        break;
      default:
        priorityColor = Colors.grey.shade400;
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Checkbox
          Container(
            width: 20,
            height: 20,
            margin: const EdgeInsets.only(top: 2),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(
                color: isCompleted ? Colors.green.shade500 : priorityColor,
                width: 2,
              ),
              color: isCompleted ? Colors.green.shade500 : Colors.transparent,
            ),
            child: isCompleted
                ? const Icon(Icons.check, size: 14, color: Colors.white)
                : null,
          ),
          const SizedBox(width: 12),

          // Content
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                    color: isCompleted ? Colors.grey.shade400 : Colors.grey.shade900,
                    decoration: isCompleted ? TextDecoration.lineThrough : null,
                  ),
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Icon(Icons.chat_bubble_outline, size: 12, color: Colors.grey.shade500),
                    const SizedBox(width: 4),
                    Text(
                      workspaceName,
                      style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      '#$channelName',
                      style: TextStyle(fontSize: 12, color: Colors.blue.shade600),
                    ),
                  ],
                ),
              ],
            ),
          ),

          // Due date
          if (dueDate != null && !isCompleted)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: _isOverdue(dueDate) ? Colors.red.shade50 : Colors.grey.shade100,
                borderRadius: BorderRadius.circular(4),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.calendar_today,
                    size: 12,
                    color: _isOverdue(dueDate) ? Colors.red.shade700 : Colors.grey.shade600,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    _formatTaskDate(dueDate),
                    style: TextStyle(
                      fontSize: 12,
                      color: _isOverdue(dueDate) ? Colors.red.shade700 : Colors.grey.shade600,
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  bool _isOverdue(String? dateStr) {
    if (dateStr == null) return false;
    try {
      final date = DateTime.parse(dateStr);
      return date.isBefore(DateTime.now());
    } catch (e) {
      return false;
    }
  }

  String _formatTaskDate(String? dateStr) {
    if (dateStr == null) return '';
    try {
      final date = DateTime.parse(dateStr);
      final now = DateTime.now();
      final today = DateTime(now.year, now.month, now.day);
      final tomorrow = today.add(const Duration(days: 1));
      final taskDate = DateTime(date.year, date.month, date.day);

      if (taskDate == today) return 'Today';
      if (taskDate == tomorrow) return 'Tomorrow';
      return '${_getMonthName(date.month).substring(0, 3)} ${date.day}';
    } catch (e) {
      return '';
    }
  }

  String _getMonthName(int month) {
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];
    return months[month - 1];
  }

  String _getDayName(int weekday) {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return days[weekday - 1];
  }

  Widget _buildThreadList() {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_threads.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.chat_bubble_outline, size: 64, color: Colors.grey.shade400),
            const SizedBox(height: 16),
            Text(
              'No channels yet',
              style: TextStyle(fontSize: 18, color: Colors.grey.shade600),
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      itemCount: _threads.length,
      itemBuilder: (context, index) => _buildThreadCard(_threads[index]),
    );
  }

  Widget _buildThreadCard(Thread thread) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.grey.withOpacity(0.1),
            spreadRadius: 1,
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        leading: Container(
          width: 48,
          height: 48,
          decoration: BoxDecoration(
            color: Colors.blue.shade50,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(
            thread.type == 'channel' ? Icons.tag : Icons.person,
            color: Colors.blue.shade600,
          ),
        ),
        title: Row(
          children: [
            Text(
              thread.type == 'channel' ? '#${thread.name}' : thread.name,
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
            if (thread.unreadCount > 0) ...[
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: Colors.red.shade500,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  '${thread.unreadCount}',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ],
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (thread.description != null) ...[
              const SizedBox(height: 2),
              Text(
                thread.description!,
                style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
            if (thread.lastMessage != null) ...[
              const SizedBox(height: 4),
              Text(
                thread.lastMessage!.previewContent,
                style: TextStyle(fontSize: 13, color: Colors.grey.shade700),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ],
        ),
        trailing: thread.lastMessage != null
            ? Text(
                thread.lastMessage!.timeAgo,
                style: TextStyle(fontSize: 11, color: Colors.grey.shade500),
              )
            : null,
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => ChatScreen(
                workspace: widget.workspace,
                thread: thread,
              ),
            ),
          );
        },
      ),
    );
  }

  String _formatTime(DateTime time) {
    final now = DateTime.now();
    final difference = now.difference(time);

    if (difference.inMinutes < 1) {
      return 'now';
    } else if (difference.inMinutes < 60) {
      return '${difference.inMinutes}m';
    } else if (difference.inHours < 24) {
      return '${difference.inHours}h';
    } else if (difference.inDays < 7) {
      return '${difference.inDays}d';
    } else {
      return '${(difference.inDays / 7).floor()}w';
    }
  }

  Widget _buildCalendarView() {
    // Show loading state while threads are being fetched
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_threads.isEmpty) {
      return _buildFeaturePlaceholder(
        icon: Icons.calendar_month,
        title: 'No Channels',
        description: 'Create or join channels to use calendar view',
        color: Colors.purple,
      );
    }

    // Safety check for null thread (race condition protection)
    if (_selectedThread == null) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            CircularProgressIndicator(),
            SizedBox(height: 16),
            Text('Loading channel...'),
          ],
        ),
      );
    }

    // Show calendar for selected thread (auto-selected in _loadThreads)
    final workspace = Workspace.fromJson(widget.workspace);
    return Column(
      children: [
        _buildChannelSelectorBar(),
        Expanded(
          child: ChannelCalendarScreen(
            thread: _selectedThread!,
            workspace: workspace,
          ),
        ),
      ],
    );
  }

  Widget _buildWeeklyCalendarPlaceholder() {
    // Show loading state while threads are being fetched
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_threads.isEmpty) {
      return _buildFeaturePlaceholder(
        icon: Icons.view_week,
        title: 'Weekly Calendar',
        description: 'Create or join channels to use weekly calendar',
        color: Colors.teal,
      );
    }

    // Safety check for null thread (race condition protection)
    if (_selectedThread == null) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            CircularProgressIndicator(),
            SizedBox(height: 16),
            Text('Loading channel...'),
          ],
        ),
      );
    }

    // Show weekly calendar for selected thread
    final workspace = Workspace.fromJson(widget.workspace);
    return Column(
      children: [
        _buildChannelSelectorBar(),
        Expanded(
          child: ChannelWeeklyCalendarScreen(
            thread: _selectedThread!,
            workspace: workspace,
          ),
        ),
      ],
    );
  }

  Widget _buildTimelineView() {
    // Show loading state while threads are being fetched
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_threads.isEmpty) {
      return _buildFeaturePlaceholder(
        icon: Icons.timeline,
        title: 'No Channels',
        description: 'Create or join channels to use timeline view',
        color: Colors.orange,
      );
    }

    // Safety check for null thread (race condition protection)
    if (_selectedThread == null) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            CircularProgressIndicator(),
            SizedBox(height: 16),
            Text('Loading channel...'),
          ],
        ),
      );
    }

    // Show timeline for selected thread (auto-selected in _loadThreads)
    final workspace = Workspace.fromJson(widget.workspace);
    return Column(
      children: [
        _buildChannelSelectorBar(),
        Expanded(
          child: ChannelTimelineScreen(
            thread: _selectedThread!,
            workspace: workspace,
          ),
        ),
      ],
    );
  }

  Widget _buildKnowledgePlaceholder() {
    // Show loading state while threads are being fetched
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_threads.isEmpty) {
      return _buildFeaturePlaceholder(
        icon: Icons.library_books,
        title: 'Knowledge Base',
        description: 'Organized knowledge with categories and tagging',
        color: Colors.green,
      );
    }

    // Safety check for null thread (race condition protection)
    if (_selectedThread == null) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            CircularProgressIndicator(),
            SizedBox(height: 16),
            Text('Loading channel...'),
          ],
        ),
      );
    }

    // Show knowledge base for selected thread
    return Column(
      children: [
        _buildChannelSelectorBar(),
        Expanded(
          child: _buildFeaturePlaceholder(
            icon: Icons.library_books,
            title: 'Knowledge Base',
            description: 'Coming soon: Organized knowledge for #${_selectedThread!.name}',
            color: Colors.green,
          ),
        ),
      ],
    );
  }

  Widget _buildChannelSelectorBar() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border(
          bottom: BorderSide(color: Colors.grey[300]!, width: 1),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          Icon(Icons.tag, size: 20, color: Colors.grey[700]),
          const SizedBox(width: 8),
          Expanded(
            child: InkWell(
              onTap: () => _showChannelPicker(),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      '#${_selectedThread?.name ?? 'Select Channel'}',
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  Icon(Icons.arrow_drop_down, color: Colors.grey[600]),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _showChannelPicker() {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => Container(
        padding: const EdgeInsets.symmetric(vertical: 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Row(
                children: [
                  const Text(
                    'Select Channel',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const Spacer(),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
            ),
            const Divider(),
            Flexible(
              child: ListView.builder(
                shrinkWrap: true,
                itemCount: _threads.length,
                itemBuilder: (context, index) {
                  final thread = _threads[index];
                  final isSelected = thread.id == _selectedThread?.id;
                  return ListTile(
                    leading: Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: isSelected ? Colors.blue.shade100 : Colors.blue.shade50,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Icon(
                        thread.type == 'channel' ? Icons.tag : Icons.person,
                        color: isSelected ? Colors.blue.shade700 : Colors.blue.shade600,
                        size: 20,
                      ),
                    ),
                    title: Text(
                      thread.type == 'channel' ? '#${thread.name}' : thread.name,
                      style: TextStyle(
                        fontWeight: isSelected ? FontWeight.bold : FontWeight.w600,
                      ),
                    ),
                    subtitle: thread.description != null
                        ? Text(
                            thread.description!,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 12,
                              color: Colors.grey[600],
                            ),
                          )
                        : null,
                    trailing: isSelected
                        ? Icon(Icons.check_circle, color: Colors.blue.shade600)
                        : null,
                    onTap: () {
                      setState(() {
                        _selectedThread = thread;
                      });
                      Navigator.pop(context);
                    },
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildChannelSelector({
    required IconData icon,
    required String title,
    required String description,
    required Function(Thread) onChannelSelected,
  }) {
    return Column(
      children: [
        Container(
          padding: const EdgeInsets.all(20),
          color: Colors.grey[100],
          child: Column(
            children: [
              Icon(icon, size: 48, color: Colors.blue[600]),
              const SizedBox(height: 12),
              Text(
                title,
                style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                description,
                style: TextStyle(
                  fontSize: 14,
                  color: Colors.grey[600],
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
        Expanded(
          child: ListView.builder(
            itemCount: _threads.length,
            itemBuilder: (context, index) {
              final thread = _threads[index];
              return ListTile(
                leading: Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: Colors.blue.shade50,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(
                    thread.type == 'channel' ? Icons.tag : Icons.person,
                    color: Colors.blue.shade600,
                    size: 20,
                  ),
                ),
                title: Text(
                  thread.type == 'channel' ? '#${thread.name}' : thread.name,
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                subtitle: thread.description != null
                    ? Text(
                        thread.description!,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.grey[600],
                        ),
                      )
                    : null,
                trailing: const Icon(Icons.chevron_right),
                onTap: () => onChannelSelected(thread),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildFeaturePlaceholder({
    required IconData icon,
    required String title,
    required String description,
    required Color color,
  }) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: color.withOpacity(0.1),
                borderRadius: BorderRadius.circular(24),
              ),
              child: Icon(icon, size: 64, color: color),
            ),
            const SizedBox(height: 24),
            Text(
              title,
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
                color: Colors.grey.shade800,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 12),
            Text(
              description,
              style: TextStyle(
                fontSize: 16,
                color: Colors.grey.shade600,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 32),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              decoration: BoxDecoration(
                color: Colors.blue.shade50,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                '🚀 Phase 4: Revolutionary Features',
                style: TextStyle(
                  fontSize: 14,
                  color: Colors.blue.shade700,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBottomNavigation() {
    return BottomNavigationBar(
      currentIndex: _selectedBottomNavIndex,
      onTap: (index) {
        setState(() {
          _previousNavIndex = _selectedBottomNavIndex;
          _selectedBottomNavIndex = index;
        });
      },
      type: BottomNavigationBarType.fixed,
      selectedItemColor: Colors.blue.shade600,
      unselectedItemColor: Colors.grey.shade500,
      selectedFontSize: 12,
      unselectedFontSize: 11,
      items: const [
        BottomNavigationBarItem(
          icon: Icon(Icons.today_outlined),
          activeIcon: Icon(Icons.today),
          label: 'Today',
        ),
        BottomNavigationBarItem(
          icon: Icon(Icons.chat_bubble_outline),
          activeIcon: Icon(Icons.chat_bubble),
          label: 'Chat',
        ),
        BottomNavigationBarItem(
          icon: Icon(Icons.calendar_month_outlined),
          activeIcon: Icon(Icons.calendar_month),
          label: 'Calendar',
        ),
        BottomNavigationBarItem(
          icon: Icon(Icons.timeline_outlined),
          activeIcon: Icon(Icons.timeline),
          label: 'Timeline',
        ),
        BottomNavigationBarItem(
          icon: Icon(Icons.view_week_outlined),
          activeIcon: Icon(Icons.view_week),
          label: 'Weekly',
        ),
      ],
    );
  }
}
