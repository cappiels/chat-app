import 'package:dio/dio.dart';
import '../models/workspace.dart';
import 'http_client.dart';

class WorkspaceService {
  final HttpClient _httpClient = HttpClient();

  /// Get all workspaces for the current user
  Future<List<Workspace>> getWorkspaces() async {
    try {
      final response = await _httpClient.get('/api/workspaces');
      
      // Extract workspaces from the response
      final workspacesData = response.data['workspaces'] as List;
      return workspacesData
          .map((json) => Workspace.fromJson(json))
          .toList();
    } catch (e) {
      print('❌ Error fetching workspaces: $e');
      rethrow;
    }
  }

  /// Get detailed information about a specific workspace
  Future<Workspace> getWorkspace(String workspaceId) async {
    try {
      final response = await _httpClient.get('/api/workspaces/$workspaceId');
      return Workspace.fromJson(response.data['workspace']);
    } catch (e) {
      print('❌ Error fetching workspace details: $e');
      rethrow;
    }
  }

  /// Create a new workspace
  Future<Workspace> createWorkspace({
    required String name,
    String? description,
  }) async {
    try {
      final response = await _httpClient.post(
        '/api/workspaces',
        data: {
          'name': name,
          'description': description,
        },
      );
      return Workspace.fromJson(response.data['workspace']);
    } catch (e) {
      print('❌ Error creating workspace: $e');
      rethrow;
    }
  }

  /// Invite a user to the workspace via email
  Future<Map<String, dynamic>> inviteUser({
    required String workspaceId,
    required String email,
    String role = 'member', // 'admin' or 'member'
  }) async {
    try {
      final response = await _httpClient.post(
        '/api/workspaces/$workspaceId/invite',
        data: {
          'email': email,
          'role': role,
        },
      );
      return response.data;
    } on DioException catch (e) {
      print('❌ Error inviting user: $e');
      // Extract error message from response
      if (e.response?.data != null && e.response!.data['message'] != null) {
        throw Exception(e.response!.data['message']);
      }
      rethrow;
    } catch (e) {
      print('❌ Error inviting user: $e');
      rethrow;
    }
  }

  /// Get workspace members
  Future<List<Map<String, dynamic>>> getMembers(String workspaceId) async {
    try {
      final response = await _httpClient.get('/api/workspaces/$workspaceId/members');
      return List<Map<String, dynamic>>.from(response.data['members'] ?? []);
    } catch (e) {
      print('❌ Error fetching members: $e');
      rethrow;
    }
  }

  /// Remove a member from the workspace (admin only)
  Future<void> removeMember({
    required String workspaceId,
    required String userId,
  }) async {
    try {
      await _httpClient.delete('/api/workspaces/$workspaceId/members/$userId');
    } catch (e) {
      print('❌ Error removing member: $e');
      rethrow;
    }
  }

  /// Delete or archive a workspace (owner only)
  Future<void> deleteWorkspace({
    required String workspaceId,
    bool archive = true, // true = archive, false = permanent delete
  }) async {
    try {
      await _httpClient.delete(
        '/api/workspaces/$workspaceId',
        data: {'archive': archive},
      );
    } catch (e) {
      print('❌ Error deleting workspace: $e');
      rethrow;
    }
  }

  /// Get channels for a workspace
  Future<List<Map<String, dynamic>>> getChannels(String workspaceId) async {
    try {
      final response = await _httpClient.get('/api/workspaces/$workspaceId/threads');
      final threads = List<Map<String, dynamic>>.from(response.data['threads'] ?? []);
      // Filter to only return channels (not DMs)
      return threads.where((t) => t['type'] == 'channel').toList();
    } catch (e) {
      print('❌ Error fetching channels: $e');
      rethrow;
    }
  }

  /// Get tasks from all workspaces
  Future<List<Map<String, dynamic>>> getAllWorkspacesTasks() async {
    try {
      final response = await _httpClient.get('/api/tasks/all');
      return List<Map<String, dynamic>>.from(response.data['tasks'] ?? []);
    } catch (e) {
      print('❌ Error fetching all workspaces tasks: $e');
      rethrow;
    }
  }

  /// Get tasks from specific workspaces or channels
  Future<List<Map<String, dynamic>>> getWorkspacesTasks({
    List<String>? workspaceIds,
    List<String>? channelIds,
  }) async {
    try {
      String queryParams = '';
      if (workspaceIds != null && workspaceIds.isNotEmpty) {
        queryParams += 'workspace_ids=${workspaceIds.join(',')}';
      }
      if (channelIds != null && channelIds.isNotEmpty) {
        if (queryParams.isNotEmpty) queryParams += '&';
        queryParams += 'channel_ids=${channelIds.join(',')}';
      }
      
      final response = await _httpClient.get(
        '/api/tasks/all${queryParams.isNotEmpty ? '?$queryParams' : ''}'
      );
      return List<Map<String, dynamic>>.from(response.data['tasks'] ?? []);
    } catch (e) {
      print('❌ Error fetching workspaces tasks: $e');
      rethrow;
    }
  }

  // ========== SITE ADMIN FUNCTIONS (cappiels@gmail.com only) ==========

  /// Search registered users by name or email (site admin only)
  Future<List<Map<String, dynamic>>> searchRegisteredUsers(String query) async {
    try {
      if (query.length < 2) {
        return [];
      }
      
      final response = await _httpClient.get(
        '/api/admin/users/search',
        queryParameters: {'q': query},
      );
      return List<Map<String, dynamic>>.from(response.data['users'] ?? []);
    } on DioException catch (e) {
      print('❌ Error searching users: $e');
      if (e.response?.statusCode == 403) {
        throw Exception('Site admin access required');
      }
      rethrow;
    } catch (e) {
      print('❌ Error searching users: $e');
      rethrow;
    }
  }

  /// Add a registered user directly to a workspace (site admin only)
  Future<Map<String, dynamic>> addRegisteredUserToWorkspace({
    required String workspaceId,
    required String userId,
    String role = 'member',
  }) async {
    try {
      final response = await _httpClient.post(
        '/api/admin/workspaces/$workspaceId/add-member',
        data: {
          'user_id': userId,
          'role': role,
        },
      );
      return response.data;
    } on DioException catch (e) {
      print('❌ Error adding user to workspace: $e');
      if (e.response?.data != null && e.response!.data['message'] != null) {
        throw Exception(e.response!.data['message']);
      }
      if (e.response?.statusCode == 403) {
        throw Exception('Site admin access required');
      }
      if (e.response?.statusCode == 409) {
        throw Exception('User is already a member of this workspace');
      }
      rethrow;
    } catch (e) {
      print('❌ Error adding user to workspace: $e');
      rethrow;
    }
  }
}
