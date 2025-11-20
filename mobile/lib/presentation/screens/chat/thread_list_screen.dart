import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../data/models/thread.dart';
import '../../../data/services/message_service.dart';
import '../../providers/socket_provider.dart';
import 'chat_screen.dart';

class ThreadListScreen extends ConsumerStatefulWidget {
  final String workspaceId;
  final String workspaceName;

  const ThreadListScreen({
    super.key,
    required this.workspaceId,
    required this.workspaceName,
  });

  @override
  ConsumerState<ThreadListScreen> createState() => _ThreadListScreenState();
}

class _ThreadListScreenState extends ConsumerState<ThreadListScreen> with AutomaticKeepAliveClientMixin {
  final MessageService _messageService = MessageService();
  final TextEditingController _searchController = TextEditingController();
  List<Thread> _threads = [];
  List<Thread> _filteredThreads = [];
  bool _isLoading = true;
  String? _error;
  String _filter = 'all'; // 'all', 'channels', 'dms'

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _loadThreads();
    _searchController.addListener(_filterThreads);
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadThreads() async {
    try {
      setState(() {
        _isLoading = true;
        _error = null;
      });

      final threads = await _messageService.getThreads(
        workspaceId: widget.workspaceId,
      );

      setState(() {
        _threads = threads;
        _filteredThreads = threads;
        _isLoading = false;
      });

      // Join workspace via socket
      final socketActions = ref.read(socketActionsProvider);
      await socketActions.joinWorkspace(widget.workspaceId);
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  void _filterThreads() {
    final query = _searchController.text.toLowerCase();
    setState(() {
      _filteredThreads = _threads.where((thread) {
        final matchesSearch = query.isEmpty || 
            thread.displayName.toLowerCase().contains(query) ||
            (thread.description?.toLowerCase().contains(query) ?? false);
        
        final matchesFilter = _filter == 'all' ||
            (_filter == 'channels' && thread.isChannel) ||
            (_filter == 'dms' && thread.isDM);
        
        return matchesSearch && matchesFilter;
      }).toList();
    });
  }

  void _setFilter(String filter) {
    setState(() {
      _filter = filter;
    });
    _filterThreads();
  }

  Future<void> _joinThread(Thread thread) async {
    try {
      // Navigate to chat screen
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (context) => ChatScreen(
            workspaceId: widget.workspaceId,
            threadId: thread.id,
            threadName: thread.displayName,
            threadType: thread.type,
          ),
        ),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to join ${thread.displayName}: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    
    return Scaffold(
      backgroundColor: Colors.grey.shade50,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              widget.workspaceName,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: Colors.black87,
              ),
            ),
            Text(
              'Chat & Channels',
              style: TextStyle(
                fontSize: 12,
                color: Colors.grey.shade600,
              ),
            ),
          ],
        ),
        actions: [
          // Socket connection indicator
          Consumer(
            builder: (context, ref, child) {
              final socketStatus = ref.watch(socketStatusProvider);
              return Container(
                margin: const EdgeInsets.only(right: 16),
                child: Row(
                  children: [
                    Container(
                      width: 8,
                      height: 8,
                      decoration: BoxDecoration(
                        color: socketStatus.isConnected 
                            ? Colors.green 
                            : socketStatus.isConnecting
                                ? Colors.orange
                                : Colors.red,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      socketStatus.isConnected 
                          ? 'Online'
                          : socketStatus.isConnecting
                              ? 'Connecting'
                              : 'Offline',
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.grey.shade600,
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        ],
      ),
      body: Column(
        children: [
          // Search bar
          Container(
            color: Colors.white,
            padding: const EdgeInsets.all(16),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: 'Search channels and messages',
                prefixIcon: const Icon(Icons.search),
                filled: true,
                fillColor: Colors.grey.shade100,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
                contentPadding: const EdgeInsets.symmetric(horizontal: 16),
              ),
            ),
          ),

          // Filter tabs
          Container(
            color: Colors.white,
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: [
                  _FilterChip(
                    label: 'All',
                    isSelected: _filter == 'all',
                    onTap: () => _setFilter('all'),
                  ),
                  const SizedBox(width: 8),
                  _FilterChip(
                    label: 'Channels',
                    isSelected: _filter == 'channels',
                    onTap: () => _setFilter('channels'),
                  ),
                  const SizedBox(width: 8),
                  _FilterChip(
                    label: 'Direct Messages',
                    isSelected: _filter == 'dms',
                    onTap: () => _setFilter('dms'),
                  ),
                ],
              ),
            ),
          ),

          const Divider(height: 1),

          // Thread list
          Expanded(
            child: _buildThreadList(),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          // TODO: Add new channel/DM creation
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Channel creation coming in Phase 4!')),
          );
        },
        backgroundColor: Colors.blue.shade600,
        child: const Icon(Icons.add, color: Colors.white),
      ),
    );
  }

