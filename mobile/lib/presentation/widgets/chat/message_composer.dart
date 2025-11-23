import 'package:flutter/material.dart';
import 'dart:async';
import 'dart:io';
import '../../../data/services/file_picker_service.dart';
import '../../../data/services/file_upload_service.dart';
import '../../../data/models/attachment.dart';

class MessageComposer extends StatefulWidget {
  final TextEditingController controller;
  final Function(String) onSend;
  final Function(bool)? onTypingChanged;
  final String? workspaceId;
  final String? threadId;
  final Function(List<Attachment>)? onAttachmentsChanged;
  
  const MessageComposer({
    super.key,
    required this.controller,
    required this.onSend,
    this.onTypingChanged,
    this.workspaceId,
    this.threadId,
    this.onAttachmentsChanged,
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
    super.dispose();
  }

  void _onTextChanged() {
    final hasText = widget.controller.text.trim().isNotEmpty;
    
    // Update send button state
    if (_hasText != hasText) {
      setState(() => _hasText = hasText);
    }
    
    // Handle typing indicator
    if (hasText && !_isTyping) {
      // Started typing
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
    
    // Clear attachments after sending
    setState(() {
      _selectedFiles.clear();
      _uploadedAttachments.clear();
    });
    widget.onAttachmentsChanged?.call([]);
    
    // Stop typing indicator
    _typingTimer?.cancel();
    if (_isTyping) {
      setState(() => _isTyping = false);
      widget.onTypingChanged?.call(false);
    }
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
              
              // Text input field
              Expanded(
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
