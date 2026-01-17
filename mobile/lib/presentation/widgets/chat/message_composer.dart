import 'package:flutter/material.dart';
import 'dart:async';
import 'dart:io';
import '../../../data/services/file_picker_service.dart';
import '../../../data/services/file_upload_service.dart';
import '../../../data/models/attachment.dart';

/// Represents a member that can be mentioned
class MentionMember {
  final String id;
  final String displayName;
  final String email;
  final String? profilePictureUrl;

  MentionMember({
    required this.id,
    required this.displayName,
    required this.email,
    this.profilePictureUrl,
  });

  factory MentionMember.fromJson(Map<String, dynamic> json) {
    return MentionMember(
      id: json['id'] ?? '',
      displayName: json['display_name'] ?? json['name'] ?? 'User',
      email: json['email'] ?? '',
      profilePictureUrl: json['profile_picture_url'],
    );
  }
}

/// Represents a selected mention
class SelectedMention {
  final String userId;
  final String displayName;
  final String type;

  SelectedMention({
    required this.userId,
    required this.displayName,
    this.type = 'user',
  });

  Map<String, dynamic> toJson() => {
    'user_id': userId,
    'display_name': displayName,
    'type': type,
  };
}

class MessageComposer extends StatefulWidget {
  final TextEditingController controller;
  final Function(String) onSend;
  final Function(bool)? onTypingChanged;
  final String? workspaceId;
  final String? threadId;
  final Function(List<Attachment>)? onAttachmentsChanged;
  final List<MentionMember>? workspaceMembers;
  final Function(List<SelectedMention>)? onMentionsChanged;

  const MessageComposer({
    super.key,
    required this.controller,
    required this.onSend,
    this.onTypingChanged,
    this.workspaceId,
    this.threadId,
    this.onAttachmentsChanged,
    this.workspaceMembers,
    this.onMentionsChanged,
  });

  @override
  State<MessageComposer> createState() => _MessageComposerState();
}

class _MessageComposerState extends State<MessageComposer> {
  bool _isTyping = false;
  bool _hasText = false;
  Timer? _typingTimer;
  final FocusNode _focusNode = FocusNode();
  final List<File> _selectedFiles = [];
  final List<Attachment> _uploadedAttachments = [];
  bool _isUploading = false;

