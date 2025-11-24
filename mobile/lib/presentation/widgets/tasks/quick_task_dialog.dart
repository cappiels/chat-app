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
  
  // 🚀 NEW: Assignment functionality  
  List<String> _selectedAssignees = [];
  List<int> _selectedTeams = [];
  String _assignmentMode = 'collaborative';
  List<Map<String, dynamic>> _workspaceMembers = [];
  List<Map<String, dynamic>> _workspaceTeams = [];
  bool _showAssignmentSection = true;

  @override
  void initState() {
    super.initState();
    _loadWorkspaceData();
  }

  @override
  void dispose() {
    _titleController.dispose();
    _locationController.dispose();
    _tagsController.dispose();
    super.dispose();
  }

  // 🚀 NEW: Load workspace members and teams
  Future<void> _loadWorkspaceData() async {
    setState(() => _loadingMembers = true);
    
    try {
      final response = await _workspaceService.getWorkspace(widget.workspace.id);
      
      setState(() {
        // Access members and teams from the workspace response
        _workspaceMembers = response.members;
        _workspaceTeams = response.teams;
        _loadingMembers = false;
      });
    } catch (e) {
      print('Error loading workspace data: $e');
      // Fallback to workspace passed in props if API fails
      setState(() {
        _workspaceMembers = widget.workspace.members;
        _workspaceTeams = widget.workspace.teams;
        _loadingMembers = false;
      });
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

  // Smart title based on whether times are selected
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

    // Validate times - must have both or neither
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
      // Smart logic based on user input (matching React app)
      String? startDateStr;
      String? endDateStr;
      String? dueDateStr;
      String? startTimeStr;
      String? endTimeStr;
      bool isAllDay = false;

      if (_startTime != null && _endTime != null) {
        // Has times - timed event
        startDateStr = _startDate != null
            ? DateFormat('yyyy-MM-dd').format(_startDate!)
            : null;
        endDateStr = _endDueDate != null
            ? DateFormat('yyyy-MM-dd').format(_endDueDate!)
            : null;
        dueDateStr = endDateStr;
        startTimeStr = '${_startTime!.hour.toString().padLeft(2, '0')}:${_startTime!.minute.toString().padLeft(2, '0')}';
        endTimeStr = '${_endTime!.hour.toString().padLeft(2, '0')}:${_endTime!.minute.toString().padLeft(2, '0')}';
        isAllDay = false;
      } else if (_endDueDate != null && _startDate == null) {
        // Has due date but no start date - all day task
        startDateStr = DateFormat('yyyy-MM-dd').format(_endDueDate!);
        endDateStr = DateFormat('yyyy-MM-dd').format(_endDueDate!);
        dueDateStr = DateFormat('yyyy-MM-dd').format(_endDueDate!);
        isAllDay = true;
      } else if (_startDate != null && _endDueDate != null) {
        // Has both start and end dates - all day event
        startDateStr = DateFormat('yyyy-MM-dd').format(_startDate!);
        endDateStr = DateFormat('yyyy-MM-dd').format(_endDueDate!);
        dueDateStr = DateFormat('yyyy-MM-dd').format(_endDueDate!);
        isAllDay = true;
      } else if (_startDate != null) {
        // Has only start date - single day all day
        startDateStr = DateFormat('yyyy-MM-dd').format(_startDate!);
        endDateStr = DateFormat('yyyy-MM-dd').format(_startDate!);
        dueDateStr = DateFormat('yyyy-MM-dd').format(_startDate!);
        isAllDay = true;
      }
      // else: No dates - just a task with no scheduling

      final tags = _parseTags(_tagsController.text);
      final location = _locationController.text.trim();

      await _taskService.createTask(
        workspaceId: widget.workspace.id,
        threadId: widget.thread.id,
        title: _titleController.text.trim(),
        startDate: startDateStr,
        endDate: endDateStr,
        dueDate: dueDateStr,
        startTime: startTimeStr,
        endTime: endTimeStr,
        isAllDay: isAllDay,
        priority: _priority,
        tags: tags.isNotEmpty ? tags : null,
        // 🚀 NEW: Multi-assignee support
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

        if (widget.onTaskCreated != null) {
          widget.onTaskCreated!();
        }
      }
    } catch (e) {
      setState(() {
        _error = 'Failed to create task: ${e.toString()}';
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final dateFormat = DateFormat('MMM d, yyyy');
    
    return Dialog(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
      ),
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
                // Header
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: Colors.blue[50],
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Icon(
                        Icons.calendar_today,
                        color: Colors.blue[700],
                        size: 24,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _dialogTitle,
                            style: const TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          Text(
                            '# ${widget.thread.name}',
                            style: TextStyle(
                              fontSize: 14,
                              color: Colors.grey[600],
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close),
                      onPressed: () => Navigator.of(context).pop(),
                    ),
                  ],
                ),
                const SizedBox(height: 24),

                // Error message
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
                        Expanded(
                          child: Text(
                            _error!,
                            style: TextStyle(
                              color: Colors.red[700],
                              fontSize: 13,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                ],

                // Task Title
                TextFormField(
                  controller: _titleController,
                  decoration: const InputDecoration(
                    labelText: 'Task Title *',
                    hintText: 'What needs to be done?',
                    border: OutlineInputBorder(),
                  ),
                  autofocus: true,
                  validator: (value) {
                    if (value == null || value.trim().isEmpty) {
                      return 'Task title is required';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 16),

                // Location
                TextFormField(
                  controller: _locationController,
                  decoration: InputDecoration(
                    labelText: 'Location',
                    hintText: 'Conference Room A, Home Office...',
                    border: const OutlineInputBorder(),
                    prefixIcon: const Icon(Icons.location_on, size: 20),
                  ),
                ),
                const SizedBox(height: 16),

                // Tags
                TextFormField(
                  controller: _tagsController,
                  decoration: InputDecoration(
                    labelText: 'Tags',
                    hintText: 'meeting, urgent, development (comma-separated)',
                    border: const OutlineInputBorder(),
                    prefixIcon: const Icon(Icons.label, size: 20),
                  ),
                ),
                const SizedBox(height: 16),

                // 🚀 NEW: Assignment Section
                Container(
                  decoration: BoxDecoration(
                    border: Border.all(color: Colors.grey[300]!),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      InkWell(
                        onTap: () {
                          setState(() {
                            _showAssignmentSection = !_showAssignmentSection;
                          });
                        },
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Row(
                            children: [
                              Icon(Icons.people, size: 20, color: Colors.blue[700]),
                              const SizedBox(width: 8),
                              const Text(
                                'Assign To',
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 14,
                                ),
                              ),
                              if (_selectedAssignees.isNotEmpty || _selectedTeams.isNotEmpty) ...[
                                const SizedBox(width: 8),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: Colors.blue[50],
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: Text(
                                    '${_selectedAssignees.length + _selectedTeams.length} selected',
                                    style: TextStyle(
                                      fontSize: 11,
                                      color: Colors.blue[700],
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ),
                              ],
                              const Spacer(),
                              Icon(
                                _showAssignmentSection ? Icons.expand_less : Icons.expand_more,
                                color: Colors.grey[600],
                              ),
                            ],
                          ),
                        ),
                      ),
                      if (_showAssignmentSection) ...[
                        const Divider(height: 1),
                        Padding(
                          padding: const EdgeInsets.all(12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              // Assignment Mode Toggle
                              const Text(
                                'Assignment Mode',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: Colors.grey,
                                ),
                              ),
                              const SizedBox(height: 8),
                              Row(
                                children: [
                                  Expanded(
                                    child: InkWell(
                                      onTap: () {
                                        setState(() {
                                          _assignmentMode = 'collaborative';
                                        });
                                      },
                                      child: Container(
                                        padding: const EdgeInsets.all(10),
                                        decoration: BoxDecoration(
                                          color: _assignmentMode == 'collaborative'
                                              ? Colors.blue[100]
                                              : Colors.grey[50],
                                          border: Border.all(
                                            color: _assignmentMode == 'collaborative'
                                                ? Colors.blue[300]!
                                                : Colors.grey[300]!,
                                          ),
                                          borderRadius: BorderRadius.circular(8),
                                        ),
                                        child: Column(
                                          children: [
                                            Text(
                                              'Collaborative',
                                              style: TextStyle(
                                                fontSize: 11,
                                                fontWeight: FontWeight.bold,
                                                color: _assignmentMode == 'collaborative'
                                                    ? Colors.blue[700]
                                                    : Colors.grey[700],
                                              ),
                                            ),
                                            const SizedBox(height: 2),
                                            Text(
                                              'Anyone can complete',
                                              style: TextStyle(
                                                fontSize: 9,
                                                color: _assignmentMode == 'collaborative'
                                                    ? Colors.blue[600]
                                                    : Colors.grey[600],
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: InkWell(
                                      onTap: () {
                                        setState(() {
                                          _assignmentMode = 'individual_response';
                                        });
                                      },
                                      child: Container(
                                        padding: const EdgeInsets.all(10),
                                        decoration: BoxDecoration(
                                          color: _assignmentMode == 'individual_response'
                                              ? Colors.blue[100]
                                              : Colors.grey[50],
                                          border: Border.all(
                                            color: _assignmentMode == 'individual_response'
                                                ? Colors.blue[300]!
                                                : Colors.grey[300]!,
                                          ),
                                          borderRadius: BorderRadius.circular(8),
                                        ),
                                        child: Column(
                                          children: [
                                            Text(
                                              'Individual',
                                              style: TextStyle(
                                                fontSize: 11,
                                                fontWeight: FontWeight.bold,
                                                color: _assignmentMode == 'individual_response'
                                                    ? Colors.blue[700]
                                                    : Colors.grey[700],
                                              ),
                                            ),
                                            const SizedBox(height: 2),
                                            Text(
                                              'Each must complete',
                                              style: TextStyle(
                                                fontSize: 9,
                                                color: _assignmentMode == 'individual_response'
                                                    ? Colors.blue[600]
                                                    : Colors.grey[600],
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 16),

                              // Members Selection
                              if (_loadingMembers)
                                const Center(
                                  child: Padding(
                                    padding: EdgeInsets.all(16),
                                    child: CircularProgressIndicator(),
                                  ),
                                )
                              else ...[
                                Text(
                                  'Team Members (${_selectedAssignees.length} selected)',
                                  style: const TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                    color: Colors.grey,
                                  ),
                                ),
                                const SizedBox(height: 8),
                                Container(
                                  constraints: const BoxConstraints(maxHeight: 150),
                                  decoration: BoxDecoration(
                                    border: Border.all(color: Colors.grey[300]!),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: _workspaceMembers.isEmpty
                                      ? const Padding(
                                          padding: EdgeInsets.all(16),
                                          child: Text(
                                            'No members found',
                                            style: TextStyle(
                                              fontSize: 12,
                                              color: Colors.grey,
                                            ),
                                            textAlign: TextAlign.center,
                                          ),
                                        )
                                      : ListView.builder(
                                          shrinkWrap: true,
                                          itemCount: _workspaceMembers.length,
                                          itemBuilder: (context, index) {
                                            final member = _workspaceMembers[index];
                                            final memberId = member['id'] as String;
                                            final isSelected = _selectedAssignees.contains(memberId);
                                            
                                            return InkWell(
                                              onTap: () => _toggleAssignee(memberId),
                                              child: Container(
                                                padding: const EdgeInsets.symmetric(
                                                  horizontal: 12,
                                                  vertical: 8,
                                                ),
                                                decoration: BoxDecoration(
                                                  color: isSelected ? Colors.blue[50] : null,
                                                  border: Border(
                                                    bottom: BorderSide(
                                                      color: Colors.grey[200]!,
                                                      width: index < _workspaceMembers.length - 1 ? 1 : 0,
                                                    ),
                                                  ),
                                                ),
                                                child: Row(
                                                  children: [
                                                    Container(
                                                      width: 18,
                                                      height: 18,
                                                      decoration: BoxDecoration(
                                                        color: isSelected ? Colors.blue[600] : Colors.transparent,
                                                        border: Border.all(
                                                          color: isSelected ? Colors.blue[600]! : Colors.grey[400]!,
                                                          width: 2,
                                                        ),
                                                        borderRadius: BorderRadius.circular(4),
                                                      ),
                                                      child: isSelected
                                                          ? const Icon(Icons.check, size: 12, color: Colors.white)
                                                          : null,
                                                    ),
                                                    const SizedBox(width: 8),
                                                    CircleAvatar(
                                                      radius: 14,
                                                      backgroundColor: Colors.grey[300],
                                                      child: Text(
                                                        (member['display_name'] as String?)?.substring(0, 1).toUpperCase() ?? 'U',
                                                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                                                      ),
                                                    ),
                                                    const SizedBox(width: 8),
                                                    Expanded(
                                                      child: Column(
                                                        crossAxisAlignment: CrossAxisAlignment.start,
                                                        children: [
                                                          Text(
                                                            member['display_name'] as String? ?? 'User',
                                                            style: const TextStyle(
                                                              fontSize: 13,
                                                              fontWeight: FontWeight.w500,
                                                            ),
                                                            overflow: TextOverflow.ellipsis,
                                                          ),
                                                          Text(
                                                            member['email'] as String? ?? '',
                                                            style: TextStyle(
                                                              fontSize: 11,
                                                              color: Colors.grey[600],
                                                            ),
                                                            overflow: TextOverflow.ellipsis,
                                                          ),
                                                        ],
                                                      ),
                                                    ),
                                                  ],
                                                ),
                                              ),
                                            );
                                          },
                                        ),
                                ),
                                
                                // Teams Selection
                                if (_workspaceTeams.isNotEmpty) ...[
                                  const SizedBox(height: 12),
                                  Text(
                                    'Teams (${_selectedTeams.length} selected)',
                                    style: const TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w600,
                                      color: Colors.grey,
                                    ),
                                  ),
                                  const SizedBox(height: 8),
                                  Container(
                                    constraints: const BoxConstraints(maxHeight: 120),
                                    decoration: BoxDecoration(
                                      border: Border.all(color: Colors.grey[300]!),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: ListView.builder(
                                      shrinkWrap: true,
                                      itemCount: _workspaceTeams.length,
                                      itemBuilder: (context, index) {
                                        final team = _workspaceTeams[index];
                                        final teamId = team['id'] as int;
                                        final isSelected = _selectedTeams.contains(teamId);
                                        
                                        return InkWell(
                                          onTap: () => _toggleTeam(teamId),
                                          child: Container(
                                            padding: const EdgeInsets.symmetric(
                                              horizontal: 12,
                                              vertical: 8,
                                            ),
                                            decoration: BoxDecoration(
                                              color: isSelected ? Colors.purple[50] : null,
                                              border: Border(
                                                bottom: BorderSide(
                                                  color: Colors.grey[200]!,
                                                  width: index < _workspaceTeams.length - 1 ? 1 : 0,
                                                ),
                                              ),
                                            ),
                                            child: Row(
                                              children: [
                                                Container(
                                                  width: 18,
                                                  height: 18,
                                                  decoration: BoxDecoration(
                                                    color: isSelected ? Colors.purple[600] : Colors.transparent,
                                                    border: Border.all(
                                                      color: isSelected ? Colors.purple[600]! : Colors.grey[400]!,
                                                      width: 2,
                                                    ),
                                                    borderRadius: BorderRadius.circular(4),
                                                  ),
                                                  child: isSelected
                                                      ? const Icon(Icons.check, size: 12, color: Colors.white)
                                                      : null,
                                                ),
                                                const SizedBox(width: 8),
                                                Container(
                                                  width: 28,
                                                  height: 28,
                                                  decoration: BoxDecoration(
                                                    color: Colors.indigo,
                                                    borderRadius: BorderRadius.circular(4),
                                                  ),
                                                  child: Center(
                                                    child: Text(
                                                      (team['display_name'] as String?)?.substring(0, 1).toUpperCase() ?? 'T',
                                                      style: const TextStyle(
                                                        color: Colors.white,
                                                        fontWeight: FontWeight.bold,
                                                        fontSize: 12,
                                                      ),
                                                    ),
                                                  ),
                                                ),
                                                const SizedBox(width: 8),
                                                Expanded(
                                                  child: Column(
                                                    crossAxisAlignment: CrossAxisAlignment.start,
                                                    children: [
                                                      Text(
                                                        team['display_name'] as String? ?? 'Team',
                                                        style: const TextStyle(
                                                          fontSize: 13,
                                                          fontWeight: FontWeight.w500,
                                                        ),
                                                        overflow: TextOverflow.ellipsis,
                                                      ),
                                                      Text(
                                                        '${team['member_count'] ?? 0} members',
                                                        style: TextStyle(
                                                          fontSize: 11,
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
                                      },
                                    ),
                                  ),
                                ],

                                // Assignment Summary
                                if (_selectedAssignees.isNotEmpty || _selectedTeams.isNotEmpty) ...[
                                  const SizedBox(height: 12),
                                  Container(
                                    padding: const EdgeInsets.all(8),
                                    decoration: BoxDecoration(
                                      color: Colors.blue[50],
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: Text(
                                      _assignmentMode == 'collaborative'
                                          ? 'Any assignee can complete this task'
                                          : 'All ${_selectedAssignees.length + _selectedTeams.length} assignee(s) must complete individually',
                                      style: TextStyle(
                                        fontSize: 11,
                                        color: Colors.blue[900],
                                      ),
                                    ),
                                  ),
                                ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                // Date Row
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
                            _startDate != null
                                ? dateFormat.format(_startDate!)
                                : 'Select date',
                            style: TextStyle(
                              color: _startDate != null
                                  ? Colors.black
                                  : Colors.grey[600],
                            ),
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
                            _endDueDate != null
                                ? dateFormat.format(_endDueDate!)
                                : 'Select date',
                            style: TextStyle(
                              color: _endDueDate != null
                                  ? Colors.black
                                  : Colors.grey[600],
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),

                // Time Row
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
                            _startTime != null
                                ? _startTime!.format(context)
                                : 'Optional',
                            style: TextStyle(
                              color: _startTime != null
                                  ? Colors.black
                                  : Colors.grey[600],
                            ),
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
                            _endTime != null
                                ? _endTime!.format(context)
                                : 'Optional',
                            style: TextStyle(
                              color: _endTime != null
                                  ? Colors.black
                                  : Colors.grey[600],
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),

                // Priority
                DropdownButtonFormField<String>(
                  value: _priority,
                  decoration: const InputDecoration(
                    labelText: 'Priority',
                    border: OutlineInputBorder(),
                  ),
                  items: const [
                    DropdownMenuItem(value: 'low', child: Text('Low')),
                    DropdownMenuItem(value: 'medium', child: Text('Medium')),
                    DropdownMenuItem(value: 'high', child: Text('High')),
                    DropdownMenuItem(value: 'urgent', child: Text('Urgent')),
                  ],
                  onChanged: (value) {
                    if (value != null) {
                      setState(() {
                        _priority = value;
                      });
                    }
                  },
                ),
                const SizedBox(height: 16),

                // Smart Tips
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.grey[50],
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(Icons.lightbulb_outline, size: 16, color: Colors.grey[700]),
                          const SizedBox(width: 6),
                          Text(
                            'Smart Tips:',
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 12,
                              color: Colors.grey[700],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text(
                        '• Add times for scheduled events\n'
                        '• Leave times empty for all-day tasks\n'
                        '• Tasks with no dates won\'t appear on calendar',
                        style: TextStyle(
                          fontSize: 11,
                          color: Colors.grey[600],
                          height: 1.5,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),

                // Actions
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    TextButton(
                      onPressed: _isLoading
                          ? null
                          : () => Navigator.of(context).pop(),
                      child: const Text('Cancel'),
                    ),
                    const SizedBox(width: 12),
                    ElevatedButton.icon(
                      onPressed: _isLoading ? null : _createTask,
                      icon: _isLoading
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                              ),
                            )
                          : const Icon(Icons.add_task, size: 18),
                      label: Text(_isLoading ? 'Creating...' : _dialogTitle),
                      style: ElevatedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 24,
                          vertical: 12,
                        ),
                      ),
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
}
