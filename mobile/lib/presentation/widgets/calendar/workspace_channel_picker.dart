import 'package:flutter/material.dart';
import '../../../data/models/workspace.dart';
import '../../../data/services/workspace_service.dart';

/// Selection data for workspace/channel picker
class WorkspaceChannelSelection {
  final Workspace? workspace;  // Single workspace (backwards compat)
  final Map<String, dynamic>? channel;  // Single channel (backwards compat)
  final bool showAllWorkspaces;
  final List<String>? workspaceIds;
  final List<String>? channelIds;
  final List<Workspace> workspaces;  // All selected workspaces
  final List<ChannelData> channels;  // All selected channels with workspace info

  WorkspaceChannelSelection({
    this.workspace,
    this.channel,
    required this.showAllWorkspaces,
    this.workspaceIds,
    this.channelIds,
    this.workspaces = const [],
    this.channels = const [],
  });
}

/// Channel data with workspace reference
class ChannelData {
  final String workspaceId;
  final String channelId;
  final Map<String, dynamic> channel;

  ChannelData({
    required this.workspaceId,
    required this.channelId,
    required this.channel,
  });
}

/// Workspace and channel picker widget for calendar/timeline views
/// Supports multi-select for workspaces and channels
class WorkspaceChannelPicker extends StatefulWidget {
  final Function(WorkspaceChannelSelection) onSelectionChange;
  final Workspace? currentWorkspace;

  const WorkspaceChannelPicker({
    Key? key,
    required this.onSelectionChange,
    this.currentWorkspace,
  }) : super(key: key);

  @override
  State<WorkspaceChannelPicker> createState() => _WorkspaceChannelPickerState();
}

class _WorkspaceChannelPickerState extends State<WorkspaceChannelPicker> {
  final WorkspaceService _workspaceService = WorkspaceService();
  List<Workspace> _workspaces = [];
  Map<String, List<Map<String, dynamic>>> _channelsByWorkspace = {};
  Set<String> _selectedWorkspaceIds = {};
  List<ChannelData> _selectedChannels = [];
  bool _isLoading = false;
  Set<String> _loadingChannelsFor = {};

  @override
  void initState() {
    super.initState();
    _loadWorkspaces();
  }

  Future<void> _loadWorkspaces() async {
    setState(() => _isLoading = true);
    try {
      final workspaces = await _workspaceService.getWorkspaces();
      setState(() {
        _workspaces = workspaces;
        _isLoading = false;
      });
    } catch (e) {
      print('❌ Error loading workspaces: $e');
      setState(() => _isLoading = false);
    }
  }

  Future<void> _loadChannels(String workspaceId) async {
    if (_channelsByWorkspace.containsKey(workspaceId)) return;

    setState(() => _loadingChannelsFor.add(workspaceId));
    try {
      final channels = await _workspaceService.getChannels(workspaceId);
      setState(() {
        _channelsByWorkspace[workspaceId] = channels;
        _loadingChannelsFor.remove(workspaceId);
      });
    } catch (e) {
      print('❌ Error loading channels: $e');
      setState(() => _loadingChannelsFor.remove(workspaceId));
    }
  }

  void _notifySelection() {
    final selectedWorkspaces = _workspaces.where((ws) => _selectedWorkspaceIds.contains(ws.id)).toList();

    widget.onSelectionChange(WorkspaceChannelSelection(
      workspace: selectedWorkspaces.length == 1 ? selectedWorkspaces.first : null,
      channel: _selectedChannels.length == 1 ? _selectedChannels.first.channel : null,
      showAllWorkspaces: _selectedWorkspaceIds.isEmpty,
      workspaceIds: _selectedWorkspaceIds.isNotEmpty ? _selectedWorkspaceIds.toList() : null,
      channelIds: _selectedChannels.isNotEmpty
          ? _selectedChannels.map((c) => c.channelId).toList()
          : null,
      workspaces: selectedWorkspaces,
      channels: _selectedChannels,
    ));
  }

  void _toggleWorkspace(Workspace workspace) {
    setState(() {
      if (_selectedWorkspaceIds.contains(workspace.id)) {
        _selectedWorkspaceIds.remove(workspace.id);
        // Remove channels from this workspace
        _selectedChannels.removeWhere((c) => c.workspaceId == workspace.id);
      } else {
        _selectedWorkspaceIds.add(workspace.id);
        _loadChannels(workspace.id);
      }
    });
    _notifySelection();
  }

  void _selectAllWorkspaces() {
    setState(() {
      _selectedWorkspaceIds.clear();
      _selectedChannels.clear();
    });
    _notifySelection();
  }

