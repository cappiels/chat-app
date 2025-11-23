import 'package:dio/dio.dart';
import '../models/task.dart';
import 'http_client.dart';
import 'package:firebase_auth/firebase_auth.dart';

class TaskService {
  final HttpClient _httpClient;
  final FirebaseAuth _auth = FirebaseAuth.instance;

  TaskService() : _httpClient = HttpClient();

  // Get all tasks for a channel
  Future<List<ChannelTask>> getChannelTasks({
    required String workspaceId,
    required String threadId,
    String? status,
    String? assignedTo,
    String? startDate,
    String? endDate,
    int limit = 100,
    int offset = 0,
  }) async {
    try {
      final user = _auth.currentUser;
      if (user == null) {
        throw Exception('User not authenticated');
      }

      final token = await user.getIdToken(true);
      final queryParams = <String, dynamic>{
        'limit': limit,
        'offset': offset,
      };

      if (status != null) queryParams['status'] = status;
      if (assignedTo != null) queryParams['assigned_to'] = assignedTo;
      if (startDate != null) queryParams['start_date'] = startDate;
      if (endDate != null) queryParams['end_date'] = endDate;

      final response = await _httpClient.get(
        '/api/workspaces/$workspaceId/threads/$threadId/tasks',
        queryParameters: queryParams,
        options: Options(
          headers: {
            'Authorization': 'Bearer $token',
          },
        ),
      );

      if (response.data != null && response.data['tasks'] != null) {
        final tasksData = response.data['tasks'] as List;
        return tasksData
            .map((taskJson) => ChannelTask.fromJson(taskJson as Map<String, dynamic>))
            .toList();
      }
      return [];
    } catch (e) {
      print('Error fetching channel tasks: $e');
      rethrow;
    }
  }

  // Get a specific task
  Future<ChannelTask?> getTask({
    required String workspaceId,
    required String threadId,
    required int taskId,
  }) async {
    try {
      final user = _auth.currentUser;
      if (user == null) {
        throw Exception('User not authenticated');
      }

      final token = await user.getIdToken(true);

      final response = await _httpClient.get(
        '/api/workspaces/$workspaceId/threads/$threadId/tasks/$taskId',
        options: Options(
          headers: {
            'Authorization': 'Bearer $token',
          },
        ),
      );

      if (response.data != null) {
        return ChannelTask.fromJson(response.data as Map<String, dynamic>);
      }
      return null;
    } catch (e) {
      print('Error fetching task: $e');
      rethrow;
    }
  }

  // Create a new task
  Future<Map<String, dynamic>> createTask({
    required String workspaceId,
    required String threadId,
    required String title,
    String? description,
    String? startDate,
    String? endDate,
    String? dueDate,
    String? assignedTo,
    List<String>? assignees,
    List<int>? assignedTeams,
    String assignmentMode = 'collaborative',
    bool requiresIndividualResponse = false,
    String status = 'pending',
    String priority = 'medium',
    List<String>? tags,
    double? estimatedHours,
    bool isAllDay = false,
    String? startTime,
    String? endTime,
    int? parentTaskId,
    List<int>? dependencies,
  }) async {
    try {
      final user = _auth.currentUser;
      if (user == null) {
        throw Exception('User not authenticated');
      }

      final token = await user.getIdToken(true);

      final data = {
        'title': title,
        if (description != null) 'description': description,
        if (startDate != null) 'start_date': startDate,
        if (endDate != null) 'end_date': endDate,
        if (dueDate != null) 'due_date': dueDate,
        if (assignedTo != null) 'assigned_to': assignedTo,
        if (assignees != null) 'assignees': assignees,
        if (assignedTeams != null) 'assigned_teams': assignedTeams,
        'assignment_mode': assignmentMode,
        'requires_individual_response': requiresIndividualResponse,
        'status': status,
        'priority': priority,
        if (tags != null) 'tags': tags,
        if (estimatedHours != null) 'estimated_hours': estimatedHours,
        'is_all_day': isAllDay,
        if (startTime != null) 'start_time': startTime,
        if (endTime != null) 'end_time': endTime,
        if (parentTaskId != null) 'parent_task_id': parentTaskId,
        if (dependencies != null) 'dependencies': dependencies,
      };

      final response = await _httpClient.post(
        '/api/workspaces/$workspaceId/threads/$threadId/tasks',
        data: data,
        options: Options(
          headers: {
            'Authorization': 'Bearer $token',
          },
        ),
      );

      return response.data as Map<String, dynamic>;
    } catch (e) {
      print('Error creating task: $e');
      rethrow;
    }
  }

