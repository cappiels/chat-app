import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../data/models/task.dart';
import '../../../data/models/thread.dart';
import '../../../data/models/workspace.dart';
import '../../../data/services/task_service.dart';

class WeeklyEventDialog extends StatefulWidget {
  final ChannelTask? task;
  final Thread thread;
  final Workspace workspace;
  final DateTime? initialStartTime;
  final DateTime? initialEndTime;
  final VoidCallback? onTaskCreated;
  final VoidCallback? onTaskUpdated;
  final VoidCallback? onTaskDeleted;

  const WeeklyEventDialog({
    Key? key,
    this.task,
    required this.thread,
    required this.workspace,
    this.initialStartTime,
    this.initialEndTime,
    this.onTaskCreated,
    this.onTaskUpdated,
    this.onTaskDeleted,
  }) : super(key: key);

  @override
  State<WeeklyEventDialog> createState() => _WeeklyEventDialogState();
}

class _WeeklyEventDialogState extends State<WeeklyEventDialog> {
  final _formKey = GlobalKey<FormState>();
  final _taskService = TaskService();
  
  late TextEditingController _titleController;
  late TextEditingController _descriptionController;
  
  DateTime? _startDate;
  DateTime? _endDate;
  TimeOfDay? _startTime;
  TimeOfDay? _endTime;
  bool _isAllDay = false;
  String _priority = 'medium';
  String _status = 'pending';
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _titleController = TextEditingController(text: widget.task?.title ?? '');
    _descriptionController = TextEditingController(text: widget.task?.description ?? '');
    
