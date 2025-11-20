import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter/foundation.dart';
import 'http_client.dart';
import '../models/workspace.dart';

class WorkspaceService {
  final HttpClient _httpClient;

  WorkspaceService(this._httpClient);

  /// Get all workspaces for the current user
  Future<List<Workspace>> getWorkspaces() async {
    try {
      if (kDebugMode) {
        print('🏢 Fetching workspaces from backend...');
      }

      final response = await _httpClient.get('/api/workspaces');
      
      if (response.statusCode == 200) {
        final data = response.data;
        final workspacesData = data['workspaces'] as List;
        
        if (kDebugMode) {
          print('✅ Loaded ${workspacesData.length} workspaces from backend');
        }

        return workspacesData.map((json) => Workspace.fromJson(json)).toList();
      } else {
        if (kDebugMode) {
          print('❌ Failed to load workspaces: ${response.statusCode}');
          print('Response: ${response.data}');
        }
        throw Exception('Failed to load workspaces: ${response.statusCode}');
      }
    } catch (e) {
      if (kDebugMode) {
        print('💥 Workspace service error: $e');
      }
      
      // Return demo data as fallback for development
      if (kDebugMode) {
        print('🔄 Using demo workspaces as fallback');
        return _getDemoWorkspaces();
      }
      
      rethrow;
    }
  }

  /// Create a new workspace
  Future<Workspace> createWorkspace({
    required String name,
    String? description,
  }) async {
    try {
      if (kDebugMode) {
        print('🏗️ Creating workspace: $name');
      }

      final response = await _httpClient.post(
        '/api/workspaces',
        data: {
          'name': name,
          'description': description,
        },
      );

      if (response.statusCode == 201) {
        final data = response.data;
        final workspace = Workspace.fromJson(data['workspace']);
        
        if (kDebugMode) {
          print('✅ Workspace created: ${workspace.name}');
        }
        
        return workspace;
      } else {
        if (kDebugMode) {
          print('❌ Failed to create workspace: ${response.statusCode}');
          print('Response: ${response.data}');
        }
        throw Exception('Failed to create workspace: ${response.statusCode}');
      }
    } catch (e) {
      if (kDebugMode) {
        print('💥 Create workspace error: $e');
      }
      rethrow;
    }
  }

  /// Get workspace details by ID
  Future<Workspace> getWorkspace(String workspaceId) async {
    try {
      if (kDebugMode) {
        print('🔍 Fetching workspace details: $workspaceId');
      }

      final response = await _httpClient.get('/api/workspaces/$workspaceId');
      
      if (response.statusCode == 200) {
        final data = response.data;
        final workspace = Workspace.fromJson(data['workspace']);
        
        if (kDebugMode) {
          print('✅ Loaded workspace details: ${workspace.name}');
        }
        
        return workspace;
      } else {
        if (kDebugMode) {
          print('❌ Failed to load workspace details: ${response.statusCode}');
        }
        throw Exception('Failed to load workspace details: ${response.statusCode}');
      }
    } catch (e) {
      if (kDebugMode) {
        print('💥 Get workspace error: $e');
      }
      rethrow;
    }
  }

  /// Get teams for a workspace
  Future<List<WorkspaceTeam>> getWorkspaceTeams(String workspaceId) async {
    try {
      if (kDebugMode) {
        print('👥 Fetching teams for workspace: $workspaceId');
      }

      final response = await _httpClient.get('/api/workspaces/$workspaceId/teams');
      
      if (response.statusCode == 200) {
        final data = response.data;
        final teamsData = data['teams'] as List;
        
        if (kDebugMode) {
          print('✅ Loaded ${teamsData.length} teams');
        }

        return teamsData.map((json) => WorkspaceTeam.fromJson(json)).toList();
      } else {
        if (kDebugMode) {
          print('❌ Failed to load teams: ${response.statusCode}');
        }
        throw Exception('Failed to load teams: ${response.statusCode}');
      }
    } catch (e) {
      if (kDebugMode) {
        print('💥 Get teams error: $e');
      }
      // Return empty list on error
      return [];
    }
  }

  /// Invite user to workspace
  Future<bool> inviteUser({
    required String workspaceId,
    required String email,
    String role = 'member',
  }) async {
    try {
      if (kDebugMode) {
        print('📧 Inviting user: $email to workspace: $workspaceId');
      }

      final response = await _httpClient.post(
        '/api/workspaces/$workspaceId/invite',
        data: {
          'email': email,
          'role': role,
        },
      );

      if (response.statusCode == 201) {
        if (kDebugMode) {
          print('✅ Invitation sent to $email');
        }
        return true;
      } else {
        if (kDebugMode) {
          print('❌ Failed to send invitation: ${response.statusCode}');
        }
        return false;
      }
    } catch (e) {
      if (kDebugMode) {
        print('💥 Invite user error: $e');
      }
      return false;
    }
  }

  /// Accept workspace invitation
  Future<Workspace?> acceptInvitation(String token) async {
    try {
      if (kDebugMode) {
        print('🎫 Accepting invitation with token: $token');
      }

      final response = await _httpClient.post('/api/workspaces/accept-invite/$token');

      if (response.statusCode == 200) {
        final data = response.data;
        
        if (kDebugMode) {
          print('✅ Invitation accepted successfully');
        }
        
        // Return basic workspace info from invitation response
        return Workspace(
          id: data['workspace']['id'],
          name: data['workspace']['name'],
          description: null,
          ownerId: '',
          role: data['workspace']['role'],
          memberCount: 1,
          channelCount: 0,
          createdAt: DateTime.now(),
          settings: {},
        );
      } else {
        if (kDebugMode) {
          print('❌ Failed to accept invitation: ${response.statusCode}');
        }
        return null;
      }
    } catch (e) {
      if (kDebugMode) {
        print('💥 Accept invitation error: $e');
      }
      return null;
    }
  }

  /// Demo workspaces for development fallback
  List<Workspace> _getDemoWorkspaces() {
    return [
      Workspace(
        id: 'ws_demo_1',
        name: 'Marketing Team',
        description: 'Brand campaigns, content creation, and social media management',
        ownerId: 'demo_user',
        role: 'admin',
        memberCount: 8,
        channelCount: 5,
        createdAt: DateTime.now().subtract(const Duration(days: 30)),
        settings: {'color': 'purple'},
      ),
      Workspace(
        id: 'ws_demo_2',
        name: 'Product Development',
        description: 'Feature planning, design reviews, and sprint coordination',
        ownerId: 'demo_user',
        role: 'member',
        memberCount: 12,
        channelCount: 8,
        createdAt: DateTime.now().subtract(const Duration(days: 45)),
        settings: {'color': 'blue'},
      ),
      Workspace(
        id: 'ws_demo_3',
        name: 'Customer Success',
        description: 'Support tickets, onboarding, and customer feedback',
        ownerId: 'other_user',
        role: 'member',
        memberCount: 5,
        channelCount: 3,
        createdAt: DateTime.now().subtract(const Duration(days: 60)),
        settings: {'color': 'green'},
      ),
    ];
  }
}
