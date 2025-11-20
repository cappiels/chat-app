import 'dart:convert';

class Workspace {
  final String id;
  final String name;
  final String? description;
  final String ownerId;
  final String role;
  final int memberCount;
  final int channelCount;
  final DateTime createdAt;
  final Map<String, dynamic> settings;
  final String? ownerName;
  final String? ownerEmail;
  final String? ownerAvatar;

  Workspace({
    required this.id,
    required this.name,
    this.description,
    required this.ownerId,
    required this.role,
    required this.memberCount,
    required this.channelCount,
    required this.createdAt,
    required this.settings,
    this.ownerName,
    this.ownerEmail,
    this.ownerAvatar,
  });

  factory Workspace.fromJson(Map<String, dynamic> json) {
    return Workspace(
      id: json['id'] ?? '',
      name: json['name'] ?? 'Unknown Workspace',
      description: json['description'],
      ownerId: json['owner_user_id'] ?? json['owner_id'] ?? '',
      role: json['role'] ?? 'member',
      memberCount: json['member_count'] ?? 0,
      channelCount: json['channel_count'] ?? 0,
      createdAt: json['created_at'] != null 
        ? DateTime.parse(json['created_at'])
        : DateTime.now(),
      settings: json['settings'] is String 
        ? _parseJsonString(json['settings'])
        : (json['settings'] as Map<String, dynamic>? ?? {}),
      ownerName: json['owner_name'],
      ownerEmail: json['owner_email'],
      ownerAvatar: json['owner_avatar'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'description': description,
      'owner_user_id': ownerId,
      'role': role,
      'member_count': memberCount,
      'channel_count': channelCount,
      'created_at': createdAt.toIso8601String(),
      'settings': settings,
      'owner_name': ownerName,
      'owner_email': ownerEmail,
      'owner_avatar': ownerAvatar,
    };
  }

  /// Parse JSON string to Map
  static Map<String, dynamic> _parseJsonString(String jsonString) {
    try {
      final parsed = json.decode(jsonString);
      return parsed is Map<String, dynamic> ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  /// Get workspace color from settings
  String get color {
    return settings['color'] ?? 'blue';
  }

  /// Check if user is admin
  bool get isAdmin {
    return role == 'admin' || ownerId == 'current_user';
  }

  /// Get last activity text
  String get lastActivity {
    final now = DateTime.now();
    final diff = now.difference(createdAt);
    
    if (diff.inMinutes < 1) {
      return 'Just now';
    } else if (diff.inMinutes < 60) {
      return '${diff.inMinutes} minutes ago';
    } else if (diff.inHours < 24) {
      return '${diff.inHours} hours ago';
    } else if (diff.inDays < 30) {
      return '${diff.inDays} days ago';
    } else {
      return 'Over a month ago';
    }
  }

  /// Create a copy with updated fields
  Workspace copyWith({
    String? id,
    String? name,
    String? description,
    String? ownerId,
    String? role,
    int? memberCount,
    int? channelCount,
    DateTime? createdAt,
    Map<String, dynamic>? settings,
    String? ownerName,
    String? ownerEmail,
    String? ownerAvatar,
  }) {
    return Workspace(
      id: id ?? this.id,
      name: name ?? this.name,
      description: description ?? this.description,
      ownerId: ownerId ?? this.ownerId,
      role: role ?? this.role,
      memberCount: memberCount ?? this.memberCount,
      channelCount: channelCount ?? this.channelCount,
      createdAt: createdAt ?? this.createdAt,
      settings: settings ?? this.settings,
      ownerName: ownerName ?? this.ownerName,
      ownerEmail: ownerEmail ?? this.ownerEmail,
      ownerAvatar: ownerAvatar ?? this.ownerAvatar,
    );
  }
}

class WorkspaceTeam {
  final String id;
  final String workspaceId;
  final String name;
  final String displayName;
  final String? description;
  final String color;
  final String createdBy;
  final DateTime createdAt;
  final List<WorkspaceTeamMember> members;
  final int memberCount;
  final bool isActive;

  WorkspaceTeam({
    required this.id,
    required this.workspaceId,
    required this.name,
    required this.displayName,
    this.description,
    required this.color,
    required this.createdBy,
    required this.createdAt,
    required this.members,
    required this.memberCount,
    this.isActive = true,
  });

  factory WorkspaceTeam.fromJson(Map<String, dynamic> json) {
    final membersData = json['members'] as List? ?? [];
    
    return WorkspaceTeam(
      id: json['id'] ?? '',
      workspaceId: json['workspace_id'] ?? '',
      name: json['name'] ?? '',
      displayName: json['display_name'] ?? json['name'] ?? '',
      description: json['description'],
      color: json['color'] ?? 'blue',
      createdBy: json['created_by'] ?? '',
      createdAt: json['created_at'] != null 
        ? DateTime.parse(json['created_at'])
        : DateTime.now(),
      members: membersData.map((m) => WorkspaceTeamMember.fromJson(m)).toList(),
      memberCount: json['member_count'] ?? membersData.length,
      isActive: json['is_active'] ?? true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'workspace_id': workspaceId,
      'name': name,
      'display_name': displayName,
      'description': description,
      'color': color,
      'created_by': createdBy,
      'created_at': createdAt.toIso8601String(),
      'members': members.map((m) => m.toJson()).toList(),
      'member_count': memberCount,
      'is_active': isActive,
    };
  }
}

class WorkspaceTeamMember {
  final String userId;
  final String role;
  final String displayName;
  final String email;
  final DateTime joinedAt;

  WorkspaceTeamMember({
    required this.userId,
    required this.role,
    required this.displayName,
    required this.email,
    required this.joinedAt,
  });

  factory WorkspaceTeamMember.fromJson(Map<String, dynamic> json) {
    return WorkspaceTeamMember(
      userId: json['user_id'] ?? '',
      role: json['role'] ?? 'member',
      displayName: json['display_name'] ?? '',
      email: json['email'] ?? '',
      joinedAt: json['joined_at'] != null 
        ? DateTime.parse(json['joined_at'])
        : DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'user_id': userId,
      'role': role,
      'display_name': displayName,
      'email': email,
      'joined_at': joinedAt.toIso8601String(),
    };
  }
}

class WorkspaceMember {
  final String id;
  final String email;
  final String displayName;
  final String? profilePictureUrl;
  final String role;
  final DateTime joinedAt;
  final DateTime? lastLogin;

  WorkspaceMember({
    required this.id,
    required this.email,
    required this.displayName,
    this.profilePictureUrl,
    required this.role,
    required this.joinedAt,
    this.lastLogin,
  });

  factory WorkspaceMember.fromJson(Map<String, dynamic> json) {
    return WorkspaceMember(
      id: json['id'] ?? '',
      email: json['email'] ?? '',
      displayName: json['display_name'] ?? '',
      profilePictureUrl: json['profile_picture_url'],
      role: json['role'] ?? 'member',
      joinedAt: json['joined_at'] != null 
        ? DateTime.parse(json['joined_at'])
        : DateTime.now(),
      lastLogin: json['last_login'] != null 
        ? DateTime.parse(json['last_login'])
        : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'display_name': displayName,
      'profile_picture_url': profilePictureUrl,
      'role': role,
      'joined_at': joinedAt.toIso8601String(),
      'last_login': lastLogin?.toIso8601String(),
    };
  }

  bool get isAdmin => role == 'admin';
}
