import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import 'package:firebase_auth/firebase_auth.dart';
import '../models/message.dart';
import '../models/reaction.dart';
import '../../core/config/api_config.dart';

class SocketService extends ChangeNotifier {
  static final SocketService _instance = SocketService._internal();
  factory SocketService() => _instance;
  SocketService._internal();

  IO.Socket? _socket;
  String? _currentWorkspaceId;
  String? _currentThreadId;
  final Map<String, Set<String>> _typingUsers = {};
  Timer? _reconnectTimer;
  
  // Connection state
  SocketConnectionState _connectionState = SocketConnectionState.disconnected;
  String? _connectionError;
  DateTime? _lastConnected;
  
  // Event streams
  final StreamController<Message> _messageStreamController = StreamController.broadcast();
  final StreamController<MessageUpdate> _messageUpdateController = StreamController.broadcast();
  final StreamController<ReactionUpdate> _reactionUpdateController = StreamController.broadcast();
  final StreamController<TypingUpdate> _typingUpdateController = StreamController.broadcast();
  final StreamController<PresenceUpdate> _presenceUpdateController = StreamController.broadcast();
  final StreamController<SocketConnectionState> _connectionStateController = StreamController.broadcast();

  // Getters
  SocketConnectionState get connectionState => _connectionState;
  String? get connectionError => _connectionError;
  bool get isConnected => _connectionState == SocketConnectionState.connected;
  String? get currentWorkspaceId => _currentWorkspaceId;
  String? get currentThreadId => _currentThreadId;

  // Event streams
  Stream<Message> get messageStream => _messageStreamController.stream;
  Stream<MessageUpdate> get messageUpdateStream => _messageUpdateController.stream;
  Stream<ReactionUpdate> get reactionUpdateStream => _reactionUpdateController.stream;
  Stream<TypingUpdate> get typingUpdateStream => _typingUpdateController.stream;
  Stream<PresenceUpdate> get presenceUpdateStream => _presenceUpdateController.stream;
  Stream<SocketConnectionState> get connectionStateStream => _connectionStateController.stream;

  /// Initialize and connect to Socket.IO server
  Future<bool> connect({String? serverUrl}) async {
    try {
      _updateConnectionState(SocketConnectionState.connecting);
      
      // Get Firebase auth token
      final user = FirebaseAuth.instance.currentUser;
      if (user == null) {
        _updateConnectionState(SocketConnectionState.disconnected, 'No authenticated user');
        return false;
      }

      final token = await user.getIdToken();
      final baseUrl = serverUrl ?? ApiConfig.socketUrl;
      
      debugPrint('🔌 Connecting to Socket.IO server: $baseUrl');
      
      // Configure socket with authentication
      _socket = IO.io(baseUrl, IO.OptionBuilder()
          .setTransports(['websocket', 'polling'])
          .enableAutoConnect()
          .setTimeout(15000)
          .setAuth({'token': token})
          .build());

      _setupEventListeners();
      _socket?.connect();
      
      return true;
    } catch (e) {
      debugPrint('❌ Socket connection error: $e');
      _updateConnectionState(SocketConnectionState.disconnected, e.toString());
      return false;
    }
  }

  /// Disconnect from Socket.IO server
  void disconnect() {
    debugPrint('🔌 Disconnecting from Socket.IO server');
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
    _currentWorkspaceId = null;
    _currentThreadId = null;
    _typingUsers.clear();
    _updateConnectionState(SocketConnectionState.disconnected);
  }

  /// Join a workspace
  Future<bool> joinWorkspace(String workspaceId) async {
    if (!isConnected) {
      debugPrint('⚠️ Cannot join workspace - not connected');
      return false;
    }

    try {
      debugPrint('📝 Joining workspace: $workspaceId');
      _socket?.emit('join_workspace', {'workspaceId': workspaceId});
      _currentWorkspaceId = workspaceId;
      return true;
    } catch (e) {
      debugPrint('❌ Error joining workspace: $e');
      return false;
    }
  }

