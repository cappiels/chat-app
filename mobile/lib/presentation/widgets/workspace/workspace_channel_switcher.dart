import 'package:flutter/material.dart';
import '../../../data/models/thread.dart';
import '../../../data/models/workspace.dart';
import '../../../data/services/http_client.dart';

/// Unified Workspace-Channel Switcher Widget
/// Shows current location and opens picker to jump to any workspace/channel in one tap
class WorkspaceChannelSwitcher extends StatefulWidget {
  final Map<String, dynamic> currentWorkspace;
  final Thread? currentChannel;
  final List<Thread> channels;
  final Function(Thread) onChannelSelect;
  final Function(Workspace, Thread)? onWorkspaceChannelSelect;
  final VoidCallback? onWorkspaceSwitch;

  const WorkspaceChannelSwitcher({
    super.key,
    required this.currentWorkspace,
    this.currentChannel,
    required this.channels,
    required this.onChannelSelect,
    this.onWorkspaceChannelSelect,
    this.onWorkspaceSwitch,
  });

  @override
  State<WorkspaceChannelSwitcher> createState() => _WorkspaceChannelSwitcherState();
}

class _WorkspaceChannelSwitcherState extends State<WorkspaceChannelSwitcher> {
  final HttpClient _httpClient = HttpClient();
  List<Map<String, dynamic>> _allWorkspacesWithChannels = [];
  bool _loading = false;

  void _showUnifiedPicker() async {
    // Load all workspaces and channels first
    setState(() => _loading = true);

    try {
      // Get all workspaces
      final workspacesResponse = await _httpClient.get('/api/workspaces');
      final workspaces = List<Map<String, dynamic>>.from(workspacesResponse.data['workspaces'] ?? []);

      // Get channels for each workspace
      List<Map<String, dynamic>> workspacesWithChannels = [];
      for (final workspace in workspaces) {
        try {
          final channelsResponse = await _httpClient.get('/api/workspaces/${workspace['id']}/threads');
          final channels = List<Map<String, dynamic>>.from(channelsResponse.data['threads'] ?? []);
          workspacesWithChannels.add({
            'workspace': workspace,
            'channels': channels,
          });
        } catch (e) {
          // If we can't load channels for a workspace, still include it with empty channels
          workspacesWithChannels.add({
            'workspace': workspace,
            'channels': [],
          });
        }
      }

      _allWorkspacesWithChannels = workspacesWithChannels;
    } catch (e) {
      print('Error loading workspaces: $e');
      // Fall back to current workspace only
      _allWorkspacesWithChannels = [
        {
          'workspace': widget.currentWorkspace,
          'channels': widget.channels.map((t) => {
            'id': t.id,
            'name': t.name,
            'workspace_id': t.workspaceId,
          }).toList(),
        }
      ];
    }

    setState(() => _loading = false);

    if (!mounted) return;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _UnifiedPickerSheet(
        workspacesWithChannels: _allWorkspacesWithChannels,
        currentWorkspaceId: widget.currentWorkspace['id'],
        currentChannelId: widget.currentChannel?.id,
        onSelect: (workspace, channel) {
          Navigator.pop(context);

          // Check if switching to different workspace
          if (workspace['id'] != widget.currentWorkspace['id']) {
            // Need to switch workspace first
            if (widget.onWorkspaceChannelSelect != null) {
              final ws = Workspace(
                id: workspace['id'],
                name: workspace['name'] ?? '',
                description: workspace['description'],
                ownerId: workspace['owner_id'] ?? '',
                createdAt: DateTime.now(),
                memberCount: workspace['member_count'] ?? 0,
                channelCount: workspace['channel_count'] ?? 0,
                role: workspace['role'] ?? workspace['user_role'] ?? 'member',
                settings: workspace['settings'] ?? {},
              );
              final thread = Thread(
                id: channel['id'],
                name: channel['name'] ?? '',
                type: channel['type'] ?? 'channel',
                workspaceId: workspace['id'],
                createdAt: DateTime.now(),
                updatedAt: DateTime.now(),
              );
              widget.onWorkspaceChannelSelect!(ws, thread);
            } else if (widget.onWorkspaceSwitch != null) {
              widget.onWorkspaceSwitch!();
            }
          } else {
            // Same workspace, just switch channel
            final thread = Thread(
              id: channel['id'],
              name: channel['name'] ?? '',
              type: channel['type'] ?? 'channel',
              workspaceId: widget.currentWorkspace['id'],
              createdAt: DateTime.now(),
              updatedAt: DateTime.now(),
            );
            widget.onChannelSelect(thread);
          }
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final workspaceName = widget.currentWorkspace['name'] ?? 'Workspace';
    final channelName = widget.currentChannel?.name ?? 'Select channel';

    return InkWell(
      onTap: _loading ? null : _showUnifiedPicker,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Workspace icon
            Container(
              width: 24,
              height: 24,
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.2),
                borderRadius: BorderRadius.circular(6),
              ),
              child: const Icon(
                Icons.workspaces,
                size: 14,
                color: Colors.white,
              ),
            ),
            const SizedBox(width: 8),

            // Workspace > Channel
            Flexible(
              child: Text(
                '$workspaceName > #$channelName',
                style: const TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 14,
                  color: Colors.white,
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ),

            const SizedBox(width: 4),

            // Dropdown indicator
            _loading
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : const Icon(
                    Icons.keyboard_arrow_down,
                    size: 18,
                    color: Colors.white,
                  ),
          ],
        ),
      ),
    );
  }
}

