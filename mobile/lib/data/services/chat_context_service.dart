import 'package:shared_preferences/shared_preferences.dart';

/// Model class for chat context data
class ChatContext {
  final String workspaceId;
  final String workspaceName;
  final String? channelId;
  final String? channelName;

  ChatContext({
    required this.workspaceId,
    required this.workspaceName,
    this.channelId,
    this.channelName,
  });

  Map<String, dynamic> toJson() => {
    'workspaceId': workspaceId,
    'workspaceName': workspaceName,
    'channelId': channelId,
    'channelName': channelName,
  };

  @override
  String toString() => 'ChatContext($workspaceName > #$channelName)';
}

/// Chat Context Service
/// Persists and retrieves the user's last-used workspace and channel
/// for instant navigation when tapping the "Chat" tab.
class ChatContextService {
  static const _keyWorkspaceId = 'crewchat_last_workspace_id';
  static const _keyWorkspaceName = 'crewchat_last_workspace_name';
  static const _keyChannelId = 'crewchat_last_channel_id';
  static const _keyChannelName = 'crewchat_last_channel_name';

  /// Save the current workspace and channel context
  Future<void> saveContext({
    required String workspaceId,
    required String workspaceName,
    String? channelId,
    String? channelName,
  }) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_keyWorkspaceId, workspaceId);
      await prefs.setString(_keyWorkspaceName, workspaceName);

      if (channelId != null) {
        await prefs.setString(_keyChannelId, channelId);
      } else {
        await prefs.remove(_keyChannelId);
      }

      if (channelName != null) {
        await prefs.setString(_keyChannelName, channelName);
      } else {
        await prefs.remove(_keyChannelName);
      }

      print('💾 Saved chat context: $workspaceName > #$channelName');
    } catch (e) {
      print('⚠️ Failed to save chat context: $e');
    }
  }

  /// Load the saved context
  Future<ChatContext?> loadContext() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final workspaceId = prefs.getString(_keyWorkspaceId);

      if (workspaceId == null) return null;

      return ChatContext(
        workspaceId: workspaceId,
        workspaceName: prefs.getString(_keyWorkspaceName) ?? '',
        channelId: prefs.getString(_keyChannelId),
        channelName: prefs.getString(_keyChannelName),
      );
    } catch (e) {
      print('⚠️ Failed to load chat context: $e');
      return null;
    }
  }

  /// Clear the saved context
  Future<void> clearContext() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_keyWorkspaceId);
      await prefs.remove(_keyWorkspaceName);
      await prefs.remove(_keyChannelId);
      await prefs.remove(_keyChannelName);
      print('🗑️ Cleared chat context');
    } catch (e) {
      print('⚠️ Failed to clear chat context: $e');
    }
  }

  /// Check if there's a valid saved context
  Future<bool> hasContext() async {
    final context = await loadContext();
    return context != null;
  }

  /// Update only the channel (when switching channels within same workspace)
  Future<void> updateChannel({
    required String channelId,
    required String channelName,
  }) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final workspaceId = prefs.getString(_keyWorkspaceId);

      if (workspaceId == null) return;

      await prefs.setString(_keyChannelId, channelId);
      await prefs.setString(_keyChannelName, channelName);
      print('💾 Updated channel context: #$channelName');
    } catch (e) {
      print('⚠️ Failed to update channel context: $e');
    }
  }
}