  // Mention state
  bool _showMentionDropdown = false;
  String _mentionQuery = '';
  int? _mentionStartIndex;
  int _selectedMentionIndex = 0;
  final List<SelectedMention> _selectedMentions = [];
  OverlayEntry? _mentionOverlay;
  final LayerLink _layerLink = LayerLink();

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_onTextChanged);
  }

  @override
  void dispose() {
    _typingTimer?.cancel();
    _focusNode.dispose();
    widget.controller.removeListener(_onTextChanged);
    _selectedFiles.clear();
    _uploadedAttachments.clear();
    _removeMentionOverlay();
    super.dispose();
  }

  List<MentionMember> get _filteredMembers {
    final members = widget.workspaceMembers ?? [];
    if (_mentionQuery.isEmpty) return members.take(8).toList();
    return members
        .where((m) =>
            m.displayName.toLowerCase().contains(_mentionQuery.toLowerCase()) ||
            m.email.toLowerCase().contains(_mentionQuery.toLowerCase()))
        .take(8)
        .toList();
  }

  void _onTextChanged() {
    final text = widget.controller.text;
    final hasText = text.trim().isNotEmpty;

    // Update send button state
    if (_hasText != hasText) {
      setState(() => _hasText = hasText);
    }

    // Detect @ mention
    final cursorPos = widget.controller.selection.baseOffset;
    if (cursorPos >= 0 && cursorPos <= text.length) {
      final textBeforeCursor = text.substring(0, cursorPos);
      final lastAtIndex = textBeforeCursor.lastIndexOf('@');

      if (lastAtIndex != -1) {
        final textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
        // Check if we're in a mention (no spaces after @)
        if (!textAfterAt.contains(' ') && !textAfterAt.contains('\n')) {
          setState(() {
            _showMentionDropdown = true;
            _mentionQuery = textAfterAt.toLowerCase();
            _mentionStartIndex = lastAtIndex;
            _selectedMentionIndex = 0;
          });
          _showMentionOverlay();
        } else {
          _closeMentionDropdown();
        }
      } else {
        _closeMentionDropdown();
      }
    }

    // Handle typing indicator
    if (hasText && !_isTyping) {
      setState(() => _isTyping = true);
      widget.onTypingChanged?.call(true);
    }

    // Reset the typing timeout
    _typingTimer?.cancel();
    _typingTimer = Timer(const Duration(seconds: 2), () {
      if (_isTyping) {
        setState(() => _isTyping = false);
        widget.onTypingChanged?.call(false);
      }
    });
  }

  void _closeMentionDropdown() {
    setState(() {
      _showMentionDropdown = false;
      _mentionQuery = '';
      _mentionStartIndex = null;
    });
    _removeMentionOverlay();
  }

  void _showMentionOverlay() {
    if (_mentionOverlay != null || _filteredMembers.isEmpty) return;

    _mentionOverlay = OverlayEntry(
      builder: (context) => Positioned(
        width: 280,
        child: CompositedTransformFollower(
          link: _layerLink,
          showWhenUnlinked: false,
          offset: const Offset(0, -220),
          child: Material(
            elevation: 8,
            borderRadius: BorderRadius.circular(12),
            child: Container(
              constraints: const BoxConstraints(maxHeight: 200),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.grey.shade200),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.all(8),
                    child: Row(
                      children: [
                        Icon(Icons.people, size: 16, color: Colors.grey.shade600),
                        const SizedBox(width: 8),
                        Text(
                          'Mention someone',
                          style: TextStyle(
                            fontSize: 12,
                            color: Colors.grey.shade600,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Divider(height: 1),
                  Flexible(
                    child: ListView.builder(
                      shrinkWrap: true,
                      itemCount: _filteredMembers.length,
                      itemBuilder: (context, index) {
                        final member = _filteredMembers[index];
                        final isSelected = index == _selectedMentionIndex;
                        return ListTile(
                          dense: true,
                          selected: isSelected,
                          selectedTileColor: Colors.blue.shade50,
                          leading: CircleAvatar(
                            radius: 16,
                            backgroundImage: member.profilePictureUrl != null
                                ? NetworkImage(member.profilePictureUrl!)
                                : null,
                            backgroundColor: Colors.blue.shade100,
                            child: member.profilePictureUrl == null
                                ? Text(
                                    member.displayName.isNotEmpty
                                        ? member.displayName[0].toUpperCase()
                                        : 'U',
                                    style: TextStyle(
                                      color: Colors.blue.shade700,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  )
                                : null,
                          ),
                          title: Text(
                            member.displayName,
                            style: const TextStyle(fontSize: 14),
                          ),
                          subtitle: Text(
                            member.email,
                            style: TextStyle(
                              fontSize: 11,
                              color: Colors.grey.shade600,
                            ),
                          ),
                          onTap: () => _selectMention(member),
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );

    Overlay.of(context).insert(_mentionOverlay!);
  }

  void _removeMentionOverlay() {
    _mentionOverlay?.remove();
    _mentionOverlay = null;
  }

  void _selectMention(MentionMember member) {
    if (_mentionStartIndex == null) return;

    final text = widget.controller.text;
    final cursorPos = widget.controller.selection.baseOffset;
    final beforeMention = text.substring(0, _mentionStartIndex!);
    final afterCursor = cursorPos >= 0 && cursorPos <= text.length
        ? text.substring(cursorPos)
        : '';
    final mentionText = '@${member.displayName} ';
    final newText = '$beforeMention$mentionText$afterCursor';

    widget.controller.text = newText;
    final newCursorPos = beforeMention.length + mentionText.length;
    widget.controller.selection = TextSelection.collapsed(offset: newCursorPos);

    _selectedMentions.add(SelectedMention(
      userId: member.id,
      displayName: member.displayName,
    ));
    widget.onMentionsChanged?.call(_selectedMentions);

    _closeMentionDropdown();
  }

  Future<void> _handleAttachmentPicker() async {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Handle bar
            Container(
              margin: const EdgeInsets.only(top: 12, bottom: 8),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey.shade300,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            
            ListTile(
              leading: const Icon(Icons.camera_alt, color: Colors.blue),
              title: const Text('Take Photo'),
              onTap: () {
                Navigator.pop(context);
                _pickFromCamera();
              },
            ),
            
            ListTile(
              leading: const Icon(Icons.photo_library, color: Colors.green),
              title: const Text('Photo Library'),
              onTap: () {
                Navigator.pop(context);
                _pickFromGallery();
              },
            ),
            
            ListTile(
              leading: const Icon(Icons.attach_file, color: Colors.orange),
              title: const Text('Documents'),
              onTap: () {
                Navigator.pop(context);
                _pickDocuments();
              },
            ),
            
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  Future<void> _pickFromCamera() async {
    final file = await FilePickerService().takePhoto();
    if (file != null) {
      _addFiles([file]);
    }
  }

  Future<void> _pickFromGallery() async {
    final files = await FilePickerService().pickMultipleImages();
    if (files.isNotEmpty) {
      _addFiles(files);
    }
  }

  Future<void> _pickDocuments() async {
    final files = await FilePickerService().pickDocuments(allowMultiple: true);
    if (files.isNotEmpty) {
      _addFiles(files);
    }
  }

  void _addFiles(List<File> files) {
    setState(() {
      _selectedFiles.addAll(files);
    });
    _uploadFiles(files);
  }

  Future<void> _uploadFiles(List<File> files) async {
    if (widget.workspaceId == null || widget.threadId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Workspace and thread ID required for file upload')),
      );
      return;
    }

    setState(() => _isUploading = true);

    try {
      final uploadedFiles = await FileUploadService().uploadFiles(
        files: files,
        workspaceId: widget.workspaceId!,
        threadId: widget.threadId!,
      );

      setState(() {
        _uploadedAttachments.addAll(uploadedFiles);
        _isUploading = false;
      });

      widget.onAttachmentsChanged?.call(_uploadedAttachments);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('${uploadedFiles.length} file(s) uploaded'),
            backgroundColor: Colors.green,
            duration: const Duration(seconds: 2),
          ),
        );
      }
    } catch (e) {
      setState(() => _isUploading = false);
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Upload failed: $e'),
            backgroundColor: Colors.red,
            duration: const Duration(seconds: 3),
          ),
        );
      }
    }
  }

  void _removeFile(int index) {
    setState(() {
      _selectedFiles.removeAt(index);
      _uploadedAttachments.removeAt(index);
    });
    widget.onAttachmentsChanged?.call(_uploadedAttachments);
  }

  void _handleSend() {
    final text = widget.controller.text.trim();
    if (text.isEmpty && _uploadedAttachments.isEmpty) return;

    widget.onSend(text);

    // Clear attachments and mentions after sending
    setState(() {
      _selectedFiles.clear();
      _uploadedAttachments.clear();
      _selectedMentions.clear();
    });
    widget.onAttachmentsChanged?.call([]);
    widget.onMentionsChanged?.call([]);

    // Stop typing indicator
    _typingTimer?.cancel();
    if (_isTyping) {
      setState(() => _isTyping = false);
      widget.onTypingChanged?.call(false);
    }

    // Close mention dropdown if open
    _closeMentionDropdown();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 8,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // File preview chips
            if (_selectedFiles.isNotEmpty)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: List.generate(_selectedFiles.length, (index) {
                      final file = _selectedFiles[index];
                      final fileName = file.path.split('/').last;
                      final isImage = fileName.toLowerCase().endsWith('.jpg') ||
                          fileName.toLowerCase().endsWith('.jpeg') ||
                          fileName.toLowerCase().endsWith('.png') ||
                          fileName.toLowerCase().endsWith('.gif');

                      return Container(
                        margin: const EdgeInsets.only(right: 8),
                        child: Stack(
                          children: [
                            Container(
                              constraints: const BoxConstraints(maxWidth: 100),
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: Colors.grey.shade100,
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(color: Colors.grey.shade300),
                              ),
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  if (isImage)
                                    ClipRRect(
                                      borderRadius: BorderRadius.circular(4),
                                      child: Image.file(
                                        file,
                                        width: 60,
                                        height: 60,
                                        fit: BoxFit.cover,
                                      ),
                                    )
                                  else
                                    Icon(Icons.attach_file, 
                                      size: 40, 
                                      color: Colors.grey.shade600),
                                  const SizedBox(height: 4),
                                  Text(
                                    fileName,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(fontSize: 10),
                                  ),
                                ],
                              ),
                            ),
                            // Remove button
                            Positioned(
                              top: 0,
                              right: 0,
                              child: GestureDetector(
                                onTap: () => _removeFile(index),
                                child: Container(
                                  padding: const EdgeInsets.all(4),
                                  decoration: BoxDecoration(
                                    color: Colors.red.shade600,
                                    shape: BoxShape.circle,
                                  ),
                                  child: const Icon(
                                    Icons.close,
                                    size: 12,
                                    color: Colors.white,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      );
                    }),
                  ),
                ),
              ),
            
            // Input row
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              child: Row(
                children: [
                  // Attachment button
                  IconButton(
                    icon: Icon(
                      Icons.add_circle_outline, 
                      color: _isUploading ? Colors.grey.shade400 : Colors.grey.shade600,
                    ),
                    onPressed: _isUploading ? null : _handleAttachmentPicker,
                    tooltip: 'Attach file',
                  ),
              
              // Text input field with mention overlay target
              Expanded(
                child: CompositedTransformTarget(
                  link: _layerLink,
                  child: Container(
                    decoration: BoxDecoration(
                      color: Colors.grey.shade100,
                      borderRadius: BorderRadius.circular(24),
                    ),
                    child: TextField(
                      controller: widget.controller,
                      focusNode: _focusNode,
                      maxLines: 5,
                      minLines: 1,
                      textCapitalization: TextCapitalization.sentences,
                      decoration: InputDecoration(
                        hintText: 'Type a message...',
                        hintStyle: TextStyle(color: Colors.grey.shade500),
                        border: InputBorder.none,
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 10,
                        ),
                      ),
                      style: const TextStyle(fontSize: 15),
                      onSubmitted: (_) => _handleSend(),
                    ),
                  ),
                ),
              ),
              
              const SizedBox(width: 8),
              
              // Send button
              Container(
                decoration: BoxDecoration(
                  color: (_hasText || _uploadedAttachments.isNotEmpty)
                      ? Colors.blue.shade600
                      : Colors.grey.shade300,
                  shape: BoxShape.circle,
                ),
                child: _isUploading
                    ? Padding(
                        padding: const EdgeInsets.all(12),
                        child: SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                          ),
                        ),
                      )
                    : IconButton(
                        icon: const Icon(Icons.send, color: Colors.white, size: 20),
                        onPressed: (_hasText || _uploadedAttachments.isNotEmpty) ? _handleSend : null,
                        tooltip: 'Send message',
                      ),
              ),
            ],
          ),
        ),
      ],
    ),
      ),
    );
  }
}
