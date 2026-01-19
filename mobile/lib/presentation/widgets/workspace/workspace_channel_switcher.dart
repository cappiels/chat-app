import 'package:flutter/material.dart';
import '../../../data/models/thread.dart';
import '../../../data/services/http_client.dart';

/// Compact Workspace-Channel Switcher Widget
/// Shows "Workspace > #channel" and opens a bottom sheet to switch
class WorkspaceChannelSwitcher extends StatefulWidget {
  final Map<String, dynamic> currentWorkspace;
  final Thread? currentChannel;
  final List<Thread> channels;
  final Function(Thread) onChannelSelect;
  final VoidCallback? onWorkspaceSwitch;

  const WorkspaceChannelSwitcher({
    super.key,
    required this.currentWorkspace,
    this.currentChannel,
    required this.channels,
    required this.onChannelSelect,
    this.onWorkspaceSwitch,
  });

  @override
  State<WorkspaceChannelSwitcher> createState() => _WorkspaceChannelSwitcherState();
}

class _WorkspaceChannelSwitcherState extends State<WorkspaceChannelSwitcher> {
  void _showChannelPicker() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => _ChannelPickerSheet(
        workspaceName: widget.currentWorkspace['name'] ?? 'Workspace',
        channels: widget.channels,
        currentChannel: widget.currentChannel,
        onChannelSelect: (channel) {
          Navigator.pop(context);
          widget.onChannelSelect(channel);
        },
        onWorkspaceSwitch: widget.onWorkspaceSwitch != null
            ? () {
                Navigator.pop(context);
                widget.onWorkspaceSwitch!();
              }
            : null,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final workspaceName = widget.currentWorkspace['name'] ?? 'Workspace';
    final channelName = widget.currentChannel?.name ?? 'Select channel';

    return InkWell(
      onTap: _showChannelPicker,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: Colors.grey.shade100,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Workspace icon
            Container(
              width: 24,
              height: 24,
              decoration: BoxDecoration(
                color: Colors.blue.shade600,
                borderRadius: BorderRadius.circular(6),
              ),
              child: const Icon(
                Icons.workspaces,
                size: 14,
                color: Colors.white,
              ),
            ),
            const SizedBox(width: 8),

            // Workspace name
            Flexible(
              child: Text(
                workspaceName,
                style: const TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 14,
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ),

            // Separator
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: Icon(
                Icons.chevron_right,
                size: 16,
                color: Colors.grey.shade400,
              ),
            ),

            // Channel hash
            Icon(
              Icons.tag,
              size: 14,
              color: Colors.grey.shade500,
            ),
            const SizedBox(width: 2),

            // Channel name
            Flexible(
              child: Text(
                channelName,
                style: TextStyle(
                  fontSize: 14,
                  color: Colors.grey.shade700,
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ),

            const SizedBox(width: 4),

            // Dropdown indicator
            Icon(
              Icons.keyboard_arrow_down,
              size: 18,
              color: Colors.grey.shade500,
            ),
          ],
        ),
      ),
    );
  }
}

/// Bottom sheet for picking a channel
class _ChannelPickerSheet extends StatelessWidget {
  final String workspaceName;
  final List<Thread> channels;
  final Thread? currentChannel;
  final Function(Thread) onChannelSelect;
  final VoidCallback? onWorkspaceSwitch;

  const _ChannelPickerSheet({
    required this.workspaceName,
    required this.channels,
    this.currentChannel,
    required this.onChannelSelect,
    this.onWorkspaceSwitch,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.6,
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
            child: Row(
              children: [
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: Colors.blue.shade600,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(
                    Icons.workspaces,
                    size: 18,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        workspaceName,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      Text(
                        '${channels.length} channel${channels.length != 1 ? 's' : ''}',
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.grey.shade500,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          const Divider(height: 1),

          // Channel list
          Flexible(
            child: channels.isEmpty
                ? Padding(
                    padding: const EdgeInsets.all(32),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.chat_bubble_outline,
                          size: 48,
                          color: Colors.grey.shade300,
                        ),
                        const SizedBox(height: 12),
                        Text(
                          'No channels',
                          style: TextStyle(
                            color: Colors.grey.shade500,
                          ),
                        ),
                      ],
                    ),
                  )
                : ListView.builder(
                    shrinkWrap: true,
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    itemCount: channels.length,
                    itemBuilder: (context, index) {
                      final channel = channels[index];
                      final isSelected = currentChannel?.id == channel.id;

                      return ListTile(
                        leading: Container(
                          width: 32,
                          height: 32,
                          decoration: BoxDecoration(
                            color: isSelected
                                ? Colors.blue.shade100
                                : Colors.grey.shade100,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Icon(
                            Icons.tag,
                            size: 16,
                            color: isSelected
                                ? Colors.blue.shade700
                                : Colors.grey.shade600,
                          ),
                        ),
                        title: Text(
                          channel.name,
                          style: TextStyle(
                            fontWeight:
                                isSelected ? FontWeight.w600 : FontWeight.normal,
                            color:
                                isSelected ? Colors.blue.shade700 : Colors.black,
                          ),
                        ),
                        trailing: isSelected
                            ? Icon(
                                Icons.check_circle,
                                color: Colors.blue.shade600,
                                size: 20,
                              )
                            : null,
                        onTap: () => onChannelSelect(channel),
                      );
                    },
                  ),
          ),

          // Switch workspace button
          if (onWorkspaceSwitch != null) ...[
            const Divider(height: 1),
            ListTile(
              leading: Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: Colors.grey.shade100,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(
                  Icons.swap_horiz,
                  size: 18,
                  color: Colors.grey.shade600,
                ),
              ),
              title: const Text('Switch Workspace'),
              subtitle: const Text(
                'Go to different workspace',
                style: TextStyle(fontSize: 12),
              ),
              trailing: const Icon(Icons.chevron_right),
              onTap: onWorkspaceSwitch,
            ),
          ],

          // Safe area padding
          SizedBox(height: MediaQuery.of(context).padding.bottom),
        ],
      ),
    );
  }
}