  Widget _buildThreadList() {
    if (_isLoading) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            CircularProgressIndicator(),
            SizedBox(height: 16),
            Text(
              'Loading channels...',
              style: TextStyle(
                color: Colors.grey,
                fontSize: 16,
              ),
            ),
          ],
        ),
      );
    }

    if (_error != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(
              Icons.error_outline,
              size: 64,
              color: Colors.red,
            ),
            const SizedBox(height: 16),
            Text(
              'Failed to load channels',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Colors.grey.shade700,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              _error!,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Colors.grey.shade500,
              ),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: _loadThreads,
              child: const Text('Retry'),
            ),
          ],
        ),
      );
    }

    if (_filteredThreads.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              _searchController.text.isEmpty 
                  ? Icons.forum_outlined 
                  : Icons.search_off,
              size: 64,
              color: Colors.grey.shade400,
            ),
            const SizedBox(height: 16),
            Text(
              _searchController.text.isEmpty
                  ? 'No channels found'
                  : 'No results found',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Colors.grey.shade700,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              _searchController.text.isEmpty
                  ? 'Create your first channel to get started'
                  : 'Try a different search term',
              style: TextStyle(
                color: Colors.grey.shade500,
              ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadThreads,
      child: ListView.builder(
        itemCount: _filteredThreads.length,
        itemBuilder: (context, index) {
          final thread = _filteredThreads[index];
          return _ThreadListItem(
            thread: thread,
            onTap: () => _joinThread(thread),
          );
        },
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  const _FilterChip({
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? Colors.blue.shade50 : Colors.transparent,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected ? Colors.blue.shade300 : Colors.grey.shade300,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: isSelected ? Colors.blue.shade700 : Colors.grey.shade700,
            fontWeight: isSelected ? FontWeight.w500 : FontWeight.normal,
            fontSize: 14,
          ),
        ),
      ),
    );
  }
}

class _ThreadListItem extends StatelessWidget {
  final Thread thread;
  final VoidCallback onTap;

  const _ThreadListItem({
    required this.thread,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: thread.isPrivateChannel 
              ? Colors.orange.shade100
              : thread.isDM 
                  ? Colors.green.shade100
                  : Colors.blue.shade100,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Icon(
          thread.isPrivateChannel 
              ? Icons.lock
              : thread.isDM 
                  ? Icons.person
                  : Icons.tag,
          color: thread.isPrivateChannel 
              ? Colors.orange.shade700
              : thread.isDM 
                  ? Colors.green.shade700
                  : Colors.blue.shade700,
          size: 20,
        ),
      ),
      title: Row(
        children: [
          Text(thread.threadPrefix),
          const SizedBox(width: 4),
          Expanded(
            child: Text(
              thread.displayName,
              style: const TextStyle(
                fontWeight: FontWeight.w500,
                fontSize: 16,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          if (thread.hasUnread) ...[
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: Colors.red,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                thread.unreadCount > 99 ? '99+' : thread.unreadCount.toString(),
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ],
        ],
      ),
      subtitle: thread.lastMessage != null
          ? Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 4),
                Text(
                  '${thread.lastMessage!.senderName}: ${thread.lastMessage!.previewContent}',
                  style: TextStyle(
                    color: Colors.grey.shade600,
                    fontSize: 14,
                  ),
                  overflow: TextOverflow.ellipsis,
                  maxLines: 1,
                ),
                const SizedBox(height: 2),
                Text(
                  thread.lastMessage!.timeAgo,
                  style: TextStyle(
                    color: Colors.grey.shade500,
                    fontSize: 12,
                  ),
                ),
              ],
            )
          : thread.description != null
              ? Text(
                  thread.description!,
                  style: TextStyle(
                    color: Colors.grey.shade600,
                    fontSize: 14,
                  ),
                  overflow: TextOverflow.ellipsis,
                  maxLines: 1,
                )
              : null,
      trailing: thread.hasMentions
          ? Container(
              width: 8,
              height: 8,
              decoration: const BoxDecoration(
                color: Colors.red,
                shape: BoxShape.circle,
              ),
            )
          : null,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      onTap: onTap,
    );
  }
}
