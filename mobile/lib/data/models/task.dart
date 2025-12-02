class ChannelTask {
  final String id;  // UUID from database
  final String threadId;  // UUID from database
  final String workspaceId;  // UUID from database - FIXED: was int, now String
  final String title;
  final String? description;
  final DateTime? startDate;
  final DateTime? endDate;
  final DateTime? dueDate;
  final String? assignedTo;
  final List<String> assignees;
  final List<int> assignedTeams;
  final String assignmentMode;
  final bool requiresIndividualResponse;
  final String status;
  final String priority;
  final List<String> tags;
  final double? estimatedHours;
  final double? actualHours;
  final bool isAllDay;
  final String? startTime;
  final String? endTime;
  final String? parentTaskId;  // UUID from database
  final List<int> dependencies;
  final String? googleCalendarEventId;
  final String? googleTaskId;
  final DateTime? completedAt;
  final String createdBy;
  final DateTime createdAt;
  final DateTime updatedAt;
  
  // Computed fields from backend
  final String? createdByName;
  final String? channelName;
  final Map<String, dynamic>? progressInfo;
  final bool isComplete;
  final int totalAssignees;
  final int individualAssigneeCount;
  final int teamCount;
  final List<AssigneeDetail>? assigneeDetails;
  final List<TeamDetail>? teamDetails;
  final bool userCanEdit;
  final bool userIsAssignee;
  final bool userCompleted;
  final Map<String, DateTime>? individualCompletions;

  ChannelTask({
    required this.id,
    required this.threadId,
    required this.workspaceId,
    required this.title,
    this.description,
    this.startDate,
    this.endDate,
    this.dueDate,
    this.assignedTo,
    this.assignees = const [],
    this.assignedTeams = const [],
    this.assignmentMode = 'collaborative',
    this.requiresIndividualResponse = false,
    this.status = 'pending',
    this.priority = 'medium',
    this.tags = const [],
    this.estimatedHours,
    this.actualHours,
    this.isAllDay = false,
    this.startTime,
    this.endTime,
    this.parentTaskId,
    this.dependencies = const [],
    this.googleCalendarEventId,
    this.googleTaskId,
    this.completedAt,
    required this.createdBy,
    required this.createdAt,
    required this.updatedAt,
    this.createdByName,
    this.channelName,
    this.progressInfo,
    this.isComplete = false,
    this.totalAssignees = 0,
    this.individualAssigneeCount = 0,
    this.teamCount = 0,
    this.assigneeDetails,
    this.teamDetails,
    this.userCanEdit = false,
    this.userIsAssignee = false,
    this.userCompleted = false,
    this.individualCompletions,
  });

  factory ChannelTask.fromJson(Map<String, dynamic> json) {
    // Helper function to safely parse int from string or int
    int parseInt(dynamic value) {
      if (value == null) return 0;
      if (value is int) return value;
      if (value is String) return int.tryParse(value) ?? 0;
      if (value is num) return value.toInt();
      return 0;
    }

    // Helper function to parse ID (keep as string for UUID)
    String parseId(dynamic value) {
      if (value == null) return '';
      return value.toString();
    }

    // Helper function to safely parse nullable string ID
    String? parseNullableId(dynamic value) {
      if (value == null) return null;
      return value.toString();
    }

    // Helper function to parse list of ints (handles string IDs too)
    List<int> parseIntList(dynamic value) {
      if (value == null) return [];
      if (value is! List) return [];
      return (value as List).map((item) => parseInt(item)).toList();
    }

    return ChannelTask(
      id: parseId(json['id']),
      threadId: parseId(json['thread_id']),
      workspaceId: parseId(json['workspace_id']),  // FIXED: use parseId for UUID
      title: json['title'] as String,
      description: json['description'] as String?,
      startDate: json['start_date'] != null 
          ? DateTime.parse(json['start_date'] as String) 
          : null,
      endDate: json['end_date'] != null 
          ? DateTime.parse(json['end_date'] as String) 
          : null,
      dueDate: json['due_date'] != null 
          ? DateTime.parse(json['due_date'] as String) 
          : null,
      assignedTo: json['assigned_to'] as String?,
      assignees: json['assignees'] != null 
          ? List<String>.from(json['assignees'] as List) 
          : [],
      assignedTeams: parseIntList(json['assigned_teams']),
      assignmentMode: json['assignment_mode'] as String? ?? 'collaborative',
      requiresIndividualResponse: json['requires_individual_response'] as bool? ?? false,
      status: json['status'] as String? ?? 'pending',
      priority: json['priority'] as String? ?? 'medium',
      tags: json['tags'] != null 
          ? List<String>.from(json['tags'] as List) 
          : [],
      estimatedHours: json['estimated_hours'] != null 
          ? (json['estimated_hours'] as num).toDouble() 
          : null,
      actualHours: json['actual_hours'] != null 
          ? (json['actual_hours'] as num).toDouble() 
          : null,
      isAllDay: json['is_all_day'] as bool? ?? false,
      startTime: json['start_time'] as String?,
      endTime: json['end_time'] as String?,
      parentTaskId: parseNullableId(json['parent_task_id']),
      dependencies: parseIntList(json['dependencies']),
      googleCalendarEventId: json['google_calendar_event_id'] as String?,
      googleTaskId: json['google_task_id'] as String?,
      completedAt: json['completed_at'] != null 
          ? DateTime.parse(json['completed_at'] as String) 
          : null,
      createdBy: json['created_by'] as String,
      createdAt: DateTime.parse(json['created_at'] as String),
      updatedAt: DateTime.parse(json['updated_at'] as String),
      createdByName: json['created_by_name'] as String?,
      channelName: json['channel_name'] as String?,
      progressInfo: json['progress_info'] as Map<String, dynamic>?,
      isComplete: json['is_complete'] as bool? ?? false,
      totalAssignees: parseInt(json['total_assignees'] ?? 0),
      individualAssigneeCount: parseInt(json['individual_assignee_count'] ?? 0),
      teamCount: parseInt(json['team_count'] ?? 0),
      assigneeDetails: json['assignee_details'] != null
          ? (json['assignee_details'] as List)
              .map((detail) => AssigneeDetail.fromJson(detail as Map<String, dynamic>))
              .toList()
          : null,
      teamDetails: json['team_details'] != null
          ? (json['team_details'] as List)
              .map((detail) => TeamDetail.fromJson(detail as Map<String, dynamic>))
              .toList()
          : null,
      userCanEdit: json['user_can_edit'] as bool? ?? false,
      userIsAssignee: json['user_is_assignee'] as bool? ?? false,
      userCompleted: json['user_completed'] as bool? ?? false,
      individualCompletions: json['individual_completions'] != null
          ? (json['individual_completions'] as Map<String, dynamic>).map(
              (key, value) => MapEntry(key, DateTime.parse(value as String)),
            )
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'thread_id': threadId,
      'workspace_id': workspaceId,
      'title': title,
      'description': description,
      'start_date': startDate?.toIso8601String(),
      'end_date': endDate?.toIso8601String(),
      'due_date': dueDate?.toIso8601String(),
      'assigned_to': assignedTo,
      'assignees': assignees,
      'assigned_teams': assignedTeams,
      'assignment_mode': assignmentMode,
      'requires_individual_response': requiresIndividualResponse,
      'status': status,
      'priority': priority,
      'tags': tags,
      'estimated_hours': estimatedHours,
      'actual_hours': actualHours,
      'is_all_day': isAllDay,
      'start_time': startTime,
      'end_time': endTime,
      'parent_task_id': parentTaskId,
      'dependencies': dependencies,
      'google_calendar_event_id': googleCalendarEventId,
      'google_task_id': googleTaskId,
      'completed_at': completedAt?.toIso8601String(),
      'created_by': createdBy,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt.toIso8601String(),
    };
  }

  // Helper to get progress percentage
  double get progressPercentage {
    if (isComplete) return 100.0;
    if (actualHours != null && estimatedHours != null && estimatedHours! > 0) {
      return (actualHours! / estimatedHours! * 100).clamp(0, 100);
    }
    return 0.0;
  }

  // Helper to get completion text
  String get completionText {
    if (requiresIndividualResponse && progressInfo != null) {
      // Safely parse numeric values from progressInfo
      int parseIntSafe(dynamic value) {
        if (value == null) return 0;
        if (value is int) return value;
        if (value is String) return int.tryParse(value) ?? 0;
        if (value is num) return value.toInt();
        return 0;
      }
      
      final completed = parseIntSafe(progressInfo!['completed']);
      final total = parseIntSafe(progressInfo!['total']);
      return '$completed/$total done';
    }
    return isComplete ? 'Complete' : '';
  }
}