  /// Join a thread (channel or DM)
  Future<bool> joinThread(String workspaceId, String threadId) async {
    if (!isConnected) {
      debugPrint('⚠️ Cannot join thread - not connected');
      return false;
    }

    try {
      // Leave previous thread if any
      if (_currentThreadId != null) {
        await leaveThread();
      }

      debugPrint('💬 REQUESTING to join thread: $threadId in workspace: $workspaceId');
      
      // Create a completer to wait for confirmation
      final completer = Completer<bool>();
      
      // Set up one-time listener for confirmation
      void confirmationHandler(dynamic data) {
        debugPrint('✅ CONFIRMED: Joined thread successfully');
        if (!completer.isCompleted) {
          completer.complete(true);
        }
      }
      
      // Listen for confirmation
      _socket?.once('thread_joined', confirmationHandler);
      
      // Emit the join request
      _socket?.emit('join_thread', {
        'workspaceId': workspaceId,
        'threadId': threadId,
      });
      
      // Update state immediately (optimistic)
      _currentWorkspaceId = workspaceId;
      _currentThreadId = threadId;
      
      // Wait for confirmation with timeout
      final result = await completer.future.timeout(
        const Duration(seconds: 5),
        onTimeout: () {
          debugPrint('⚠️ Thread join confirmation timeout - continuing anyway');
          return true;
        },
      );
      
      debugPrint('🎯 Thread join complete, ready to receive messages');
      return result;
    } catch (e) {
      debugPrint('❌ Error joining thread: $e');
      return false;
    }
  }

  /// Leave current thread
  Future<void> leaveThread() async {
    if (_currentThreadId != null && isConnected) {
      debugPrint('🚪 Leaving thread: $_currentThreadId');
      _socket?.emit('leave_thread', {'threadId': _currentThreadId});
      
      // Stop typing if currently typing
      await stopTyping();
      
      _currentThreadId = null;
    }
  }

  /// Send a message
  Future<bool> sendMessage({
    required String content,
    String messageType = 'text',
    String? parentMessageId,
    List<Map<String, dynamic>>? mentions,
    List<Map<String, dynamic>>? attachments,
    String? messageId,
  }) async {
    if (!isConnected || _currentThreadId == null) {
      debugPrint('⚠️ Cannot send message - not connected or no thread');
      return false;
    }

    try {
      debugPrint('💬 Sending message to thread: $_currentThreadId');
      
      _socket?.emit('send_message', {
        'threadId': _currentThreadId,
        'content': content,
        'message_type': messageType,
        'parent_message_id': parentMessageId,
        'mentions': mentions ?? [],
        'attachments': attachments ?? [],
        'messageId': messageId,
      });
      
      return true;
    } catch (e) {
      debugPrint('❌ Error sending message: $e');
      return false;
    }
  }

  /// Edit a message
  Future<bool> editMessage(String messageId, String content) async {
    if (!isConnected || _currentThreadId == null) return false;

    try {
      _socket?.emit('edit_message', {
        'messageId': messageId,
        'content': content,
        'threadId': _currentThreadId,
      });
      return true;
    } catch (e) {
      debugPrint('❌ Error editing message: $e');
      return false;
    }
  }

  /// Delete a message
  Future<bool> deleteMessage(String messageId) async {
    if (!isConnected || _currentThreadId == null) return false;

    try {
      _socket?.emit('delete_message', {
        'messageId': messageId,
        'threadId': _currentThreadId,
      });
      return true;
    } catch (e) {
      debugPrint('❌ Error deleting message: $e');
      return false;
    }
  }

  /// Add reaction to message
  Future<bool> addReaction(String messageId, String emoji) async {
    if (!isConnected || _currentThreadId == null) return false;

    try {
      _socket?.emit('add_reaction', {
        'messageId': messageId,
        'emoji': emoji,
        'threadId': _currentThreadId,
      });
      return true;
    } catch (e) {
      debugPrint('❌ Error adding reaction: $e');
      return false;
    }
  }

  /// Remove reaction from message
  Future<bool> removeReaction(String messageId, String emoji) async {
    if (!isConnected || _currentThreadId == null) return false;

    try {
      _socket?.emit('remove_reaction', {
        'messageId': messageId,
        'emoji': emoji,
        'threadId': _currentThreadId,
      });
      return true;
    } catch (e) {
      debugPrint('❌ Error removing reaction: $e');
      return false;
    }
  }

  /// Start typing indicator
  Future<bool> startTyping() async {
    if (!isConnected || _currentThreadId == null) return false;

    try {
      _socket?.emit('typing_start', {'threadId': _currentThreadId});
      return true;
    } catch (e) {
      debugPrint('❌ Error starting typing: $e');
      return false;
    }
  }

  /// Stop typing indicator
  Future<bool> stopTyping() async {
    if (!isConnected || _currentThreadId == null) return false;

    try {
      _socket?.emit('typing_stop', {'threadId': _currentThreadId});
      return true;
    } catch (e) {
      debugPrint('❌ Error stopping typing: $e');
      return false;
    }
  }

  /// Update user presence
  Future<bool> updatePresence(String status) async {
    if (!isConnected) return false;

    try {
      _socket?.emit('update_presence', {'status': status});
      return true;
    } catch (e) {
      debugPrint('❌ Error updating presence: $e');
      return false;
    }
  }

