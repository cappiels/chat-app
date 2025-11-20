import 'package:json_annotation/json_annotation.dart';

part 'attachment.g.dart';

@JsonSerializable()
class Attachment {
  final String id;
  @JsonKey(name: 'file_name')
  final String fileName;
  @JsonKey(name: 'file_url')
  final String fileUrl;
  @JsonKey(name: 'mime_type')
  final String mimeType;
  @JsonKey(name: 'file_size_bytes')
  final int fileSizeBytes;
  @JsonKey(name: 'thumbnail_url')
  final String? thumbnailUrl;
  @JsonKey(name: 'uploaded_at')
  final DateTime uploadedAt;

  // Local state for UI
  @JsonKey(includeFromJson: false, includeToJson: false)
  final double? uploadProgress;
  @JsonKey(includeFromJson: false, includeToJson: false)
  final bool isUploading;
  @JsonKey(includeFromJson: false, includeToJson: false)
  final String? localPath;

  const Attachment({
    required this.id,
    required this.fileName,
    required this.fileUrl,
    required this.mimeType,
    required this.fileSizeBytes,
    this.thumbnailUrl,
    required this.uploadedAt,
    this.uploadProgress,
    this.isUploading = false,
    this.localPath,
  });

  factory Attachment.fromJson(Map<String, dynamic> json) => _$AttachmentFromJson(json);
  Map<String, dynamic> toJson() => _$AttachmentToJson(this);

  // Create a temporary attachment for local files being uploaded
  factory Attachment.temp({
    required String tempId,
    required String fileName,
    required String mimeType,
    required int fileSizeBytes,
    required String localPath,
    String? thumbnailUrl,
  }) {
    return Attachment(
      id: tempId,
      fileName: fileName,
      fileUrl: '', // Will be set after upload
      mimeType: mimeType,
      fileSizeBytes: fileSizeBytes,
      thumbnailUrl: thumbnailUrl,
      uploadedAt: DateTime.now(),
      uploadProgress: 0.0,
      isUploading: true,
      localPath: localPath,
    );
  }

  Attachment copyWith({
    String? id,
    String? fileName,
    String? fileUrl,
    String? mimeType,
    int? fileSizeBytes,
    String? thumbnailUrl,
    DateTime? uploadedAt,
    double? uploadProgress,
    bool? isUploading,
    String? localPath,
  }) {
    return Attachment(
      id: id ?? this.id,
      fileName: fileName ?? this.fileName,
      fileUrl: fileUrl ?? this.fileUrl,
      mimeType: mimeType ?? this.mimeType,
      fileSizeBytes: fileSizeBytes ?? this.fileSizeBytes,
      thumbnailUrl: thumbnailUrl ?? this.thumbnailUrl,
      uploadedAt: uploadedAt ?? this.uploadedAt,
      uploadProgress: uploadProgress ?? this.uploadProgress,
      isUploading: isUploading ?? this.isUploading,
      localPath: localPath ?? this.localPath,
    );
  }

  // Helper getters
  bool get isImage => mimeType.startsWith('image/');
  bool get isVideo => mimeType.startsWith('video/');
  bool get isAudio => mimeType.startsWith('audio/');
  bool get isDocument => !isImage && !isVideo && !isAudio;
  
  String get fileSizeFormatted {
    final sizeInMB = fileSizeBytes / (1024 * 1024);
    if (sizeInMB < 1) {
      final sizeInKB = fileSizeBytes / 1024;
      return '${sizeInKB.toStringAsFixed(0)} KB';
    } else {
      return '${sizeInMB.toStringAsFixed(1)} MB';
    }
  }

  String get fileExtension {
    final parts = fileName.split('.');
    return parts.length > 1 ? parts.last.toUpperCase() : 'FILE';
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Attachment &&
          runtimeType == other.runtimeType &&
          id == other.id;

  @override
  int get hashCode => id.hashCode;
}

enum AttachmentType {
  image,
  video,
  audio,
  document,
}

extension AttachmentTypeExtension on AttachmentType {
  static AttachmentType fromMimeType(String mimeType) {
    if (mimeType.startsWith('image/')) return AttachmentType.image;
    if (mimeType.startsWith('video/')) return AttachmentType.video;
    if (mimeType.startsWith('audio/')) return AttachmentType.audio;
    return AttachmentType.document;
  }
}
