import 'package:flutter/material.dart';
import '../../../data/models/workspace.dart';
import '../../../data/services/workspace_service.dart';

/// Selection data for workspace/channel picker
class WorkspaceChannelSelection {
  final Workspace? workspace;
  final Map<String, dynamic>? channel;
  final bool showAllWorkspaces;
  final List<String>? workspaceIds;
  final List<String>? channelIds;
  
  WorkspaceChannelSelection({
    this.workspace,
    this.channel,
    required this.showAllWorkspaces,
    this.workspaceIds,
    this.channelIds,
  });
}

/// Workspace and channel picker widget for calendar/timeline views
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
  List<Map<String, dynamic>> _channels = [];
  Workspace? _selectedWorkspace;
  Map<String, dynamic>? _selectedChannel;
  bool _isLoading = false;

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
    try {
      final channels = await _workspaceService.getChannels(workspaceId);
      setState(() => _channels = channels);
    } catch (e) {
      print('❌ Error loading channels: $e');
    }
  }

  void _notifySelection() {
    widget.onSelectionChange(WorkspaceChannelSelection(
      workspace: _selectedWorkspace,
      channel: _selectedChannel,
      showAllWorkspaces: _selectedWorkspace == null,
      workspaceIds: _selectedWorkspace != null ? [_selectedWorkspace!.id] : null,
      channelIds: _selectedChannel != null ? [_selectedChannel!['id'].toString()] : null,
    ));
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Workspace Dropdown
        PopupMenuButton<Workspace?>(
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              border: Border.all(color: Colors.grey.shade300),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  _selectedWorkspace == null ? Icons.public : Icons.business,
                  size: 16,
                  color: Colors.grey[700],
                ),
                const SizedBox(width: 6),
                Text(
                  _selectedWorkspace?.name ?? 'All Workspaces',
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
                ),
                const Icon(Icons.arrow_drop_down, size: 20),
              ],
            ),
          ),
          itemBuilder: (context) => [
            // "All Workspaces" option
            const PopupMenuItem(
              value: null,
              child: Row(
                children: [
                  Icon(Icons.public, size: 16),
                  SizedBox(width: 8),
                  Text('All Workspaces'),
                ],
              ),
            ),
            const PopupMenuDivider(),
            // Individual workspaces
            ..._workspaces.map((ws) => PopupMenuItem(
              value: ws,
              child: Row(
                children: [
                  const Icon(Icons.business, size: 16),
                  const SizedBox(width: 8),
                  Text(ws.name),
                ],
              ),
            )),
          ],
          onSelected: (workspace) async {
            setState(() {
              _selectedWorkspace = workspace;
              _selectedChannel = null;
              _channels = [];
            });
            if (workspace != null) {
              await _loadChannels(workspace.id);
            }
            _notifySelection();
          },
        ),
        
        // Channel Dropdown (only if workspace selected)
        if (_selectedWorkspace != null) ...[
          const SizedBox(width: 8),
          PopupMenuButton<Map<String, dynamic>?>(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                border: Border.all(color: Colors.grey.shade300),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.tag, size: 16, color: Colors.grey[700]),
                  const SizedBox(width: 6),
                  Text(
                    _selectedChannel?['name'] ?? 'All Channels',
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
                  ),
                  const Icon(Icons.arrow_drop_down, size: 20),
                ],
              ),
            ),
            itemBuilder: (context) => [
              const PopupMenuItem(
                value: null,
                child: Text('All Channels'),
              ),
              const PopupMenuDivider(),
              ..._channels.map((ch) => PopupMenuItem(
                value: ch,
                child: Text('#${ch['name']}'),
              )),
            ],
            onSelected: (channel) {
              setState(() => _selectedChannel = channel);
              _notifySelection();
            },
          ),
        ],
      ],
    );
  }
}