  void _toggleChannel(String workspaceId, Map<String, dynamic> channel) {
    setState(() {
      final channelId = channel['id'].toString();
      final existingIndex = _selectedChannels.indexWhere((c) => c.channelId == channelId);

      if (existingIndex >= 0) {
        _selectedChannels.removeAt(existingIndex);
      } else {
        _selectedChannels.add(ChannelData(
          workspaceId: workspaceId,
          channelId: channelId,
          channel: channel,
        ));
      }
    });
    _notifySelection();
  }

  void _clearChannelSelection() {
    setState(() => _selectedChannels.clear());
    _notifySelection();
  }

  String get _workspaceDisplayText {
    if (_selectedWorkspaceIds.isEmpty) {
      return 'All Workspaces';
    } else if (_selectedWorkspaceIds.length == 1) {
      final ws = _workspaces.firstWhere(
        (w) => w.id == _selectedWorkspaceIds.first,
        orElse: () => _workspaces.isNotEmpty ? _workspaces.first : Workspace(
          id: '',
          name: '1 Workspace',
          ownerId: '',
          role: 'member',
          memberCount: 0,
          channelCount: 0,
          createdAt: DateTime.now(),
          settings: {},
        ),
      );
      return ws.name;
    } else {
      return '${_selectedWorkspaceIds.length} Workspaces';
    }
  }

  String get _channelDisplayText {
    if (_selectedChannels.isEmpty) {
      return _selectedWorkspaceIds.isNotEmpty ? 'All Channels' : 'Select workspace';
    } else if (_selectedChannels.length == 1) {
      return '#${_selectedChannels.first.channel['name']}';
    } else {
      return '${_selectedChannels.length} Channels';
    }
  }

