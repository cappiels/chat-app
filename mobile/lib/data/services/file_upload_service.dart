import 'dart:io';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:mime/mime.dart';
import 'package:path/path.dart' as path;
import 'package:firebase_auth/firebase_auth.dart';
import '../models/attachment.dart';
import '../../core/config/api_config.dart';

/// 🏆 WORLD-CLASS FILE UPLOAD SERVICE
/// Handles file uploads to backend with progress tracking and optimization
class FileUploadService {
  static final FileUploadService _instance = FileUploadService._internal();
  factory FileUploadService() => _instance;
  FileUploadService._internal();

  final Map<String, UploadProgress> _uploadProgress = {};
  final Map<String, http.StreamedResponse> _activeUploads = {};

  /// Upload a single file
  Future<Attachment?> uploadFile({
    required File file,
    required String workspaceId,
    required String threadId,
    String? messageId,
    Function(double progress)? onProgress,
  }) async {
    try {
      final user = FirebaseAuth.instance.currentUser;
      if (user == null) {
        debugPrint('❌ No authenticated user for file upload');
        return null;
      }

      final token = await user.getIdToken();
      final fileName = path.basename(file.path);
      final fileSize = await file.length();
      final mimeType = lookupMimeType(file.path) ?? 'application/octet-stream';

      // Create unique upload ID
      final uploadId = '${DateTime.now().millisecondsSinceEpoch}_$fileName';
      
      debugPrint('📤 Uploading file: $fileName ($fileSize bytes, $mimeType)');

      // Initialize progress tracking
      _uploadProgress[uploadId] = UploadProgress(
        uploadId: uploadId,
        fileName: fileName,
        fileSize: fileSize,
        bytesUploaded: 0,
        status: UploadStatus.uploading,
      );

      // Create multipart request
      final uri = Uri.parse('${ApiConfig.baseUrl}/api/upload/files');
      final request = http.MultipartRequest('POST', uri);
      
      // Add headers
      request.headers['Authorization'] = 'Bearer $token';
      request.headers['Accept'] = 'application/json';

      // Add fields
      request.fields['workspaceId'] = workspaceId;
      request.fields['threadId'] = threadId;
      if (messageId != null) {
        request.fields['messageId'] = messageId;
      }

      // Add file
      final fileStream = http.ByteStream(file.openRead());
      final multipartFile = http.MultipartFile(
        'file',
        fileStream,
        fileSize,
        filename: fileName,
      );
      request.files.add(multipartFile);

      // Send request with progress tracking
      final response = await request.send();
      _activeUploads[uploadId] = response;

      // Read response
      final responseBody = await response.stream.bytesToString();
      
      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = json.decode(responseBody);
        
        // Update progress to complete
        _uploadProgress[uploadId] = _uploadProgress[uploadId]!.copyWith(
          bytesUploaded: fileSize,
          status: UploadStatus.completed,
        );
        
        onProgress?.call(1.0);
        
        debugPrint('✅ File uploaded successfully: $fileName');
        
        // Create attachment from response
        final attachment = Attachment.fromJson({
          'id': data['fileId'] ?? data['id'],
          'file_name': fileName,
          'file_type': mimeType,
          'file_size': fileSize,
          'url': data['url'],
          'thumbnail_url': data['thumbnailUrl'],
          'workspace_id': workspaceId,
          'uploaded_by': user.uid,
          'uploaded_at': DateTime.now().toIso8601String(),
        });
        
        return attachment;
      } else {
        debugPrint('❌ File upload failed: ${response.statusCode}');
        _uploadProgress[uploadId] = _uploadProgress[uploadId]!.copyWith(
          status: UploadStatus.failed,
          error: 'Upload failed: ${response.statusCode}',
        );
        return null;
      }
    } catch (e) {
      debugPrint('❌ File upload error: $e');
      return null;
    }
  }

  /// Upload multiple files
  Future<List<Attachment>> uploadFiles({
    required List<File> files,
    required String workspaceId,
    required String threadId,
    String? messageId,
    Function(double progress)? onProgress,
  }) async {
    final attachments = <Attachment>[];
    int completed = 0;

    for (final file in files) {
      final attachment = await uploadFile(
        file: file,
        workspaceId: workspaceId,
        threadId: threadId,
        messageId: messageId,
        onProgress: (fileProgress) {
          // Calculate overall progress
          final overallProgress = (completed + fileProgress) / files.length;
          onProgress?.call(overallProgress);
        },
      );

      if (attachment != null) {
        attachments.add(attachment);
      }
      completed++;
    }

    return attachments;
  }

  /// Cancel an ongoing upload
  void cancelUpload(String uploadId) {
    if (_activeUploads.containsKey(uploadId)) {
      _activeUploads[uploadId]?.stream.listen(null).cancel();
      _activeUploads.remove(uploadId);
      
      _uploadProgress[uploadId] = _uploadProgress[uploadId]!.copyWith(
        status: UploadStatus.cancelled,
      );
      
      debugPrint('🚫 Upload cancelled: $uploadId');
    }
  }

  /// Get upload progress for a specific upload
  UploadProgress? getUploadProgress(String uploadId) {
    return _uploadProgress[uploadId];
  }

  /// Clear completed uploads from tracking
  void clearCompletedUploads() {
    _uploadProgress.removeWhere((key, value) =>
        value.status == UploadStatus.completed ||
        value.status == UploadStatus.failed);
  }

  /// Get file icon based on MIME type
  static String getFileIcon(String mimeType) {
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType.startsWith('video/')) return '🎥';
    if (mimeType.startsWith('audio/')) return '🎵';
    if (mimeType.contains('pdf')) return '📄';
    if (mimeType.contains('doc') || mimeType.contains('word')) return '📝';
    if (mimeType.contains('sheet') || mimeType.contains('excel')) return '📊';
    if (mimeType.contains('presentation') || mimeType.contains('powerpoint')) return '📽️';
    if (mimeType.contains('zip') || mimeType.contains('archive')) return '📦';
    return '📎';
  }

  /// Format file size for display
  static String formatFileSize(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    if (bytes < 1024 * 1024 * 1024) {
      return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
    }
    return '${(bytes / (1024 * 1024 * 1024)).toStringAsFixed(1)} GB';
  }
}

/// Upload progress tracking
class UploadProgress {
  final String uploadId;
  final String fileName;
  final int fileSize;
  final int bytesUploaded;
  final UploadStatus status;
  final String? error;

  UploadProgress({
    required this.uploadId,
    required this.fileName,
    required this.fileSize,
    required this.bytesUploaded,
    required this.status,
    this.error,
  });

  double get progress => fileSize > 0 ? bytesUploaded / fileSize : 0.0;

  UploadProgress copyWith({
    int? bytesUploaded,
    UploadStatus? status,
    String? error,
  }) {
    return UploadProgress(
      uploadId: uploadId,
      fileName: fileName,
      fileSize: fileSize,
      bytesUploaded: bytesUploaded ?? this.bytesUploaded,
      status: status ?? this.status,
      error: error ?? this.error,
    );
  }
}

enum UploadStatus {
  uploading,
  completed,
  failed,
  cancelled,
}