/// Unified bottom sheet showing all workspaces and channels
class _UnifiedPickerSheet extends StatefulWidget {
  final List<Map<String, dynamic>> workspacesWithChannels;
  final String? currentWorkspaceId;
  final String? currentChannelId;
  final Function(Map<String, dynamic> workspace, Map<String, dynamic> channel) onSelect;

  const _UnifiedPickerSheet({
    required this.workspacesWithChannels,
    this.currentWorkspaceId,
    this.currentChannelId,
    required this.onSelect,
  });

  @override
  State<_UnifiedPickerSheet> createState() => _UnifiedPickerSheetState();
}

class _UnifiedPickerSheetState extends State<_UnifiedPickerSheet> {
  String _searchQuery = '';
  final TextEditingController _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<Map<String, dynamic>> get _filteredData {
    if (_searchQuery.isEmpty) {
      return widget.workspacesWithChannels;
    }

    final query = _searchQuery.toLowerCase();
    List<Map<String, dynamic>> filtered = [];

    for (final item in widget.workspacesWithChannels) {
      final workspace = item['workspace'] as Map<String, dynamic>;
      final channels = List<Map<String, dynamic>>.from(item['channels'] ?? []);

      // Filter channels that match
      final matchingChannels = channels.where((c) {
        final channelName = (c['name'] ?? '').toString().toLowerCase();
        final workspaceName = (workspace['name'] ?? '').toString().toLowerCase();
        return channelName.contains(query) || workspaceName.contains(query);
      }).toList();

      if (matchingChannels.isNotEmpty) {
        filtered.add({
          'workspace': workspace,
          'channels': matchingChannels,
        });
      }
    }

    return filtered;
  }

