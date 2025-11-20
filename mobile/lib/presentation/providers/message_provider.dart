import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../../data/models/message.dart';
import '../../data/models/reaction.dart';
import '../../data/models/mention.dart';
import '../../data/services/socket_service.dart';
import 'socket_provider.dart';

// Message state notifier for a specific thread
class MessageNotifier extends FamilyAsyncNotifier<List<Message>, String> {
  String? _threadId;
  String? _workspaceId;
  final List<Message> _messages = [];
  StreamSubscription<Message>? _messageSubscription;
  StreamSubscription<MessageUpdate>? _updateSubscription;

  @override
  Future<List<Message>> build(String threadId) async {
    // Initialize with the provided threadId
    _threadId = threadId;
    return [];
  }

  void initialize(String workspaceId, String threadId) {
    _workspaceId = workspaceId;
    _threadId = threadId;
    _setupSocketListeners();
  }

  void _setupSocketListeners() {
    final socketService = ref.read(socketServiceProvider);
    
    // Listen for new messages
    _messageSubscription?.cancel();
    _messageSubscription = socketService.messageStream
        .where((message) => message.threadId == _threadId)
        .listen((message) {
      _addMessage(message);
    });

    // Listen for message updates (edits, deletes)
    _updateSubscription?.cancel();
    _updateSubscription = socketService.messageUpdateStream
        .where((update) => update.threadId == _threadId)
        .listen((update) {
      _handleMessageUpdate(update);
    });
  }

  void loadMessages(List<Message> messages) {
    _messages.clear();
    _messages.addAll(messages.reversed); // Reverse for chronological order
    state = AsyncData(List.from(_messages));
  }

  void _addMessage(Message message) {
    // Check if this is an update to a temporary message
    final tempIndex = _messages.indexWhere((m) => 
        m.isTemp && m.tempId == message.id);
    
    if (tempIndex != -1) {
      // Replace temporary message with real one
      _messages[tempIndex] = message.copyWith(status: MessageStatus.sent);
    } else {
      // Add new message
      _messages.add(message);
    }
    
    // Sort by creation time to maintain order
    _messages.sort((a, b) => a.createdAt.compareTo(b.createdAt));
    state = AsyncData(List.from(_messages));
  }

  void addOptimisticMessage(Message tempMessage) {
    _messages.add(tempMessage);
    _messages.sort((a, b) => a.createdAt.compareTo(b.createdAt));
    state = AsyncData(List.from(_messages));
  }

  void markMessageFailed(String tempId) {
    final index = _messages.indexWhere((m) => 
        m.isTemp && m.tempId == tempId);
    
    if (index != -1) {
      _messages[index] = _messages[index].copyWith(status: MessageStatus.failed);
      state = AsyncData(List.from(_messages));
    }
  }

  void _handleMessageUpdate(MessageUpdate update) {
    final index = _messages.indexWhere((m) => m.id == update.messageId);
    if (index == -1) return;

    switch (update.type) {
      case MessageUpdateType.edited:
        if (update.content != null) {
          _messages[index] = _messages[index].copyWith(
            content: update.content!,
            isEdited: true,
            updatedAt: update.editedAt,
          );
        }
        break;
      case MessageUpdateType.deleted:
        _messages[index] = _messages[index].copyWith(
          isDeleted: true,
          updatedAt: update.editedAt,
        );
        break;
    }
    
    state = AsyncData(List.from(_messages));
  }

  void updateMessageReactions(String messageId, List<Reaction> reactions) {
    final index = _messages.indexWhere((m) => m.id == messageId);
    if (index != -1) {
      _messages[index] = _messages[index].copyWith(reactions: reactions);
      state = AsyncData(List.from(_messages));
    }
  }