  void _showWorkspaceSelector() {
    // Create a local copy for the bottom sheet
    Set<String> localSelectedIds = Set.from(_selectedWorkspaceIds);

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => StatefulBuilder(
        builder: (context, setSheetState) => _WorkspaceSelectorSheet(
          workspaces: _workspaces,
          selectedIds: localSelectedIds,
          isLoading: _isLoading,
          onToggle: (workspace) {
            setSheetState(() {
              if (localSelectedIds.contains(workspace.id)) {
                localSelectedIds.remove(workspace.id);
              } else {
                localSelectedIds.add(workspace.id);
              }
            });
          },
          onSelectAll: () {
            // Clear selections and close
            setState(() {
              _selectedWorkspaceIds.clear();
              _selectedChannels.clear();
            });
            _notifySelection();
            Navigator.pop(context);
          },
          onDone: () {
            // Apply changes to parent state
            setState(() {
              _selectedWorkspaceIds = localSelectedIds;
              // Remove channels from unselected workspaces
              _selectedChannels.removeWhere((c) => !localSelectedIds.contains(c.workspaceId));
            });
            // Load channels for newly selected workspaces
            for (final wsId in localSelectedIds) {
              _loadChannels(wsId);
            }
            _notifySelection();
            Navigator.pop(context);
          },
        ),
      ),
    );
  }

  void _showChannelSelector() {
    if (_selectedWorkspaceIds.isEmpty) return;

    // Create a local copy for the bottom sheet
    List<ChannelData> localSelectedChannels = List.from(_selectedChannels);
    final selectedWorkspaces = _workspaces.where((ws) => _selectedWorkspaceIds.contains(ws.id)).toList();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => StatefulBuilder(
        builder: (context, setSheetState) => _ChannelSelectorSheet(
          workspaces: selectedWorkspaces,
          channelsByWorkspace: _channelsByWorkspace,
          selectedChannels: localSelectedChannels,
          loadingFor: _loadingChannelsFor,
          onToggle: (workspaceId, channel) {
            setSheetState(() {
              final channelId = channel['id'].toString();
              final existingIndex = localSelectedChannels.indexWhere((c) => c.channelId == channelId);

              if (existingIndex >= 0) {
                localSelectedChannels.removeAt(existingIndex);
              } else {
                localSelectedChannels.add(ChannelData(
                  workspaceId: workspaceId,
                  channelId: channelId,
                  channel: channel,
                ));
              }
            });
          },
          onClear: () {
            setState(() => _selectedChannels.clear());
            _notifySelection();
            Navigator.pop(context);
          },
          onLoadChannels: _loadChannels,
          onDone: () {
            setState(() {
              _selectedChannels = localSelectedChannels;
            });
            _notifySelection();
            Navigator.pop(context);
          },
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final hasWorkspaceSelection = _selectedWorkspaceIds.isNotEmpty;

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Workspace Dropdown
        GestureDetector(
          onTap: _showWorkspaceSelector,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              border: Border.all(color: Colors.grey.shade300),
              borderRadius: BorderRadius.circular(8),
              color: Colors.white,
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  _selectedWorkspaceIds.isEmpty ? Icons.public : Icons.business,
                  size: 16,
                  color: _selectedWorkspaceIds.isEmpty
                      ? Colors.purple.shade600
                      : Colors.blue.shade600,
                ),
                const SizedBox(width: 6),
                ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 100),
                  child: Text(
                    _workspaceDisplayText,
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const Icon(Icons.arrow_drop_down, size: 20),
              ],
            ),
          ),
        ),

        const SizedBox(width: 8),

        // Channel Dropdown
        GestureDetector(
          onTap: hasWorkspaceSelection ? _showChannelSelector : null,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              border: Border.all(
                color: _selectedChannels.isNotEmpty
                    ? Colors.green.shade400
                    : hasWorkspaceSelection
                        ? Colors.grey.shade300
                        : Colors.grey.shade200,
              ),
              borderRadius: BorderRadius.circular(8),
              color: _selectedChannels.isNotEmpty
                  ? Colors.green.shade50
                  : hasWorkspaceSelection
                      ? Colors.white
                      : Colors.grey.shade100,
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.tag,
                  size: 16,
                  color: _selectedChannels.isNotEmpty
                      ? Colors.green.shade700
                      : hasWorkspaceSelection
                          ? Colors.grey[700]
                          : Colors.grey[400],
                ),
                const SizedBox(width: 6),
                ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 100),
                  child: Text(
                    _channelDisplayText,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: _selectedChannels.isNotEmpty
                          ? Colors.green.shade700
                          : hasWorkspaceSelection
                              ? Colors.black87
                              : Colors.grey[500],
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                if (_selectedChannels.isNotEmpty)
                  GestureDetector(
                    onTap: () {
                      _clearChannelSelection();
                    },
                    child: Padding(
                      padding: const EdgeInsets.only(left: 4),
                      child: Icon(
                        Icons.close,
                        size: 14,
                        color: Colors.grey[600],
                      ),
                    ),
                  )
                else if (hasWorkspaceSelection)
                  const Icon(Icons.arrow_drop_down, size: 20),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

/// Bottom sheet for workspace selection
class _WorkspaceSelectorSheet extends StatelessWidget {
  final List<Workspace> workspaces;
  final Set<String> selectedIds;
  final bool isLoading;
  final Function(Workspace) onToggle;
  final VoidCallback onSelectAll;
  final VoidCallback onDone;

  const _WorkspaceSelectorSheet({
    required this.workspaces,
    required this.selectedIds,
    required this.isLoading,
    required this.onToggle,
    required this.onSelectAll,
    required this.onDone,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.6,
      ),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
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
              color: Colors.grey[300],
              borderRadius: BorderRadius.circular(2),
            ),
          ),

          // Header
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                const Text(
                  'Select Workspaces',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                const Spacer(),
                TextButton(
                  onPressed: onDone,
                  child: Text(
                    selectedIds.isNotEmpty ? 'Done (${selectedIds.length})' : 'Done',
                  ),
                ),
              ],
            ),
          ),

          const Divider(height: 1),

          // All Workspaces Option
          ListTile(
            leading: Icon(
              Icons.public,
              color: selectedIds.isEmpty ? Colors.purple.shade600 : Colors.grey,
            ),
            title: const Text('All Workspaces'),
            subtitle: const Text('View tasks from all workspaces'),
            trailing: selectedIds.isEmpty
                ? Icon(Icons.check, color: Colors.purple.shade600)
                : null,
            onTap: onSelectAll,
          ),

          const Divider(height: 1),

          // Workspaces List
          Flexible(
            child: isLoading
                ? const Center(child: CircularProgressIndicator())
                : ListView.builder(
                    shrinkWrap: true,
                    itemCount: workspaces.length,
                    itemBuilder: (context, index) {
                      final workspace = workspaces[index];
                      final isSelected = selectedIds.contains(workspace.id);

                      return ListTile(
                        leading: Container(
                          width: 24,
                          height: 24,
                          decoration: BoxDecoration(
                            color: isSelected ? Colors.blue.shade600 : Colors.transparent,
                            border: Border.all(
                              color: isSelected ? Colors.blue.shade600 : Colors.grey.shade400,
                              width: 2,
                            ),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: isSelected
                              ? const Icon(Icons.check, size: 16, color: Colors.white)
                              : null,
                        ),
                        title: Text(workspace.name),
                        onTap: () => onToggle(workspace),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}

/// Bottom sheet for channel selection
class _ChannelSelectorSheet extends StatefulWidget {
  final List<Workspace> workspaces;
  final Map<String, List<Map<String, dynamic>>> channelsByWorkspace;
  final List<ChannelData> selectedChannels;
  final Set<String> loadingFor;
  final Function(String, Map<String, dynamic>) onToggle;
  final VoidCallback onClear;
  final Function(String) onLoadChannels;
  final VoidCallback onDone;

  const _ChannelSelectorSheet({
    required this.workspaces,
    required this.channelsByWorkspace,
    required this.selectedChannels,
    required this.loadingFor,
    required this.onToggle,
    required this.onClear,
    required this.onLoadChannels,
    required this.onDone,
  });

  @override
  State<_ChannelSelectorSheet> createState() => _ChannelSelectorSheetState();
}

class _ChannelSelectorSheetState extends State<_ChannelSelectorSheet> {
  @override
  void initState() {
    super.initState();
    // Load channels for all selected workspaces
    for (final workspace in widget.workspaces) {
      if (!widget.channelsByWorkspace.containsKey(workspace.id)) {
        widget.onLoadChannels(workspace.id);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.7,
      ),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
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
              color: Colors.grey[300],
              borderRadius: BorderRadius.circular(2),
            ),
          ),

          // Header
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                const Text(
                  'Select Channels',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                const Spacer(),
                TextButton(
                  onPressed: widget.onDone,
                  child: Text(
                    widget.selectedChannels.isNotEmpty
                        ? 'Done (${widget.selectedChannels.length})'
                        : 'Done',
                  ),
                ),
              ],
            ),
          ),

          const Divider(height: 1),

          // All Channels Option
          ListTile(
            leading: Icon(
              Icons.tag,
              color: widget.selectedChannels.isEmpty ? Colors.green.shade600 : Colors.grey,
            ),
            title: const Text('All Channels'),
            subtitle: const Text('View all channels in selected workspaces'),
            trailing: widget.selectedChannels.isEmpty
                ? Icon(Icons.check, color: Colors.green.shade600)
                : null,
            onTap: widget.onClear,
          ),

          const Divider(height: 1),

          // Channels List grouped by workspace
          Flexible(
            child: ListView.builder(
              shrinkWrap: true,
              itemCount: widget.workspaces.length,
              itemBuilder: (context, index) {
                final workspace = widget.workspaces[index];
                final channels = widget.channelsByWorkspace[workspace.id] ?? [];
                final isLoading = widget.loadingFor.contains(workspace.id);

                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Workspace header
                    Container(
                      color: Colors.grey.shade100,
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      child: Row(
                        children: [
                          const Icon(Icons.business, size: 14, color: Colors.grey),
                          const SizedBox(width: 8),
                          Text(
                            workspace.name,
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: Colors.grey.shade700,
                            ),
                          ),
                        ],
                      ),
                    ),

                    // Channels
                    if (isLoading)
                      const Padding(
                        padding: EdgeInsets.all(16),
                        child: Center(
                          child: SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          ),
                        ),
                      )
                    else if (channels.isEmpty)
                      Padding(
                        padding: const EdgeInsets.all(16),
                        child: Text(
                          'No channels in this workspace',
                          style: TextStyle(color: Colors.grey.shade500, fontSize: 13),
                        ),
                      )
                    else
                      ...channels.map((channel) {
                        final channelId = channel['id'].toString();
                        final isSelected = widget.selectedChannels.any((c) => c.channelId == channelId);

                        return ListTile(
                          contentPadding: const EdgeInsets.symmetric(horizontal: 16),
                          leading: Container(
                            width: 20,
                            height: 20,
                            decoration: BoxDecoration(
                              color: isSelected ? Colors.green.shade600 : Colors.transparent,
                              border: Border.all(
                                color: isSelected ? Colors.green.shade600 : Colors.grey.shade400,
                                width: 2,
                              ),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: isSelected
                                ? const Icon(Icons.check, size: 14, color: Colors.white)
                                : null,
                          ),
                          title: Text(
                            '#${channel['name']}',
                            style: TextStyle(
                              color: isSelected ? Colors.green.shade700 : Colors.black87,
                            ),
                          ),
                          onTap: () => widget.onToggle(workspace.id, channel),
                        );
                      }),
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
