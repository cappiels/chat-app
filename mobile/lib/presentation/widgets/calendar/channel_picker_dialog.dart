import 'package:flutter/material.dart';
import '../../../data/models/workspace.dart';
import 'workspace_channel_picker.dart';

/// Dialog to select a single channel when multiple are selected
/// Used for task/event creation which requires a specific channel
class ChannelPickerDialog extends StatefulWidget {
  final List<ChannelData> selectedChannels;
  final List<Workspace> workspaces;
  final String title;
  final String description;

  const ChannelPickerDialog({
    Key? key,
    required this.selectedChannels,
    required this.workspaces,
    this.title = 'Select a Channel',
    this.description = 'Please select which channel to create the task in:',
  }) : super(key: key);

  /// Shows the dialog and returns the selected channel, or null if cancelled
  static Future<ChannelData?> show({
    required BuildContext context,
    required List<ChannelData> selectedChannels,
    required List<Workspace> workspaces,
    String? title,
    String? description,
  }) {
    return showDialog<ChannelData>(
      context: context,
      builder: (context) => ChannelPickerDialog(
        selectedChannels: selectedChannels,
        workspaces: workspaces,
        title: title ?? 'Select a Channel',
        description: description ?? 'You have multiple channels selected. Please choose which channel to create the task in:',
      ),
    );
  }

  @override
  State<ChannelPickerDialog> createState() => _ChannelPickerDialogState();
}

class _ChannelPickerDialogState extends State<ChannelPickerDialog> {
  ChannelData? _selectedChannel;

  @override
  Widget build(BuildContext context) {
    // Group channels by workspace
    final channelsByWorkspace = <String, List<ChannelData>>{};
    for (final channel in widget.selectedChannels) {
      channelsByWorkspace.putIfAbsent(channel.workspaceId, () => []);
      channelsByWorkspace[channel.workspaceId]!.add(channel);
    }

    return AlertDialog(
      title: Text(widget.title),
      content: SizedBox(
        width: double.maxFinite,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              widget.description,
              style: TextStyle(
                color: Colors.grey[600],
                fontSize: 14,
              ),
            ),
            const SizedBox(height: 16),
            Flexible(
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: channelsByWorkspace.entries.map((entry) {
                    final workspaceId = entry.key;
                    final channels = entry.value;

                    final workspaceName = widget.workspaces
                        .where((ws) => ws.id == workspaceId)
                        .map((ws) => ws.name)
                        .firstOrNull ?? 'Workspace';

                    return Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      decoration: BoxDecoration(
                        border: Border.all(color: Colors.grey.shade300),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Workspace header
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                            decoration: BoxDecoration(
                              color: Colors.grey.shade100,
                              borderRadius: const BorderRadius.vertical(top: Radius.circular(7)),
                            ),
                            child: Row(
                              children: [
                                Icon(Icons.business, size: 14, color: Colors.grey[600]),
                                const SizedBox(width: 8),
                                Text(
                                  workspaceName,
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                    color: Colors.grey[700],
                                  ),
                                ),
                              ],
                            ),
                          ),

                          // Channels
                          ...channels.map((channelData) {
                            final isSelected = _selectedChannel?.channelId == channelData.channelId;

                            return InkWell(
                              onTap: () {
                                setState(() => _selectedChannel = channelData);
                              },
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                                decoration: BoxDecoration(
                                  color: isSelected ? Colors.blue.shade50 : Colors.transparent,
                                ),
                                child: Row(
                                  children: [
                                    Container(
                                      width: 20,
                                      height: 20,
                                      decoration: BoxDecoration(
                                        shape: BoxShape.circle,
                                        color: isSelected ? Colors.blue.shade600 : Colors.transparent,
                                        border: Border.all(
                                          color: isSelected ? Colors.blue.shade600 : Colors.grey.shade400,
                                          width: 2,
                                        ),
                                      ),
                                      child: isSelected
                                          ? const Icon(Icons.check, size: 12, color: Colors.white)
                                          : null,
                                    ),
                                    const SizedBox(width: 12),
                                    Icon(Icons.tag, size: 16, color: Colors.grey[600]),
                                    const SizedBox(width: 6),
                                    Expanded(
                                      child: Text(
                                        channelData.channel['name'] ?? 'Channel',
                                        style: TextStyle(
                                          fontSize: 14,
                                          color: isSelected ? Colors.blue.shade700 : Colors.black87,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            );
                          }),
                        ],
                      ),
                    );
                  }).toList(),
                ),
              ),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context, null),
          child: const Text('Cancel'),
        ),
        ElevatedButton(
          onPressed: _selectedChannel != null
              ? () => Navigator.pop(context, _selectedChannel)
              : null,
          child: const Text('Continue'),
        ),
      ],
    );
  }
}
