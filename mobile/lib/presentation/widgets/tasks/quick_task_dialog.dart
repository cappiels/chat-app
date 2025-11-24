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

  Future<void> _loadWorkspaceData() async {
    setState(() => _loadingMembers = true);
    
    try {
      final response = await _workspaceService.getWorkspace(widget.workspace.id);
      setState(() {
        _workspaceMembers = response.members;
        _workspaceTeams = response.teams;
        _loadingMembers = false;
      });
    } catch (e) {
      print('Error loading workspace data: $e');
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
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(_dialogTitle, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                          Text('# ${widget.thread.name}', style: TextStyle(fontSize: 14, color: Colors.grey[600])),
                        ],
                      ),
                    ),
                    IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.of(context).pop()),
                  ],
                ),
                const SizedBox(height: 24),
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
}
