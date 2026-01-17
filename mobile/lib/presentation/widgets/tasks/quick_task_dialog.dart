import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../data/models/thread.dart';
import '../../../data/models/workspace.dart';
import '../../../data/services/task_service.dart';
import '../../../data/services/workspace_service.dart';

class QuickTaskDialog extends StatefulWidget {
  final Thread thread;
  final Workspace workspace;
  final VoidCallback? onTaskCreated;

  const QuickTaskDialog({
    Key? key,
    required this.thread,
    required this.workspace,
    this.onTaskCreated,
  }) : super(key: key);

  @override
  State<QuickTaskDialog> createState() => _QuickTaskDialogState();
}

class _QuickTaskDialogState extends State<QuickTaskDialog> {
  final _formKey = GlobalKey<FormState>();
  final _taskService = TaskService();
  final _workspaceService = WorkspaceService();

  final _titleController = TextEditingController();
  final _locationController = TextEditingController();
  final _tagsController = TextEditingController();

  DateTime? _startDate;
  DateTime? _endDueDate;
  TimeOfDay? _startTime;
  TimeOfDay? _endTime;
  String _priority = 'medium';

  bool _isLoading = false;
  bool _loadingMembers = false;
  String? _error;

  // Assignment functionality
  List<String> _selectedAssignees = [];
  List<int> _selectedTeams = [];
  String _assignmentMode = 'collaborative';
  List<Map<String, dynamic>> _workspaceMembers = [];
  List<Map<String, dynamic>> _workspaceTeams = [];
  bool _showAssignmentSection = true;

  // Workspace/Channel selection
  late Workspace _selectedWorkspace;
  late Thread _selectedThread;
  List<Workspace> _availableWorkspaces = [];
  List<Thread> _availableThreads = [];
  bool _loadingWorkspaces = false;

  @override
  void initState() {
    super.initState();
    _selectedWorkspace = widget.workspace;
    _selectedThread = widget.thread;
    _loadWorkspaceData();
    _loadAvailableWorkspaces();
  }

  @override
  void dispose() {
    _titleController.dispose();
    _locationController.dispose();
    _tagsController.dispose();
    super.dispose();
  }

  Future<void> _loadWorkspaceData() async {
    setState(() => _loadingMembers = true);

    try {
      final response = await _workspaceService.getWorkspace(_selectedWorkspace.id);
      setState(() {
        _workspaceMembers = response.members;
        _workspaceTeams = response.teams;
        _loadingMembers = false;
      });
    } catch (e) {
      print('Error loading workspace data: $e');
      setState(() {
        _workspaceMembers = _selectedWorkspace.members;
        _workspaceTeams = _selectedWorkspace.teams;
        _loadingMembers = false;
      });
    }
  }

  Future<void> _loadAvailableWorkspaces() async {
    setState(() => _loadingWorkspaces = true);

    try {
      final workspaces = await _workspaceService.getWorkspaces();
      setState(() {
        _availableWorkspaces = workspaces;
        _loadingWorkspaces = false;
      });
      // Load threads for current workspace
      await _loadThreadsForWorkspace(_selectedWorkspace.id);
    } catch (e) {
      print('Error loading workspaces: $e');
      setState(() {
        _availableWorkspaces = [_selectedWorkspace];
        _loadingWorkspaces = false;
      });
    }
  }

  Future<void> _loadThreadsForWorkspace(String workspaceId) async {
    try {
      final channels = await _workspaceService.getChannels(workspaceId);
      final threads = channels.map((data) => Thread.fromJson(data)).toList();
      setState(() {
        _availableThreads = threads;
      });
    } catch (e) {
      print('Error loading threads: $e');
      setState(() => _availableThreads = [_selectedThread]);
    }
  }

