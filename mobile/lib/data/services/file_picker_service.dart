import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:file_picker/file_picker.dart';
import 'package:image_picker/image_picker.dart';
import 'package:image/image.dart' as img;
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as path;

/// 🏆 WORLD-CLASS FILE PICKER SERVICE
/// Mobile-optimized file selection with camera, gallery, and document picking
class FilePickerService {
  static final FilePickerService _instance = FilePickerService._internal();
  factory FilePickerService() => _instance;
  FilePickerService._internal();

  final ImagePicker _imagePicker = ImagePicker();

  /// Pick image from gallery (optimized for mobile)
  Future<File?> pickImageFromGallery({
    int maxWidth = 1920,
    int maxHeight = 1920,
    int imageQuality = 85,
  }) async {
    try {
      final XFile? pickedFile = await _imagePicker.pickImage(
        source: ImageSource.gallery,
        maxWidth: maxWidth.toDouble(),
        maxHeight: maxHeight.toDouble(),
        imageQuality: imageQuality,
      );

      if (pickedFile == null) return null;

      debugPrint('📷 Image picked from gallery: ${pickedFile.path}');
      return File(pickedFile.path);
    } catch (e) {
      debugPrint('❌ Error picking image from gallery: $e');
      return null;
    }
  }

  /// Take photo with camera (optimized for mobile)
  Future<File?> takePhoto({
    int maxWidth = 1920,
    int maxHeight = 1920,
    int imageQuality = 85,
  }) async {
    try {
      final XFile? pickedFile = await _imagePicker.pickImage(
        source: ImageSource.camera,
        maxWidth: maxWidth.toDouble(),
        maxHeight: maxHeight.toDouble(),
        imageQuality: imageQuality,
      );

      if (pickedFile == null) return null;

      debugPrint('📸 Photo taken with camera: ${pickedFile.path}');
      return File(pickedFile.path);
    } catch (e) {
      debugPrint('❌ Error taking photo: $e');
      return null;
    }
  }

  /// Pick video from gallery
  Future<File?> pickVideoFromGallery() async {
    try {
      final XFile? pickedFile = await _imagePicker.pickVideo(
        source: ImageSource.gallery,
        maxDuration: const Duration(minutes: 10), // 10-minute limit
      );

      if (pickedFile == null) return null;

      debugPrint('🎥 Video picked from gallery: ${pickedFile.path}');
      return File(pickedFile.path);
    } catch (e) {
      debugPrint('❌ Error picking video: $e');
      return null;
    }
  }

  /// Record video with camera
  Future<File?> recordVideo() async {
    try {
      final XFile? pickedFile = await _imagePicker.pickVideo(
        source: ImageSource.camera,
        maxDuration: const Duration(minutes: 10),
      );

      if (pickedFile == null) return null;

      debugPrint('🎬 Video recorded with camera: ${pickedFile.path}');
      return File(pickedFile.path);
    } catch (e) {
      debugPrint('❌ Error recording video: $e');
      return null;
    }
  }

  /// Pick multiple images from gallery
  Future<List<File>> pickMultipleImages({
    int maxImages = 10,
    int imageQuality = 85,
  }) async {
    try {
      final List<XFile> pickedFiles = await _imagePicker.pickMultiImage(
        maxWidth: 1920,
        maxHeight: 1920,
        imageQuality: imageQuality,
      );

      if (pickedFiles.isEmpty) return [];

      // Limit number of images
      final limitedFiles = pickedFiles.take(maxImages).toList();

      debugPrint('📷 ${limitedFiles.length} images picked from gallery');
      return limitedFiles.map((xFile) => File(xFile.path)).toList();
    } catch (e) {
      debugPrint('❌ Error picking multiple images: $e');
      return [];
    }
  }

  /// Pick document files (PDF, Word, Excel, etc.)
  Future<List<File>> pickDocuments({
    List<String>? allowedExtensions,
    bool allowMultiple = false,
  }) async {
    try {
      FilePickerResult? result = await FilePicker.platform.pickFiles(
        type: allowedExtensions != null ? FileType.custom : FileType.any,
        allowedExtensions: allowedExtensions,
        allowMultiple: allowMultiple,
        withData: false, // Don't load file data into memory
      );

      if (result == null || result.files.isEmpty) return [];

      final files = result.files
          .where((file) => file.path != null)
          .map((file) => File(file.path!))
          .toList();

      debugPrint('📎 ${files.length} document(s) picked');
      return files;
    } catch (e) {
      debugPrint('❌ Error picking documents: $e');
      return [];
    }
  }

  /// Show file picker options dialog (images, documents, camera)
  Future<PickedFileResult?> showFilePickerOptions({
    required Function(FilePickerOption) onOptionSelected,
  }) async {
    // This would typically show a bottom sheet in the UI
    // For now, just document the interface
    return null;
  }

  /// Compress image for mobile optimization
  Future<File?> compressImage(
    File file, {
    int maxWidth = 1920,
    int maxHeight = 1920,
    int quality = 85,
  }) async {
    try {
      // Read image
      final bytes = await file.readAsBytes();
      img.Image? image = img.decodeImage(bytes);
      
      if (image == null) {
        debugPrint('❌ Failed to decode image');
        return null;
      }

      // Resize if needed
      if (image.width > maxWidth || image.height > maxHeight) {
        image = img.copyResize(
          image,
          width: image.width > maxWidth ? maxWidth : null,
          height: image.height > maxHeight ? maxHeight : null,
        );
      }

      // Compress and save
      final compressedBytes = img.encodeJpg(image, quality: quality);
      
      // Create temp file
      final tempDir = await getTemporaryDirectory();
      final fileName = 'compressed_${path.basename(file.path)}';
      final compressedFile = File('${tempDir.path}/$fileName');
      
      await compressedFile.writeAsBytes(compressedBytes);
      
      final originalSize = await file.length();
      final compressedSize = await compressedFile.length();
      final savedPercentage = ((originalSize - compressedSize) / originalSize * 100).toStringAsFixed(1);
      
      debugPrint('✅ Image compressed: ${_formatBytes(originalSize)} → ${_formatBytes(compressedSize)} (saved $savedPercentage%)');
      
      return compressedFile;
    } catch (e) {
      debugPrint('❌ Error compressing image: $e');
      return null;
    }
  }

  /// Validate file size (max 25MB for free tier, 100MB for paid)
  bool validateFileSize(File file, int maxBytes) {
    final fileSize = file.lengthSync();
    return fileSize <= maxBytes;
  }

  /// Get file size in bytes
  Future<int> getFileSize(File file) async {
    return await file.length();
  }

  /// Format bytes to human-readable string
  String _formatBytes(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    if (bytes < 1024 * 1024 * 1024) {
      return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
    }
    return '${(bytes / (1024 * 1024 * 1024)).toStringAsFixed(1)} GB';
  }
}

/// File picker option for UI
enum FilePickerOption {
  camera,
  gallery,
  multipleImages,
  document,
  video,
  recordVideo,
}

/// Result from file picking
class PickedFileResult {
  final List<File> files;
  final FilePickerOption option;

  PickedFileResult({
    required this.files,
    required this.option,
  });

  bool get hasFiles => files.isNotEmpty;
  File? get firstFile => files.isNotEmpty ? files.first : null;
}

/// File size limits based on subscription tier
class FileSizeLimits {
  static const int freeTier = 25 * 1024 * 1024; // 25 MB
  static const int paidTier = 100 * 1024 * 1024; // 100 MB
  static const int imageMaxDimension = 4096; // Max 4K images
  static const int videoMaxDuration = 10 * 60; // 10 minutes
}
