import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../../../data/services/message_service.dart';
import '../../../data/services/socket_service.dart';
import '../../../data/models/message.dart';
import '../../../data/models/thread.dart';
import '../../widgets/chat/message_bubble.dart';
import '../../widgets/chat/message_composer.dart';
import '../../widgets/chat/typing_indicator.dart';
import 'dart:async';

class ChatScreen extends ConsumerStatefulWidget {
  final Map<String, dynamic> workspace;
  final Thread thread;
  
  const ChatScreen({
    super.key,
    required this.workspace,
    required this.thread,
  });

  @override
  ConsumerState<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends ConsumerState<ChatScreen> {
  final MessageService _messageService = MessageService();
  final SocketService _socketService = SocketService();
  final ScrollController _scrollController = ScrollController();
  final TextEditingController _messageController = TextEditingController();
  
  List<Message> _messages = [];
  bool _loading = true;
  bool _loadingMore = false;
  bool _hasMore = true;
  String? _currentUserId;
  Set<String> _typingUsers = {};
  
  StreamSubscription<Message>? _messageSubscription;
  StreamSubscription<MessageUpdate>? _messageUpdateSubscription;
  StreamSubscription<ReactionUpdate>? _reactionSubscription;
  StreamSubscription<TypingUpdate>? _typingSubscription;
  
  @override
  void initState() {
    super.initState();
    _initializeChat();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _messageSubscription?.cancel();
    _messageUpdateSubscription?.cancel();
    _reactionSubscription?.cancel();
    _typingSubscription?.cancel();
    _scrollController.dispose();
    _messageController.dispose();
    _socketService.leaveThread();
    super.dispose();
  }

  Future<void> _initializeChat() async {
    try {
      // Get current user FIRST - ensure authentication is ready
      final user = FirebaseAuth.instance.currentUser;
      if (user == null) {
        throw Exception('User not authenticated');
      }
      _currentUserId = user.uid;

      print('🚀 CHAT INIT - User: ${user.uid}');
      print('🚀 CHAT INIT - Workspace: ${widget.workspace['name']} (${widget.workspace['id']})');
      print('🚀 CHAT INIT - Thread: ${widget.thread.name} (${widget.thread.id})');

      // FORCE reconnect to ensure fresh Firebase token
      if (_socketService.isConnected) {
        print('🔄 Disconnecting existing socket connection...');
        _socketService.disconnect();
        await Future.delayed(Duration(milliseconds: 500));
      }
      
      // Connect with fresh Firebase auth token
      print('🔌 Connecting to Socket.IO...');
      final connected = await _socketService.connect();
      
      if (!connected) {
        throw Exception('Failed to connect to Socket.IO');
      }
      
      // WAIT for connection to be fully established
      int attempts = 0;
      while (!_socketService.isConnected && attempts < 30) {
        await Future.delayed(Duration(milliseconds: 100));
        attempts++;
      }
      
      if (!_socketService.isConnected) {
        throw Exception('Socket connection timeout after 3 seconds');
      }
      
      print('✅ Socket connected successfully');
      
      // Join the thread
      final workspaceId = widget.workspace['id'];
      if (workspaceId == null) {
        throw Exception('Workspace ID is required');
      }
      
      print('📝 Joining thread...');
      final joined = await _socketService.joinThread(
        workspaceId.toString(),
        widget.thread.id,
      );
      
      if (!joined) {
        print('⚠️ Failed to join thread, but continuing anyway');
      }
      
      print('✅ Chat initialization complete');
      
      // Setup real-time listeners
      _setupSocketListeners();
      
      // Load initial messages
      await _loadMessages();
      
      // Scroll to bottom after loading
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _scrollToBottom(animate: false);
      });
      
    } catch (e) {
      print('❌ Error initializing chat: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to initialize chat: $e'),
            duration: Duration(seconds: 5),
            action: SnackBarAction(
              label: 'Retry',
              onPressed: () => _initializeChat(),
            ),
          ),
        );
      }
    }
  }

  void _setupSocketListeners() {
    // Listen for new message NOTIFICATIONS (not full messages)
    // Industry standard: Socket.IO is just a ping, not message delivery
    _messageSubscription = _socketService.messageStream.listen((message) {
      print('🔔 New message notification received for thread: ${message.threadId}');
      
      // Refresh messages from HTTP API (reliable source of truth)
      if (message.threadId == widget.thread.id) {
        print('🔄 Refreshing messages from API due to Socket.IO notification');
        _loadMessages(loadMore: false);
      }
    });

    // Listen for message updates (edits/deletes)
    _messageUpdateSubscription = _socketService.messageUpdateStream.listen((update) {
      if (update.threadId == widget.thread.id) {
        setState(() {
          final index = _messages.indexWhere((m) => m.id == update.messageId);
          if (index != -1) {
            if (update.type == MessageUpdateType.edited && update.content != null) {
              _messages[index] = _messages[index].copyWith(
                content: update.content,
                isEdited: true,
                updatedAt: update.editedAt,
              );
            } else if (update.type == MessageUpdateType.deleted) {
              _messages[index] = _messages[index].copyWith(
                isDeleted: true,
                content: '[Message deleted]',
              );
            }
          }
        });
      }
    });

    // Listen for reactions
    _reactionSubscription = _socketService.reactionUpdateStream.listen((update) {
      if (update.threadId == widget.thread.id) {
        // Reload message reactions (simplified for now)
        _refreshMessage(update.messageId);
      }
    });

    // Listen for typing indicators
    _typingSubscription = _socketService.typingUpdateStream.listen((update) {
      if (update.threadId == widget.thread.id && update.userId != _currentUserId) {
        setState(() {
          if (update.isTyping) {
            _typingUsers.add(update.userName);
          } else {
            _typingUsers.remove(update.userName);
          }
        });
      }
    });
  }

  Future<void> _loadMessages({bool loadMore = false}) async {
    if (loadMore && (!_hasMore || _loadingMore)) return;
    
    setState(() {
      if (loadMore) {
        _loadingMore = true;
      } else {
        _loading = true;
      }
    });

    try {
      // FIXED: Properly extract workspace ID from Map
      final workspaceId = widget.workspace['id'];
      if (workspaceId == null) {
        throw Exception('Workspace ID is null');
      }
      
      print('📨 Loading messages for workspace: $workspaceId, thread: ${widget.thread.id}');
      print('📨 Offset: ${loadMore ? _messages.length : 0}, Limit: 50');

      final response = await _messageService.getMessages(
        workspaceId: workspaceId.toString(), // Ensure it's a string
        threadId: widget.thread.id,
        limit: 50,
        offset: loadMore ? _messages.length : 0,
      );

      print('✅ Successfully loaded ${response.messages.length} messages from API');

      setState(() {
        if (loadMore) {
          _messages.addAll(response.messages);
        } else {
          _messages = response.messages;
        }
        _hasMore = response.pagination.hasMore;
        _loading = false;
        _loadingMore = false;
      });

      // Mark messages as read (ignore errors if endpoint doesn't exist)
      if (_messages.isNotEmpty) {
        try {
          await _messageService.markMessagesAsRead(
            workspaceId: workspaceId.toString(),
            threadId: widget.thread.id,
          );
        } catch (e) {
          print('⚠️ Could not mark messages as read (non-critical): $e');
          // Ignore - this is not critical for viewing messages
        }
      }
    } catch (e) {
      print('❌ Error loading messages from API: $e');
      
      // NO DEMO DATA - Show the error to the user
      setState(() {
        _messages = [];
        _hasMore = false;
        _loading = false;
        _loadingMore = false;
      });
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to load messages: $e'),
            duration: const Duration(seconds: 5),
            action: SnackBarAction(
              label: 'Retry',
              onPressed: () => _loadMessages(),
            ),
          ),
        );
      }
    }
  }


  Future<void> _refreshMessage(String messageId) async {
    // Simplified: reload all messages (can be optimized to reload single message)
    try {
      final workspaceId = widget.workspace['id'];
      if (workspaceId == null) return;
      
      final response = await _messageService.getMessages(
        workspaceId: workspaceId.toString(),
        threadId: widget.thread.id,
        limit: _messages.length,
      );
      
      setState(() {
        _messages = response.messages;
      });
    } catch (e) {
      print('❌ Error refreshing message: $e');
    }
  }

  void _onScroll() {
    // Load more when scrolling to top
    if (_scrollController.position.pixels >= _scrollController.position.maxScrollExtent - 200) {
      _loadMessages(loadMore: true);
    }
  }

  void _scrollToBottom({bool animate = true}) {
    if (_scrollController.hasClients) {
      if (animate) {
        _scrollController.animateTo(
          0,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      } else {
        _scrollController.jumpTo(0);
      }
    }
  }

  Future<void> _sendMessage(String content) async {
    if (content.trim().isEmpty) return;

    try {
      // Create optimistic message
      final tempId = 'temp_${DateTime.now().millisecondsSinceEpoch}';
      final user = FirebaseAuth.instance.currentUser;
      
      final tempMessage = Message.temp(
        tempId: tempId,
        content: content.trim(),
        senderId: _currentUserId ?? '',
        senderName: user?.displayName ?? 'You',
        senderAvatar: user?.photoURL,
        threadId: widget.thread.id,
      );

      // Add to UI immediately
      setState(() {
        _messages.insert(0, tempMessage);
      });

      // Clear input
      _messageController.clear();
      _scrollToBottom();

      // ALWAYS use HTTP API for reliability
      final workspaceId = widget.workspace['id'];
      if (workspaceId != null) {
        print('📤 Sending message via HTTP API: "$content"');
        final sentMessage = await _messageService.sendMessage(
          workspaceId: workspaceId.toString(),
          threadId: widget.thread.id,
          content: content.trim(),
        );
        
        print('✅ Message sent successfully! ID: ${sentMessage.id}');
        
        // Replace temp message with real one from API immediately
        if (mounted) {
          setState(() {
            final tempIndex = _messages.indexWhere((m) => m.id == tempId);
            if (tempIndex != -1) {
              print('🔄 Replacing temp message ${tempId} with real message ${sentMessage.id}');
              _messages[tempIndex] = sentMessage;
            } else {
              print('⚠️ Temp message not found for replacement!');
            }
          });
        }
      }

    } catch (e) {
      print('❌ Error sending message: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to send message')),
        );
      }
    }
  }

  Future<void> _editMessage(Message message, String newContent) async {
    try {
      final workspaceId = widget.workspace['id'];
      if (workspaceId == null) return;
      
      await _messageService.editMessage(
        workspaceId: workspaceId.toString(),
        threadId: widget.thread.id,
        messageId: message.id,
        content: newContent,
      );
      
      // Socket will handle the update
    } catch (e) {
      print('❌ Error editing message: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to edit message')),
        );
      }
    }
  }

  Future<void> _deleteMessage(Message message) async {
    try {
      final workspaceId = widget.workspace['id'];
      if (workspaceId == null) return;
      
      await _messageService.deleteMessage(
        workspaceId: workspaceId.toString(),
        threadId: widget.thread.id,
        messageId: message.id,
      );
      
      // Socket will handle the update
    } catch (e) {
      print('❌ Error deleting message: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to delete message')),
        );
      }
    }
  }

  Future<void> _addReaction(Message message, String emoji) async {
    try {
      final workspaceId = widget.workspace['id'];
      if (workspaceId == null) return;
      
      await _messageService.addReaction(
        workspaceId: workspaceId.toString(),
        threadId: widget.thread.id,
        messageId: message.id,
        emoji: emoji,
      );
    } catch (e) {
      print('❌ Error adding reaction: $e');
    }
  }

  void _showMessageActions(Message message) {
    final isOwnMessage = message.senderId == _currentUserId;
    
    showModalBottomSheet(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (isOwnMessage) ...[
              ListTile(
                leading: const Icon(Icons.edit, color: Colors.blue),
                title: const Text('Edit Message'),
                onTap: () {
                  Navigator.pop(context);
                  _showEditDialog(message);
                },
              ),
              ListTile(
                leading: const Icon(Icons.delete, color: Colors.red),
                title: const Text('Delete Message'),
                onTap: () {
                  Navigator.pop(context);
                  _showDeleteConfirmation(message);
                },
              ),
            ],
            ListTile(
              leading: const Icon(Icons.emoji_emotions, color: Colors.orange),
              title: const Text('Add Reaction'),
              onTap: () {
                Navigator.pop(context);
                _showReactionPicker(message);
              },
            ),
            ListTile(
              leading: const Icon(Icons.reply, color: Colors.green),
              title: const Text('Reply'),
              onTap: () {
                Navigator.pop(context);
                // TODO: Implement reply functionality
              },
            ),
          ],
        ),
      ),
    );
  }

  void _showEditDialog(Message message) {
    final editController = TextEditingController(text: message.content);
    
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Edit Message'),
        content: TextField(
          controller: editController,
          maxLines: 3,
          decoration: const InputDecoration(
            hintText: 'Enter new message...',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              final newContent = editController.text.trim();
              if (newContent.isNotEmpty && newContent != message.content) {
                _editMessage(message, newContent);
              }
              Navigator.pop(context);
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  void _showDeleteConfirmation(Message message) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Message'),
        content: const Text('Are you sure you want to delete this message?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () {
              _deleteMessage(message);
              Navigator.pop(context);
            },
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }

  void _showReactionPicker(Message message) {
    // Business-focused emojis matching React app
    final emojis = ['👍', '❤️', '😂', '🎉', '🔥', '👀', '✅', '🚀'];
    
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Add Reaction'),
        content: Wrap(
          spacing: 12,
          runSpacing: 12,
          children: emojis.map((emoji) => GestureDetector(
            onTap: () {
              _addReaction(message, emoji);
              Navigator.pop(context);
            },
            child: Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Colors.grey.shade100,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(emoji, style: const TextStyle(fontSize: 24)),
            ),
          )).toList(),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              widget.thread.type == 'channel' 
                ? '#${widget.thread.name}' 
                : widget.thread.name,
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            if (widget.thread.description != null)
              Text(
                widget.thread.description!,
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.normal),
              ),
          ],
        ),
        backgroundColor: Colors.blue.shade600,
        foregroundColor: Colors.white,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.info_outline),
            onPressed: () {
              // TODO: Show channel info
            },
          ),
        ],
      ),
      body: Column(
        children: [
          // Messages list
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _messages.isEmpty
                    ? _buildEmptyState()
                    : _buildMessageList(),
          ),
          
          // Typing indicator
          if (_typingUsers.isNotEmpty)
            TypingIndicator(userNames: _typingUsers.toList()),
          
          // Message composer
          MessageComposer(
            controller: _messageController,
            onSend: _sendMessage,
            onTypingChanged: (isTyping) {
              if (isTyping) {
                _socketService.startTyping();
              } else {
                _socketService.stopTyping();
              }
            },
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.chat_bubble_outline, size: 64, color: Colors.grey.shade400),
          const SizedBox(height: 16),
          Text(
            'No messages yet',
            style: TextStyle(fontSize: 18, color: Colors.grey.shade600),
          ),
          const SizedBox(height: 8),
          Text(
            'Start the conversation!',
            style: TextStyle(fontSize: 14, color: Colors.grey.shade500),
          ),
        ],
      ),
    );
  }

  Widget _buildMessageList() {
    return RefreshIndicator(
      onRefresh: () => _loadMessages(loadMore: false),
      child: ListView.builder(
        controller: _scrollController,
        reverse: true, // Start from bottom
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        itemCount: _messages.length + (_loadingMore ? 1 : 0),
        itemBuilder: (context, index) {
          if (index == _messages.length) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(16),
                child: CircularProgressIndicator(),
              ),
            );
          }

          final message = _messages[index];
          final isOwnMessage = message.senderId == _currentUserId;
          
          // Check if we should show date divider
          final showDateDivider = index == _messages.length - 1 ||
              !_isSameDay(message.createdAt, _messages[index + 1].createdAt);

          return Column(
            children: [
              if (showDateDivider) _buildDateDivider(message.createdAt),
              MessageBubble(
                message: message,
                isOwnMessage: isOwnMessage,
                onLongPress: () => _showMessageActions(message),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildDateDivider(DateTime date) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final messageDate = DateTime(date.year, date.month, date.day);
    
    String dateText;
    if (messageDate == today) {
      dateText = 'Today';
    } else if (messageDate == today.subtract(const Duration(days: 1))) {
      dateText = 'Yesterday';
    } else {
      dateText = '${date.month}/${date.day}/${date.year}';
    }

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Row(
        children: [
          Expanded(child: Divider(color: Colors.grey.shade300)),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Text(
              dateText,
              style: TextStyle(
                fontSize: 12,
                color: Colors.grey.shade600,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          Expanded(child: Divider(color: Colors.grey.shade300)),
        ],
      ),
    );
  }

  bool _isSameDay(DateTime date1, DateTime date2) {
    return date1.year == date2.year &&
           date1.month == date2.month &&
           date1.day == date2.day;
  }
}