  void retryFailedMessage(Message failedMessage) async {
    if (!failedMessage.hasFailed) return;

    // Mark as sending again
    final index = _messages.indexWhere((m) => m.id == failedMessage.id);
    if (index != -1) {
      _messages[index] = _messages[index].copyWith(status: MessageStatus.sending);
      state = AsyncData(List.from(_messages));
    }

    // Try to send again
    final socketActions = ref.read(socketActionsProvider);
    final success = await socketActions.sendMessage(
      content: failedMessage.content,
      messageType: failedMessage.messageType,
      parentMessageId: failedMessage.parentMessageId,
      messageId: failedMessage.tempId,
    );

    if (!success && index != -1) {
      _messages[index] = _messages[index].copyWith(status: MessageStatus.failed);
      state = AsyncData(List.from(_messages));
    }
  }

  void cleanup() {
    _messageSubscription?.cancel();
    _updateSubscription?.cancel();
  }
}

// Provider for message state in a specific thread
final messageProvider = AsyncNotifierProvider.family<MessageNotifier, List<Message>, String>(
  () => MessageNotifier(),
);

// Provider for message actions
final messageActionsProvider = Provider.family<MessageActions, String>((ref, threadId) {
  return MessageActions(ref, threadId);
});

// Provider for typing users in a thread
final typingUsersProvider = StreamProvider.family<List<String>, String>((ref, threadId) {
  final socketService = ref.read(socketServiceProvider);
  return socketService.typingUpdateStream
      .where((update) => update.threadId == threadId)
      .map((update) => update.typingUsers);
});

class MessageActions {
  final Ref ref;
  final String threadId;

  MessageActions(this.ref, this.threadId);

  Future<bool> sendMessage({
    required String content,
    String messageType = 'text',
    String? parentMessageId,
    List<Map<String, dynamic>>? mentions,
    List<Map<String, dynamic>>? attachments,
  }) async {
    final socketActions = ref.read(socketActionsProvider);
    final messageNotifier = ref.read(messageProvider(threadId).notifier);
    
    // Generate temporary ID and create optimistic message
    final tempId = 'temp_${DateTime.now().millisecondsSinceEpoch}';
    final user = ref.read(authUserProvider); // Assuming this exists
    
    if (user == null) return false;

    final tempMessage = Message.temp(
      tempId: tempId,
      content: content,
      senderId: user.uid,
      senderName: user.displayName ?? 'Unknown',
      senderAvatar: user.photoURL,
      threadId: threadId,
      parentMessageId: parentMessageId,
      messageType: messageType,
      mentions: mentions?.map((m) => Mention.fromJson(m)).toList(),
    );

    // Add optimistic message
    messageNotifier.addOptimisticMessage(tempMessage);

    // Send via socket
    final success = await socketActions.sendMessage(
      content: content,
      messageType: messageType,
      parentMessageId: parentMessageId,
      mentions: mentions,
      attachments: attachments,
      messageId: tempId,
    );

    if (!success) {
      // Mark as failed
      messageNotifier.markMessageFailed(tempId);
    }

    return success;
  }

  Future<bool> editMessage(String messageId, String content) async {
    final socketActions = ref.read(socketActionsProvider);
    return await socketActions.editMessage(messageId, content);
  }

  Future<bool> deleteMessage(String messageId) async {
    final socketActions = ref.read(socketActionsProvider);
    return await socketActions.deleteMessage(messageId);
  }

  Future<bool> addReaction(String messageId, String emoji) async {
    final socketActions = ref.read(socketActionsProvider);
    return await socketActions.addReaction(messageId, emoji);
  }

  Future<bool> removeReaction(String messageId, String emoji) async {
    final socketActions = ref.read(socketActionsProvider);
    return await socketActions.removeReaction(messageId, emoji);
  }

  Future<bool> startTyping() async {
    final socketActions = ref.read(socketActionsProvider);
    return await socketActions.startTyping();
  }

  Future<bool> stopTyping() async {
    final socketActions = ref.read(socketActionsProvider);
    return await socketActions.stopTyping();
  }

  void retryMessage(Message failedMessage) {
    final messageNotifier = ref.read(messageProvider(threadId).notifier);
    messageNotifier.retryFailedMessage(failedMessage);
  }
}

// Temporary auth user provider (this should be imported from auth provider)
final authUserProvider = Provider<User?>((ref) {
  // This would typically watch FirebaseAuth.instance.authStateChanges()
  // For now, return current user
  return FirebaseAuth.instance.currentUser;
});