  /// Mark messages as read
  Future<bool> markAsRead({
    required String workspaceId,
    required String entityType,
    required String entityId,
    String? messageId,
  }) async {
    if (!isConnected) return false;

    try {
      _socket?.emit('mark_as_read', {
        'workspaceId': workspaceId,
        'entityType': entityType,
        'entityId': entityId,
        'messageId': messageId,
      });
      return true;
    } catch (e) {
      debugPrint('❌ Error marking as read: $e');
      return false;
    }
  }

  void _setupEventListeners() {
    if (_socket == null) return;

    // Connection events
    _socket!.onConnect((data) {
      debugPrint('✅ Socket connected');
      _updateConnectionState(SocketConnectionState.connected);
      _lastConnected = DateTime.now();
    });

    _socket!.onDisconnect((data) {
      debugPrint('❌ Socket disconnected: $data');
      _updateConnectionState(SocketConnectionState.disconnected);
      
      // Auto-reconnect after 2 seconds
      _reconnectTimer?.cancel();
      _reconnectTimer = Timer(const Duration(seconds: 2), () {
        if (_connectionState == SocketConnectionState.disconnected) {
          debugPrint('🔄 Attempting to reconnect...');
          connect().then((connected) {
            if (connected && _currentWorkspaceId != null && _currentThreadId != null) {
              // Rejoin workspace and thread after reconnection
              joinWorkspace(_currentWorkspaceId!);
              joinThread(_currentWorkspaceId!, _currentThreadId!);
            }
          });
        }
      });
    });

    _socket!.onConnectError((data) {
      debugPrint('❌ Socket connection error: $data');
      _updateConnectionState(SocketConnectionState.disconnected, data.toString());
    });

    _socket!.onError((data) {
      debugPrint('❌ Socket error: $data');
      _connectionError = data.toString();
      notifyListeners();
    });

    // Message events - Handle both Socket.IO sends and HTTP API broadcasts
    _socket!.on('new_message', (data) {
      try {
        debugPrint('📨 Received new_message event');
        debugPrint('📨 Raw data type: ${data.runtimeType}');
        debugPrint('📨 Full data: $data');
        
        // Handle both formats:
        // 1. Direct Socket.IO send: data IS the message
        // 2. HTTP API broadcast: data has {message, threadId, workspaceId}
        Map<String, dynamic> messageData;
        
        if (data is Map && data.containsKey('message')) {
          // HTTP API format
          debugPrint('📨 HTTP API format detected');
          messageData = Map<String, dynamic>.from(data['message']);
          debugPrint('📨 Message for thread: ${data['threadId']}');
        } else if (data is Map) {
          // Direct Socket.IO format
          debugPrint('📨 Direct Socket.IO format detected');
          messageData = Map<String, dynamic>.from(data);
        } else {
          debugPrint('❌ Unexpected data format: ${data.runtimeType}');
          return;
        }
        
        final message = Message.fromJson(messageData);
        debugPrint('✅ Message parsed: ${message.id} from ${message.senderName}');
        debugPrint('✅ Message thread_id: ${message.threadId}');
        debugPrint('✅ Current thread: $_currentThreadId');
        
        // Add to stream (chat_screen will filter by threadId)
        _messageStreamController.add(message);
        debugPrint('✅ Message added to stream');
      } catch (e, stackTrace) {
        debugPrint('❌ Error parsing new message: $e');
        debugPrint('❌ Stack trace: $stackTrace');
        debugPrint('❌ Raw data: $data');
      }
    });

    _socket!.on('message_edited', (data) {
      try {
        final update = MessageUpdate(
          messageId: data['messageId'],
          content: data['content'],
          threadId: data['threadId'],
          editedBy: data['editedBy'],
          editedAt: DateTime.parse(data['editedAt']),
          type: MessageUpdateType.edited,
        );
        _messageUpdateController.add(update);
      } catch (e) {
        debugPrint('❌ Error parsing message edit: $e');
      }
    });

    _socket!.on('message_deleted', (data) {
      try {
        final update = MessageUpdate(
          messageId: data['messageId'],
          threadId: data['threadId'],
          editedBy: data['deletedBy'],
          editedAt: DateTime.parse(data['deletedAt']),
          type: MessageUpdateType.deleted,
        );
        _messageUpdateController.add(update);
      } catch (e) {
        debugPrint('❌ Error parsing message deletion: $e');
      }
    });

    // Reaction events
    _socket!.on('reaction_added', (data) {
      try {
        final update = ReactionUpdate(
          messageId: data['messageId'],
          emoji: data['emoji'],
          userId: data['userId'],
          threadId: data['threadId'],
          type: ReactionUpdateType.added,
        );
        _reactionUpdateController.add(update);
      } catch (e) {
        debugPrint('❌ Error parsing reaction add: $e');
      }
    });

    _socket!.on('reaction_removed', (data) {
      try {
        final update = ReactionUpdate(
          messageId: data['messageId'],
          emoji: data['emoji'],
          userId: data['userId'],
          threadId: data['threadId'],
          type: ReactionUpdateType.removed,
        );
        _reactionUpdateController.add(update);
      } catch (e) {
        debugPrint('❌ Error parsing reaction removal: $e');
      }
    });

    // Typing events - Backend now sends flattened format with guaranteed fields
    _socket!.on('user_typing', (data) {
      try {
        debugPrint('⌨️ Raw user_typing event: $data');
        
        // Backend sends flattened format: {userId, userName, userAvatar, threadId, isTyping, timestamp}
        final threadId = data['threadId']?.toString() ?? '';
        final userId = data['userId']?.toString() ?? '';
        final userName = data['userName']?.toString() ?? 'User';
        final isTyping = data['isTyping'] == true;
        
        if (threadId.isEmpty || userId.isEmpty) {
          debugPrint('⚠️ Invalid typing event - missing threadId or userId');
          return;
        }
        
        _typingUsers[threadId] ??= <String>{};
        if (isTyping) {
          _typingUsers[threadId]!.add(userId);
        } else {
          _typingUsers[threadId]!.remove(userId);
        }

        final update = TypingUpdate(
          threadId: threadId,
          userId: userId,
          userName: userName,
          isTyping: isTyping,
          typingUsers: List.from(_typingUsers[threadId] ?? []),
        );
        
        debugPrint('✅ Typing event parsed: $userName ${isTyping ? "started" : "stopped"} typing in $threadId');
        _typingUpdateController.add(update);
      } catch (e, stackTrace) {
        debugPrint('❌ Error parsing typing event: $e');
        debugPrint('❌ Stack: $stackTrace');
        debugPrint('❌ Data: $data');
      }
    });

    // Presence events
    _socket!.on('presence_update', (data) {
      try {
        final update = PresenceUpdate(
          userId: data['userId'],
          status: data['status'],
          timestamp: DateTime.parse(data['timestamp']),
        );
        _presenceUpdateController.add(update);
      } catch (e) {
        debugPrint('❌ Error parsing presence update: $e');
      }
    });

    // Workspace/Thread events
    _socket!.on('workspace_joined', (data) {
      debugPrint('✅ CONFIRMED: Joined workspace: ${data['workspaceName']}');
      debugPrint('   Workspace ID: ${data['workspaceId']}');
    });

    _socket!.on('thread_joined', (data) {
      debugPrint('✅ CONFIRMED: Joined thread: ${data['threadName']}');
      debugPrint('   Thread ID: ${data['threadId']}');
      debugPrint('   Is Member: ${data['isMember']}');
      debugPrint('   🔔 Now listening for new_message events on this thread');
    });
    
    // Add a generic listener to catch ALL events for debugging
    _socket!.onAny((event, data) {
      if (event != 'user_typing') {  // Filter out typing spam
        debugPrint('🎯 Socket event received: $event');
      }
    });
  }