    if (widget.task != null) {
      _startDate = widget.task!.startDate;
      _endDate = widget.task!.endDate;
      _isAllDay = widget.task!.isAllDay;
      _priority = widget.task!.priority;
      _status = widget.task!.status;
      
      if (_startDate != null && !_isAllDay) {
        _startTime = TimeOfDay.fromDateTime(_startDate!);
      }
      if (_endDate != null && !_isAllDay) {
        _endTime = TimeOfDay.fromDateTime(_endDate!);
      }
    } else if (widget.initialStartTime != null) {
      _startDate = widget.initialStartTime;
      _endDate = widget.initialEndTime ?? widget.initialStartTime!.add(const Duration(hours: 1));
      _startTime = TimeOfDay.fromDateTime(widget.initialStartTime!);
      _endTime = TimeOfDay.fromDateTime(_endDate!);
    } else {
      _startDate = DateTime.now();
      _endDate = DateTime.now().add(const Duration(hours: 1));
      _startTime = TimeOfDay.now();
      _endTime = TimeOfDay(hour: TimeOfDay.now().hour + 1, minute: TimeOfDay.now().minute);
    }
  }

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _selectDate(BuildContext context, bool isStart) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: isStart ? (_startDate ?? DateTime.now()) : (_endDate ?? _startDate ?? DateTime.now()),
      firstDate: DateTime(2020),
      lastDate: DateTime(2030),
    );
    
    if (picked != null) {
      setState(() {
        if (isStart) {
          _startDate = picked;
          if (_endDate == null || _endDate!.isBefore(picked)) {
            _endDate = picked;
          }
        } else {
          _endDate = picked;
        }
      });
    }
  }

  Future<void> _selectTime(BuildContext context, bool isStart) async {
    final picked = await showTimePicker(
      context: context,
      initialTime: isStart ? (_startTime ?? TimeOfDay.now()) : (_endTime ?? TimeOfDay.now()),
    );
    
    if (picked != null) {
      setState(() {
        if (isStart) {
          _startTime = picked;
        } else {
          _endTime = picked;
        }
      });
    }
  }

  DateTime _combineDateAndTime(DateTime date, TimeOfDay? time) {
    if (time == null) return date;
    return DateTime(date.year, date.month, date.day, time.hour, time.minute);
  }

  Future<void> _saveTask() async {
    if (!_formKey.currentState!.validate()) return;
    
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final taskData = {
        'title': _titleController.text.trim(),
        'description': _descriptionController.text.trim().isEmpty ? null : _descriptionController.text.trim(),
        'start_date': DateFormat('yyyy-MM-dd').format(_startDate!),
        'end_date': _endDate != null ? DateFormat('yyyy-MM-dd').format(_endDate!) : null,
        'is_all_day': _isAllDay,
        'priority': _priority,
        'status': _status,
      };

      if (!_isAllDay && _startTime != null) {
        taskData['start_time'] = '${_startTime!.hour.toString().padLeft(2, '0')}:${_startTime!.minute.toString().padLeft(2, '0')}';
      }
      if (!_isAllDay && _endTime != null) {
        taskData['end_time'] = '${_endTime!.hour.toString().padLeft(2, '0')}:${_endTime!.minute.toString().padLeft(2, '0')}';
      }

      if (widget.task != null) {
        // Update existing task
        await _taskService.updateTask(
          workspaceId: widget.workspace.id,
          threadId: widget.thread.id,
          taskId: widget.task!.id,
          updates: taskData,
        );
        widget.onTaskUpdated?.call();
      } else {
        // Create new task
        await _taskService.createTask(
          workspaceId: widget.workspace.id,
          threadId: widget.thread.id,
          taskData: taskData,
        );
        widget.onTaskCreated?.call();
      }
      
      if (mounted) {
        Navigator.of(context).pop();
      }
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _deleteTask() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Task'),
        content: const Text('Are you sure you want to delete this task?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('Delete'),
          ),
        ],
      ),
    );

    if (confirmed == true && widget.task != null) {
      setState(() {
        _loading = true;
        _error = null;
      });

      try {
        await _taskService.deleteTask(
          workspaceId: widget.workspace.id,
          threadId: widget.thread.id,
          taskId: widget.task!.id,
        );
        widget.onTaskDeleted?.call();
        
        if (mounted) {
          Navigator.of(context).pop();
        }
      } catch (e) {
        setState(() {
          _error = e.toString();
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      child: Container(
        width: MediaQuery.of(context).size.width * 0.9,
        constraints: const BoxConstraints(maxWidth: 600),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Header
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.blue.shade600,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(4)),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      widget.task != null ? 'Edit Event' : 'New Event',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, color: Colors.white),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ],
              ),
            ),
            
            // Content
            Flexible(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Error message
                      if (_error != null)
                        Container(
                          padding: const EdgeInsets.all(12),
                          margin: const EdgeInsets.only(bottom: 16),
                          decoration: BoxDecoration(
                            color: Colors.red.shade50,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Row(
                            children: [
                              Icon(Icons.error_outline, color: Colors.red.shade700),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Text(
                                  _error!,
                                  style: TextStyle(color: Colors.red.shade700),
                                ),
                              ),
                            ],
                          ),
                        ),
                      
                      // Title
                      TextFormField(
                        controller: _titleController,
                        decoration: const InputDecoration(
                          labelText: 'Title',
                          border: OutlineInputBorder(),
                        ),
                        validator: (value) {
                          if (value == null || value.trim().isEmpty) {
                            return 'Please enter a title';
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: 16),
                      
                      // Description
                      TextFormField(
                        controller: _descriptionController,
                        decoration: const InputDecoration(
                          labelText: 'Description (optional)',
                          border: OutlineInputBorder(),
                        ),
                        maxLines: 3,
                      ),
                      const SizedBox(height: 16),
                      
                      // All-day toggle
                      CheckboxListTile(
                        title: const Text('All-day event'),
                        value: _isAllDay,
                        onChanged: (value) {
                          setState(() {
                            _isAllDay = value ?? false;
                          });
                        },
                        contentPadding: EdgeInsets.zero,
                      ),
                      const SizedBox(height: 16),
                      
                      // Start date/time
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: () => _selectDate(context, true),
                              icon: const Icon(Icons.calendar_today),
                              label: Text(
                                _startDate != null
                                    ? DateFormat('MMM d, yyyy').format(_startDate!)
                                    : 'Start Date',
                              ),
                            ),
                          ),
                          if (!_isAllDay) ...[
                            const SizedBox(width: 8),
                            Expanded(
                              child: OutlinedButton.icon(
                                onPressed: () => _selectTime(context, true),
                                icon: const Icon(Icons.access_time),
                                label: Text(
                                  _startTime != null
                                      ? _startTime!.format(context)
                                      : 'Start Time',
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 12),
                      
                      // End date/time
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: () => _selectDate(context, false),
                              icon: const Icon(Icons.calendar_today),
                              label: Text(
                                _endDate != null
                                    ? DateFormat('MMM d, yyyy').format(_endDate!)
                                    : 'End Date',
                              ),
                            ),
                          ),
                          if (!_isAllDay) ...[
                            const SizedBox(width: 8),
                            Expanded(
                              child: OutlinedButton.icon(
                                onPressed: () => _selectTime(context, false),
                                icon: const Icon(Icons.access_time),
                                label: Text(
                                  _endTime != null
                                      ? _endTime!.format(context)
                                      : 'End Time',
                                ),
                              ),
                            ),
                          ],
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
                          setState(() {
                            _priority = value ?? 'medium';
                          });
                        },
                      ),
                      const SizedBox(height: 16),
                      
                      // Status
                      DropdownButtonFormField<String>(
                        value: _status,
                        decoration: const InputDecoration(
                          labelText: 'Status',
                          border: OutlineInputBorder(),
                        ),
                        items: const [
                          DropdownMenuItem(value: 'pending', child: Text('Pending')),
                          DropdownMenuItem(value: 'in_progress', child: Text('In Progress')),
                          DropdownMenuItem(value: 'completed', child: Text('Completed')),
                          DropdownMenuItem(value: 'blocked', child: Text('Blocked')),
                          DropdownMenuItem(value: 'cancelled', child: Text('Cancelled')),
                        ],
                        onChanged: (value) {
                          setState(() {
                            _status = value ?? 'pending';
                          });
                        },
                      ),
                    ],
                  ),
                ),
              ),
            ),
            
            // Actions
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.grey[100],
                borderRadius: const BorderRadius.vertical(bottom: Radius.circular(4)),
              ),
              child: Row(
                children: [
                  if (widget.task != null)
                    TextButton.icon(
                      onPressed: _loading ? null : _deleteTask,
                      icon: const Icon(Icons.delete),
                      label: const Text('Delete'),
                      style: TextButton.styleFrom(foregroundColor: Colors.red),
                    ),
                  const Spacer(),
                  TextButton(
                    onPressed: _loading ? null : () => Navigator.of(context).pop(),
                    child: const Text('Cancel'),
                  ),
                  const SizedBox(width: 8),
                  ElevatedButton(
                    onPressed: _loading ? null : _saveTask,
                    child: _loading
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : Text(widget.task != null ? 'Update' : 'Create'),
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