  // Update a task
  Future<Map<String, dynamic>> updateTask({
    required String workspaceId,
    required String threadId,
    required int taskId,
    String? title,
    String? description,
    String? startDate,
    String? endDate,
    String? dueDate,
    String? assignedTo,
    String? status,
    String? priority,
    List<String>? tags,
    double? estimatedHours,
    double? actualHours,
    bool? isAllDay,
    String? startTime,
    String? endTime,
    int? parentTaskId,
    List<int>? dependencies,
  }) async {
    try {
      final user = _auth.currentUser;
      if (user == null) {
        throw Exception('User not authenticated');
      }

      final token = await user.getIdToken(true);

      final data = <String, dynamic>{};
      if (title != null) data['title'] = title;
      if (description != null) data['description'] = description;
      if (startDate != null) data['start_date'] = startDate;
      if (endDate != null) data['end_date'] = endDate;
      if (dueDate != null) data['due_date'] = dueDate;
      if (assignedTo != null) data['assigned_to'] = assignedTo;
      if (status != null) data['status'] = status;
      if (priority != null) data['priority'] = priority;
      if (tags != null) data['tags'] = tags;
      if (estimatedHours != null) data['estimated_hours'] = estimatedHours;
      if (actualHours != null) data['actual_hours'] = actualHours;
      if (isAllDay != null) data['is_all_day'] = isAllDay;
      if (startTime != null) data['start_time'] = startTime;
      if (endTime != null) data['end_time'] = endTime;
      if (parentTaskId != null) data['parent_task_id'] = parentTaskId;
      if (dependencies != null) data['dependencies'] = dependencies;

      final response = await _httpClient.put(
        '/api/workspaces/$workspaceId/threads/$threadId/tasks/$taskId',
        data: data,
        options: Options(
          headers: {
            'Authorization': 'Bearer $token',
          },
        ),
      );

      return response.data as Map<String, dynamic>;
    } catch (e) {
      print('Error updating task: $e');
      rethrow;
    }
  }

  // Delete a task
  Future<void> deleteTask({
    required String workspaceId,
    required String threadId,
    required int taskId,
  }) async {
    try {
      final user = _auth.currentUser;
      if (user == null) {
        throw Exception('User not authenticated');
      }

      final token = await user.getIdToken(true);

      await _httpClient.delete(
        '/api/workspaces/$workspaceId/threads/$threadId/tasks/$taskId',
        options: Options(
          headers: {
            'Authorization': 'Bearer $token',
          },
        ),
      );
    } catch (e) {
      print('Error deleting task: $e');
      rethrow;
    }
  }

  // Mark task as complete (individual completion)
  Future<Map<String, dynamic>> markTaskComplete({
    required String workspaceId,
    required String threadId,
    required int taskId,
  }) async {
    try {
      final user = _auth.currentUser;
      if (user == null) {
        throw Exception('User not authenticated');
      }

      final token = await user.getIdToken(true);

      final response = await _httpClient.post(
        '/api/workspaces/$workspaceId/threads/$threadId/tasks/$taskId/complete',
        options: Options(
          headers: {
            'Authorization': 'Bearer $token',
          },
        ),
      );

      return response.data as Map<String, dynamic>;
    } catch (e) {
      print('Error marking task complete: $e');
      rethrow;
    }
  }

  // Mark task as incomplete (remove individual completion)
  Future<Map<String, dynamic>> markTaskIncomplete({
    required String workspaceId,
    required String threadId,
    required int taskId,
  }) async {
    try {
      final user = _auth.currentUser;
      if (user == null) {
        throw Exception('User not authenticated');
      }

      final token = await user.getIdToken(true);

      final response = await _httpClient.delete(
        '/api/workspaces/$workspaceId/threads/$threadId/tasks/$taskId/complete',
        options: Options(
          headers: {
            'Authorization': 'Bearer $token',
          },
        ),
      );

      return response.data as Map<String, dynamic>;
    } catch (e) {
      print('Error marking task incomplete: $e');
      rethrow;
    }
  }

  // Get task progress details
  Future<Map<String, dynamic>> getTaskProgress({
    required String workspaceId,
    required String threadId,
    required int taskId,
  }) async {
    try {
      final user = _auth.currentUser;
      if (user == null) {
        throw Exception('User not authenticated');
      }

      final token = await user.getIdToken(true);

      final response = await _httpClient.get(
        '/api/workspaces/$workspaceId/threads/$threadId/tasks/$taskId/progress',
        options: Options(
          headers: {
            'Authorization': 'Bearer $token',
          },
        ),
      );

      return response.data as Map<String, dynamic>;
    } catch (e) {
      print('Error fetching task progress: $e');
      rethrow;
    }
  }

  // Get subtasks of a task
  Future<List<ChannelTask>> getSubtasks({
    required String workspaceId,
    required String threadId,
    required int taskId,
  }) async {
    try {
      final user = _auth.currentUser;
      if (user == null) {
        throw Exception('User not authenticated');
      }

      final token = await user.getIdToken(true);

      final response = await _httpClient.get(
        '/api/workspaces/$workspaceId/threads/$threadId/tasks/$taskId/subtasks',
        options: Options(
          headers: {
            'Authorization': 'Bearer $token',
          },
        ),
      );

      if (response.data != null && response.data['subtasks'] != null) {
        final subtasksData = response.data['subtasks'] as List;
        return subtasksData
            .map((taskJson) => ChannelTask.fromJson(taskJson as Map<String, dynamic>))
            .toList();
      }
      return [];
    } catch (e) {
      print('Error fetching subtasks: $e');
      rethrow;
    }
  }
}