  void _updateConnectionState(SocketConnectionState state, [String? error]) {
    _connectionState = state;
    _connectionError = error;
    _connectionStateController.add(state);
    notifyListeners();
  }

  @override
  void dispose() {
    disconnect();
    _messageStreamController.close();
    _messageUpdateController.close();
    _reactionUpdateController.close();
    _typingUpdateController.close();
    _presenceUpdateController.close();
    _connectionStateController.close();
    super.dispose();
  }
}

// Data classes for events
class MessageUpdate {
  final String messageId;
  final String? content;
  final String threadId;
  final String editedBy;
  final DateTime editedAt;
  final MessageUpdateType type;

  MessageUpdate({
    required this.messageId,
    this.content,
    required this.threadId,
    required this.editedBy,
    required this.editedAt,
    required this.type,
  });
}

class ReactionUpdate {
  final String messageId;
  final String emoji;
  final String userId;
  final String threadId;
  final ReactionUpdateType type;

  ReactionUpdate({
    required this.messageId,
    required this.emoji,
    required this.userId,
    required this.threadId,
    required this.type,
  });
}

class TypingUpdate {
  final String threadId;
  final String userId;
  final String userName;
  final bool isTyping;
  final List<String> typingUsers;

  TypingUpdate({
    required this.threadId,
    required this.userId,
    required this.userName,
    required this.isTyping,
    required this.typingUsers,
  });
}

class PresenceUpdate {
  final String userId;
  final String status;
  final DateTime timestamp;

  PresenceUpdate({
    required this.userId,
    required this.status,
    required this.timestamp,
  });
}

enum SocketConnectionState {
  disconnected,
  connecting,
  connected,
  reconnecting,
}

enum MessageUpdateType {
  edited,
  deleted,
}

enum ReactionUpdateType {
  added,
  removed,
}
