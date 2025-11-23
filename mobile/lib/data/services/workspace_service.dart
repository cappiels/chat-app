import 'package:dio/dio.dart';
import '../models/workspace.dart';
import 'http_client.dart';

class WorkspaceService {
  final HttpClient _httpClient = HttpClient();

  /// Get all workspaces for the current user
  Future<List<Workspace>> getWorkspaces() async {
    try {
      final response = await _httpClient.get('/workspaces');
      
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
      final response = await _httpClient.get('/workspaces/$workspaceId');
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
        '/workspaces',
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
        '/workspaces/$workspaceId/invite',
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
      final response = await _httpClient.get('/workspaces/$workspaceId/members');
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
      await _httpClient.delete('/workspaces/$workspaceId/members/$userId');
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
        '/workspaces/$workspaceId',
        data: {'archive': archive},
      );
    } catch (e) {
      print('❌ Error deleting workspace: $e');
      rethrow;
    }
  }
}
