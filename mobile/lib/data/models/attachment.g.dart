// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'attachment.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Attachment _$AttachmentFromJson(Map<String, dynamic> json) => Attachment(
  id: json['id'] as String,
  fileName: json['file_name'] as String,
  fileUrl: json['file_url'] as String,
  mimeType: json['mime_type'] as String,
  fileSizeBytes: (json['file_size_bytes'] as num).toInt(),
  thumbnailUrl: json['thumbnail_url'] as String?,
  uploadedAt: DateTime.parse(json['uploaded_at'] as String),
);

Map<String, dynamic> _$AttachmentToJson(Attachment instance) =>
    <String, dynamic>{
      'id': instance.id,
      'file_name': instance.fileName,
      'file_url': instance.fileUrl,
      'mime_type': instance.mimeType,
      'file_size_bytes': instance.fileSizeBytes,
      'thumbnail_url': instance.thumbnailUrl,
      'uploaded_at': instance.uploadedAt.toIso8601String(),
    };