class AssigneeDetail {
  final String id;
  final String displayName;
  final String email;

  AssigneeDetail({
    required this.id,
    required this.displayName,
    required this.email,
  });

  factory AssigneeDetail.fromJson(Map<String, dynamic> json) {
    return AssigneeDetail(
      id: json['id'] as String,
      displayName: json['display_name'] as String,
      email: json['email'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'display_name': displayName,
      'email': email,
    };
  }
}

class TeamDetail {
  final int id;
  final String name;
  final String displayName;
  final String color;
  final int memberCount;

  TeamDetail({
    required this.id,
    required this.name,
    required this.displayName,
    required this.color,
    required this.memberCount,
  });

  factory TeamDetail.fromJson(Map<String, dynamic> json) {
    // Helper function to safely parse int from string or int
    int parseInt(dynamic value) {
      if (value == null) return 0;
      if (value is int) return value;
      if (value is String) return int.tryParse(value) ?? 0;
      if (value is num) return value.toInt();
      return 0;
    }

    return TeamDetail(
      id: parseInt(json['id']),
      name: json['name'] as String,
      displayName: json['display_name'] as String,
      color: json['color'] as String,
      memberCount: parseInt(json['member_count']),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'display_name': displayName,
      'color': color,
      'member_count': memberCount,
    };
  }
}
