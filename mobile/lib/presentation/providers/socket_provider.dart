import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../../data/services/socket_service.dart';

// Socket service singleton provider
final socketServiceProvider = Provider<SocketService>((ref) {
  return SocketService();
});

// Socket connection state provider
final socketConnectionStateProvider = StreamProvider<SocketConnectionState>((ref) {
  final socketService = ref.read(socketServiceProvider);
  return socketService.connectionStateStream;
});

// Current socket connection status
final socketStatusProvider = Provider<SocketStatus>((ref) {
  final socketService = ref.read(socketServiceProvider);
  final connectionState = ref.watch(socketConnectionStateProvider);
  
  return connectionState.when(
    data: (state) => SocketStatus(
      state: state,
      error: socketService.connectionError,
      isConnected: socketService.isConnected,
      currentWorkspaceId: socketService.currentWorkspaceId,
      currentThreadId: socketService.currentThreadId,
    ),
    loading: () => SocketStatus(
      state: SocketConnectionState.connecting,
      isConnected: false,
    ),
    error: (error, stack) => SocketStatus(
      state: SocketConnectionState.disconnected,
      error: error.toString(),
      isConnected: false,
    ),
  );
});

// Socket connection actions
final socketActionsProvider = Provider<SocketActions>((ref) {
  final socketService = ref.read(socketServiceProvider);
  return SocketActions(socketService);
});

// Auto-connect when user is authenticated
final autoConnectProvider = Provider<void>((ref) {
  final socketService = ref.read(socketServiceProvider);
  
  // Watch authentication state
  ref.listen(
    StreamProvider((ref) => FirebaseAuth.instance.authStateChanges()),
    (previous, next) {
      next.when(
        data: (user) {
          if (user != null && !socketService.isConnected) {
            // User is authenticated, connect to socket
            socketService.connect();
          } else if (user == null && socketService.isConnected) {
            // User logged out, disconnect
            socketService.disconnect();
          }
        },
        loading: () {},
        error: (error, stack) {},
      );
    },
  );
});

class SocketStatus {
  final SocketConnectionState state;
  final String? error;
  final bool isConnected;
  final String? currentWorkspaceId;
  final String? currentThreadId;

  const SocketStatus({
    required this.state,
    this.error,
    required this.isConnected,
    this.currentWorkspaceId,
    this.currentThreadId,
  });

  bool get isConnecting => state == SocketConnectionState.connecting;
  bool get isDisconnected => state == SocketConnectionState.disconnected;
  bool get isReconnecting => state == SocketConnectionState.reconnecting;
  bool get hasError => error != null;
}

class SocketActions {
  final SocketService _socketService;

  SocketActions(this._socketService);

  Future<bool> connect({String? serverUrl}) => _socketService.connect(serverUrl: serverUrl);
  
  void disconnect() => _socketService.disconnect();
  
  Future<bool> joinWorkspace(String workspaceId) => _socketService.joinWorkspace(workspaceId);
  
  Future<bool> joinThread(String workspaceId, String threadId) => 
      _socketService.joinThread(workspaceId, threadId);
  
  Future<void> leaveThread() => _socketService.leaveThread();
  
  Future<bool> sendMessage({
    required String content,
    String messageType = 'text',
    String? parentMessageId,
    List<Map<String, dynamic>>? mentions,
    List<Map<String, dynamic>>? attachments,
    String? messageId,
  }) => _socketService.sendMessage(
    content: content,
    messageType: messageType,
    parentMessageId: parentMessageId,
    mentions: mentions,
    attachments: attachments,
    messageId: messageId,
  );
  
  Future<bool> editMessage(String messageId, String content) => 
      _socketService.editMessage(messageId, content);
  
  Future<bool> deleteMessage(String messageId) => _socketService.deleteMessage(messageId);
  
  Future<bool> addReaction(String messageId, String emoji) => 
      _socketService.addReaction(messageId, emoji);
  
  Future<bool> removeReaction(String messageId, String emoji) => 
      _socketService.removeReaction(messageId, emoji);
  
  Future<bool> startTyping() => _socketService.startTyping();
  
  Future<bool> stopTyping() => _socketService.stopTyping();
  
  Future<bool> updatePresence(String status) => _socketService.updatePresence(status);
  
  Future<bool> markAsRead({
    required String workspaceId,
    required String entityType,
    required String entityId,
    String? messageId,
  }) => _socketService.markAsRead(
    workspaceId: workspaceId,
    entityType: entityType,
    entityId: entityId,
    messageId: messageId,
  );
}