  @override
  Widget build(BuildContext context) {
    final data = _filteredData;

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.75,
      ),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Handle
          Container(
            margin: const EdgeInsets.only(top: 12),
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: Colors.grey.shade300,
              borderRadius: BorderRadius.circular(2),
            ),
          ),

          // Header
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                const Text(
                  'Switch Channel',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 12),

                // Search bar
                TextField(
                  controller: _searchController,
                  decoration: InputDecoration(
                    hintText: 'Search workspaces and channels...',
                    prefixIcon: const Icon(Icons.search, size: 20),
                    filled: true,
                    fillColor: Colors.grey.shade100,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide.none,
                    ),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  ),
                  onChanged: (value) {
                    setState(() => _searchQuery = value);
                  },
                ),
              ],
            ),
          ),

          const Divider(height: 1),

          // Workspace/Channel list
          Flexible(
            child: data.isEmpty
                ? Padding(
                    padding: const EdgeInsets.all(32),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.search_off,
                          size: 48,
                          color: Colors.grey.shade300,
                        ),
                        const SizedBox(height: 12),
                        Text(
                          'No results found',
                          style: TextStyle(
                            color: Colors.grey.shade500,
                          ),
                        ),
                      ],
                    ),
                  )
                : ListView.builder(
                    shrinkWrap: true,
                    padding: const EdgeInsets.only(bottom: 20),
                    itemCount: data.length,
                    itemBuilder: (context, index) {
                      final item = data[index];
                      final workspace = item['workspace'] as Map<String, dynamic>;
                      final channels = List<Map<String, dynamic>>.from(item['channels'] ?? []);
                      final isCurrentWorkspace = workspace['id'] == widget.currentWorkspaceId;

                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Workspace header
                          Container(
                            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                            child: Row(
                              children: [
                                Container(
                                  width: 28,
                                  height: 28,
                                  decoration: BoxDecoration(
                                    color: isCurrentWorkspace
                                        ? Colors.blue.shade600
                                        : Colors.grey.shade400,
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: const Icon(
                                    Icons.workspaces,
                                    size: 16,
                                    color: Colors.white,
                                  ),
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Text(
                                    workspace['name'] ?? 'Workspace',
                                    style: TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w600,
                                      color: isCurrentWorkspace
                                          ? Colors.blue.shade700
                                          : Colors.grey.shade700,
                                    ),
                                  ),
                                ),
                                if (isCurrentWorkspace)
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: Colors.blue.shade100,
                                      borderRadius: BorderRadius.circular(10),
                                    ),
                                    child: Text(
                                      'Current',
                                      style: TextStyle(
                                        fontSize: 10,
                                        fontWeight: FontWeight.w600,
                                        color: Colors.blue.shade700,
                                      ),
                                    ),
                                  ),
                              ],
                            ),
                          ),

                          // Channels
                          ...channels.map((channel) {
                            final isCurrentChannel = isCurrentWorkspace &&
                                channel['id'] == widget.currentChannelId;

                            return InkWell(
                              onTap: () => widget.onSelect(workspace, channel),
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 16,
                                  vertical: 12,
                                ),
                                margin: const EdgeInsets.only(left: 38),
                                decoration: BoxDecoration(
                                  color: isCurrentChannel
                                      ? Colors.blue.shade50
                                      : Colors.transparent,
                                  border: Border(
                                    left: BorderSide(
                                      color: isCurrentChannel
                                          ? Colors.blue.shade400
                                          : Colors.grey.shade200,
                                      width: 2,
                                    ),
                                  ),
                                ),
                                child: Row(
                                  children: [
                                    Icon(
                                      Icons.tag,
                                      size: 16,
                                      color: isCurrentChannel
                                          ? Colors.blue.shade600
                                          : Colors.grey.shade500,
                                    ),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Text(
                                        channel['name'] ?? 'Channel',
                                        style: TextStyle(
                                          fontSize: 14,
                                          fontWeight: isCurrentChannel
                                              ? FontWeight.w600
                                              : FontWeight.normal,
                                          color: isCurrentChannel
                                              ? Colors.blue.shade700
                                              : Colors.grey.shade800,
                                        ),
                                      ),
                                    ),
                                    if (isCurrentChannel)
                                      Icon(
                                        Icons.check_circle,
                                        size: 18,
                                        color: Colors.blue.shade600,
                                      ),
                                  ],
                                ),
                              ),
                            );
                          }).toList(),

                          if (channels.isEmpty)
                            Padding(
                              padding: const EdgeInsets.only(left: 54, top: 4, bottom: 8),
                              child: Text(
                                'No channels',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: Colors.grey.shade400,
                                  fontStyle: FontStyle.italic,
                                ),
                              ),
                            ),
                        ],
                      );
                    },
                  ),
          ),

          // Safe area padding
          SizedBox(height: MediaQuery.of(context).padding.bottom),
        ],
      ),
    );
  }
}