  void _showWorkspaceChannelPicker() {
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
        builder: (context, scrollController) => _buildWorkspaceChannelPickerSheet(scrollController),
      ),
    );
  }

  Widget _buildWorkspaceChannelPickerSheet(ScrollController scrollController) {
    return Container(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
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
          const Text(
            'Select Workspace & Channel',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 16),
          if (_loadingWorkspaces)
            const Center(child: CircularProgressIndicator())
          else
            Expanded(
              child: ListView(
                controller: scrollController,
                children: [
                  for (final workspace in _availableWorkspaces) ...[
                    Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      decoration: BoxDecoration(
                        color: workspace.id == _selectedWorkspace.id
                            ? Colors.blue.shade50
                            : Colors.grey.shade50,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: workspace.id == _selectedWorkspace.id
                              ? Colors.blue.shade300
                              : Colors.grey.shade200,
                        ),
                      ),
                      child: ExpansionTile(
                        initiallyExpanded: workspace.id == _selectedWorkspace.id,
                        leading: Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: _getWorkspaceColor(workspace.color),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Icon(Icons.workspaces, color: Colors.white, size: 20),
                        ),
                        title: Text(
                          workspace.name,
                          style: TextStyle(
                            fontWeight: workspace.id == _selectedWorkspace.id
                                ? FontWeight.bold
                                : FontWeight.w500,
                          ),
                        ),
                        onExpansionChanged: (expanded) async {
                          if (expanded && workspace.id != _selectedWorkspace.id) {
                            // Load threads when expanding a different workspace
                            await _loadThreadsForWorkspace(workspace.id);
                          }
                        },
                        children: [
                          if (workspace.id == _selectedWorkspace.id)
                            ..._availableThreads.map((thread) => ListTile(
                                  contentPadding: const EdgeInsets.only(left: 72, right: 16),
                                  leading: Icon(
                                    Icons.tag,
                                    size: 20,
                                    color: thread.id == _selectedThread.id
                                        ? Colors.blue.shade700
                                        : Colors.grey.shade600,
                                  ),
                                  title: Text(
                                    thread.name,
                                    style: TextStyle(
                                      color: thread.id == _selectedThread.id
                                          ? Colors.blue.shade700
                                          : Colors.black87,
                                      fontWeight: thread.id == _selectedThread.id
                                          ? FontWeight.bold
                                          : FontWeight.normal,
                                    ),
                                  ),
                                  trailing: thread.id == _selectedThread.id
                                      ? Icon(Icons.check, color: Colors.blue.shade700)
                                      : null,
                                  onTap: () {
                                    setState(() {
                                      _selectedThread = thread;
                                    });
                                    Navigator.pop(context);
                                  },
                                ))
                          else
                            ListTile(
                              contentPadding: const EdgeInsets.only(left: 72, right: 16),
                              title: Text(
                                'Tap to load channels...',
                                style: TextStyle(
                                  color: Colors.grey.shade500,
                                  fontStyle: FontStyle.italic,
                                ),
                              ),
                              onTap: () async {
                                setState(() {
                                  _selectedWorkspace = workspace;
                                  _selectedAssignees = []; // Reset assignees when changing workspace
                                  _selectedTeams = [];
                                });
                                await _loadThreadsForWorkspace(workspace.id);
                                await _loadWorkspaceData();
                                if (_availableThreads.isNotEmpty) {
                                  setState(() {
                                    _selectedThread = _availableThreads.first;
                                  });
                                }
                              },
                            ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
        ],
      ),
    );
  }

  Color _getWorkspaceColor(String? colorName) {
    switch (colorName) {
      case 'purple': return Colors.purple.shade500;
      case 'blue': return Colors.blue.shade500;
      case 'green': return Colors.green.shade500;
      case 'red': return Colors.red.shade500;
      case 'orange': return Colors.orange.shade500;
      case 'teal': return Colors.teal.shade500;
      case 'indigo': return Colors.indigo.shade500;
      default: return Colors.blue.shade500;
    }
  }

  void _toggleAssignee(String userId) {
    setState(() {
      if (_selectedAssignees.contains(userId)) {
        _selectedAssignees.remove(userId);
      } else {
        _selectedAssignees.add(userId);
      }
    });
  }

  void _toggleTeam(int teamId) {
    setState(() {
      if (_selectedTeams.contains(teamId)) {
        _selectedTeams.remove(teamId);
      } else {
        _selectedTeams.add(teamId);
      }
    });
  }

  String get _dialogTitle {
    return (_startTime != null && _endTime != null) ? 'Add Event' : 'Add Task';
  }

  Future<void> _selectDate(BuildContext context, bool isStartDate) async {
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: isStartDate 
          ? (_startDate ?? DateTime.now())
          : (_endDueDate ?? _startDate ?? DateTime.now()),
      firstDate: DateTime(2020),
      lastDate: DateTime(2030),
    );
    
    if (picked != null) {
      setState(() {
        if (isStartDate) {
          _startDate = picked;
        } else {
          _endDueDate = picked;
        }
      });
    }
  }

  Future<void> _selectTime(BuildContext context, bool isStartTime) async {
    final TimeOfDay? picked = await showTimePicker(
      context: context,
      initialTime: isStartTime
          ? (_startTime ?? TimeOfDay.now())
          : (_endTime ?? _startTime ?? TimeOfDay.now()),
    );
    
    if (picked != null) {
      setState(() {
        if (isStartTime) {
          _startTime = picked;
        } else {
          _endTime = picked;
        }
      });
    }
  }

  List<String> _parseTags(String input) {
    if (input.trim().isEmpty) return [];
    return input
        .split(',')
        .map((tag) => tag.trim())
        .where((tag) => tag.isNotEmpty)
        .toList();
  }

  Future<void> _createTask() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    if ((_startTime != null && _endTime == null) ||
        (_startTime == null && _endTime != null)) {
      setState(() {
        _error = 'Please provide both start and end times, or leave both empty for all-day';
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      String? startDateStr;
      String? endDateStr;
      String? dueDateStr;
      String? startTimeStr;
      String? endTimeStr;
      bool isAllDay = false;

      if (_startTime != null && _endTime != null) {
        startDateStr = _startDate != null ? DateFormat('yyyy-MM-dd').format(_startDate!) : null;
        endDateStr = _endDueDate != null ? DateFormat('yyyy-MM-dd').format(_endDueDate!) : null;
        dueDateStr = endDateStr;
        startTimeStr = '${_startTime!.hour.toString().padLeft(2, '0')}:${_startTime!.minute.toString().padLeft(2, '0')}';
        endTimeStr = '${_endTime!.hour.toString().padLeft(2, '0')}:${_endTime!.minute.toString().padLeft(2, '0')}';
        isAllDay = false;
      } else if (_endDueDate != null && _startDate == null) {
        startDateStr = DateFormat('yyyy-MM-dd').format(_endDueDate!);
        endDateStr = DateFormat('yyyy-MM-dd').format(_endDueDate!);
        dueDateStr = DateFormat('yyyy-MM-dd').format(_endDueDate!);
        isAllDay = true;
      } else if (_startDate != null && _endDueDate != null) {
        startDateStr = DateFormat('yyyy-MM-dd').format(_startDate!);
        endDateStr = DateFormat('yyyy-MM-dd').format(_endDueDate!);
        dueDateStr = DateFormat('yyyy-MM-dd').format(_endDueDate!);
        isAllDay = true;
      } else if (_startDate != null) {
        startDateStr = DateFormat('yyyy-MM-dd').format(_startDate!);
        endDateStr = DateFormat('yyyy-MM-dd').format(_startDate!);
        dueDateStr = DateFormat('yyyy-MM-dd').format(_startDate!);
        isAllDay = true;
      }

      final tags = _parseTags(_tagsController.text);

      await _taskService.createTask(
        workspaceId: _selectedWorkspace.id,
        threadId: _selectedThread.id,
        title: _titleController.text.trim(),
        startDate: startDateStr,
        endDate: endDateStr,
        dueDate: dueDateStr,
        startTime: startTimeStr,
        endTime: endTimeStr,
        isAllDay: isAllDay,
        priority: _priority,
        tags: tags.isNotEmpty ? tags : null,
        assignees: _selectedAssignees.isNotEmpty ? _selectedAssignees : null,
        assignedTeams: _selectedTeams.isNotEmpty ? _selectedTeams : null,
        assignmentMode: _assignmentMode,
        requiresIndividualResponse: _assignmentMode == 'individual_response',
      );

      if (mounted) {
        Navigator.of(context).pop();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: [
                const Icon(Icons.check_circle, color: Colors.white),
                const SizedBox(width: 8),
                Text('Task "${_titleController.text}" created successfully'),
              ],
            ),
            backgroundColor: Colors.green,
            duration: const Duration(seconds: 3),
          ),
        );
        widget.onTaskCreated?.call();
      }
    } catch (e) {
      setState(() {
        _error = 'Failed to create task: ${e.toString()}';
        _isLoading = false;
      });
    }
  }

  // Check if completion type selector should be shown
  bool get _showCompletionTypeSelector =>
      _selectedTeams.isNotEmpty || _selectedAssignees.length > 1;

  @override
  Widget build(BuildContext context) {
    final dateFormat = DateFormat('MMM d, yyyy');

    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: SingleChildScrollView(
        child: Container(
          constraints: const BoxConstraints(maxWidth: 500),
          padding: const EdgeInsets.all(24),
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Header with close button
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: Colors.blue[50],
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Icon(Icons.calendar_today, color: Colors.blue[700], size: 24),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(_dialogTitle, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                    ),
                    IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.of(context).pop()),
                  ],
                ),
                const SizedBox(height: 12),

                // Workspace/Channel selector
                InkWell(
                  onTap: _showWorkspaceChannelPicker,
                  borderRadius: BorderRadius.circular(8),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    decoration: BoxDecoration(
                      color: Colors.grey[50],
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.grey[300]!),
                    ),
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(4),
                          decoration: BoxDecoration(
                            color: _getWorkspaceColor(_selectedWorkspace.color),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: const Icon(Icons.workspaces, color: Colors.white, size: 14),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            '${_selectedWorkspace.name} > #${_selectedThread.name}',
                            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: Colors.blue[50],
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(
                            'Change',
                            style: TextStyle(fontSize: 12, color: Colors.blue[700], fontWeight: FontWeight.w500),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                if (_error != null) ...[
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.red[50],
                      border: Border.all(color: Colors.red[200]!),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.error_outline, color: Colors.red[700], size: 20),
                        const SizedBox(width: 8),
                        Expanded(child: Text(_error!, style: TextStyle(color: Colors.red[700], fontSize: 13))),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                ],
                TextFormField(
                  controller: _titleController,
                  decoration: const InputDecoration(
                    labelText: 'Task Title *',
                    hintText: 'What needs to be done?',
                    border: OutlineInputBorder(),
                  ),
                  autofocus: true,
                  validator: (value) => (value == null || value.trim().isEmpty) ? 'Task title is required' : null,
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _locationController,
                  decoration: const InputDecoration(
                    labelText: 'Location',
                    hintText: 'Conference Room A...',
                    border: OutlineInputBorder(),
                    prefixIcon: Icon(Icons.location_on, size: 20),
                  ),
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _tagsController,
                  decoration: const InputDecoration(
                    labelText: 'Tags',
                    hintText: 'meeting, urgent (comma-separated)',
                    border: OutlineInputBorder(),
                    prefixIcon: Icon(Icons.label, size: 20),
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: InkWell(
                        onTap: () => _selectDate(context, true),
                        child: InputDecorator(
                          decoration: const InputDecoration(
                            labelText: 'Start Date',
                            border: OutlineInputBorder(),
                            suffixIcon: Icon(Icons.calendar_today, size: 20),
                          ),
                          child: Text(
                            _startDate != null ? dateFormat.format(_startDate!) : 'Select date',
                            style: TextStyle(color: _startDate != null ? Colors.black : Colors.grey[600]),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: InkWell(
                        onTap: () => _selectDate(context, false),
                        child: InputDecorator(
                          decoration: const InputDecoration(
                            labelText: 'End/Due Date',
                            border: OutlineInputBorder(),
                            suffixIcon: Icon(Icons.calendar_today, size: 20),
                          ),
                          child: Text(
                            _endDueDate != null ? dateFormat.format(_endDueDate!) : 'Select date',
                            style: TextStyle(color: _endDueDate != null ? Colors.black : Colors.grey[600]),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: InkWell(
                        onTap: () => _selectTime(context, true),
                        child: InputDecorator(
                          decoration: const InputDecoration(
                            labelText: 'Start Time',
                            border: OutlineInputBorder(),
                            suffixIcon: Icon(Icons.access_time, size: 20),
                          ),
                          child: Text(
                            _startTime != null ? _startTime!.format(context) : 'Optional',
                            style: TextStyle(color: _startTime != null ? Colors.black : Colors.grey[600]),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: InkWell(
                        onTap: () => _selectTime(context, false),
                        child: InputDecorator(
                          decoration: const InputDecoration(
                            labelText: 'End Time',
                            border: OutlineInputBorder(),
                            suffixIcon: Icon(Icons.access_time, size: 20),
                          ),
                          child: Text(
                            _endTime != null ? _endTime!.format(context) : 'Optional',
                            style: TextStyle(color: _endTime != null ? Colors.black : Colors.grey[600]),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                DropdownButtonFormField<String>(
                  value: _priority,
                  decoration: const InputDecoration(labelText: 'Priority', border: OutlineInputBorder()),
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

                // Assignment Section
                const SizedBox(height: 20),
                _buildAssignmentSection(),

                // Completion Type Selector (only when multiple assignees)
                if (_showCompletionTypeSelector) ...[
                  const SizedBox(height: 16),
                  _buildCompletionTypeSelector(),
                ],

                const SizedBox(height: 24),
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    TextButton(
                      onPressed: _isLoading ? null : () => Navigator.of(context).pop(),
                      child: const Text('Cancel'),
                    ),
                    const SizedBox(width: 12),
                    ElevatedButton.icon(
                      onPressed: _isLoading ? null : _createTask,
                      icon: _isLoading
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2, valueColor: AlwaysStoppedAnimation<Color>(Colors.white)),
                            )
                          : const Icon(Icons.add_task, size: 18),
                      label: Text(_isLoading ? 'Creating...' : _dialogTitle),
                      style: ElevatedButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12)),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildAssignmentSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(Icons.person_add, size: 18, color: Colors.grey[700]),
            const SizedBox(width: 8),
            Text(
              'Assign to',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: Colors.grey[700],
              ),
            ),
            if (_loadingMembers) ...[
              const SizedBox(width: 8),
              const SizedBox(
                width: 14,
                height: 14,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            ],
          ],
        ),
        const SizedBox(height: 12),

        // Members section
        if (_workspaceMembers.isNotEmpty) ...[
          Text(
            'Members',
            style: TextStyle(fontSize: 12, color: Colors.grey[600], fontWeight: FontWeight.w500),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _workspaceMembers.map((member) {
              final userId = member['user_id']?.toString() ?? member['id']?.toString() ?? '';
              final displayName = member['display_name'] ?? member['email'] ?? 'Unknown';
              final isSelected = _selectedAssignees.contains(userId);

              return GestureDetector(
                onTap: () => _toggleAssignee(userId),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: isSelected ? Colors.blue[100] : Colors.grey[100],
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: isSelected ? Colors.blue[400]! : Colors.grey[300]!,
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      CircleAvatar(
                        radius: 12,
                        backgroundColor: isSelected ? Colors.blue[700] : Colors.grey[400],
                        child: Text(
                          displayName.isNotEmpty ? displayName[0].toUpperCase() : '?',
                          style: const TextStyle(fontSize: 11, color: Colors.white, fontWeight: FontWeight.bold),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        displayName,
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                          color: isSelected ? Colors.blue[800] : Colors.grey[700],
                        ),
                      ),
                      if (isSelected) ...[
                        const SizedBox(width: 4),
                        Icon(Icons.check, size: 16, color: Colors.blue[700]),
                      ],
                    ],
                  ),
                ),
              );
            }).toList(),
          ),
        ],

        // Teams section
        if (_workspaceTeams.isNotEmpty) ...[
          const SizedBox(height: 16),
          Text(
            'Teams',
            style: TextStyle(fontSize: 12, color: Colors.grey[600], fontWeight: FontWeight.w500),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _workspaceTeams.map((team) {
              final teamId = team['id'] as int? ?? 0;
              final teamName = team['name']?.toString() ?? 'Unknown Team';
              final isSelected = _selectedTeams.contains(teamId);

              return GestureDetector(
                onTap: () => _toggleTeam(teamId),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: isSelected ? Colors.purple[100] : Colors.grey[100],
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: isSelected ? Colors.purple[400]! : Colors.grey[300]!,
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.group,
                        size: 16,
                        color: isSelected ? Colors.purple[700] : Colors.grey[500],
                      ),
                      const SizedBox(width: 8),
                      Text(
                        teamName,
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                          color: isSelected ? Colors.purple[800] : Colors.grey[700],
                        ),
                      ),
                      if (isSelected) ...[
                        const SizedBox(width: 4),
                        Icon(Icons.check, size: 16, color: Colors.purple[700]),
                      ],
                    ],
                  ),
                ),
              );
            }).toList(),
          ),
        ],

        // No members/teams message
        if (_workspaceMembers.isEmpty && _workspaceTeams.isEmpty && !_loadingMembers) ...[
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.grey[50],
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              children: [
                Icon(Icons.info_outline, size: 16, color: Colors.grey[500]),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'No members or teams available in this workspace',
                    style: TextStyle(fontSize: 13, color: Colors.grey[600]),
                  ),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildCompletionTypeSelector() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.orange[50],
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.orange[200]!),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.how_to_reg, size: 18, color: Colors.orange[700]),
              const SizedBox(width: 8),
              Text(
                'Completion Type',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: Colors.orange[800],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          _buildCompletionTypeOption(
            'collaborative',
            'Anyone can complete',
            'Task is done when any assignee marks it complete',
            Icons.person_outline,
          ),
          const SizedBox(height: 8),
          _buildCompletionTypeOption(
            'individual_response',
            'Everyone must complete',
            'Each assignee must mark it done individually',
            Icons.groups,
          ),
        ],
      ),
    );
  }

  Widget _buildCompletionTypeOption(
    String value,
    String title,
    String description,
    IconData icon,
  ) {
    final isSelected = _assignmentMode == value;
    return GestureDetector(
      onTap: () => setState(() => _assignmentMode = value),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: isSelected ? Colors.white : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: isSelected ? Colors.orange[400]! : Colors.transparent,
            width: isSelected ? 2 : 1,
          ),
        ),
        child: Row(
          children: [
            Container(
              width: 20,
              height: 20,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: isSelected ? Colors.orange[600]! : Colors.grey[400]!,
                  width: 2,
                ),
                color: isSelected ? Colors.orange[600] : Colors.transparent,
              ),
              child: isSelected
                  ? const Icon(Icons.check, size: 14, color: Colors.white)
                  : null,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: isSelected ? Colors.orange[800] : Colors.grey[700],
                    ),
                  ),
                  Text(
                    description,
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.grey[600],
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
}
