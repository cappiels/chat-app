# Flutter Image Upload Preview Fix

## Issue
Images uploaded from Flutter iOS app were not displaying inline in the thread - only showing as filename links. Images uploaded from the React web app displayed correctly inline in both platforms.

## Root Cause
The Flutter `file_upload_service.dart` was NOT sending the `Content-Type` header when uploading files via multipart/form-data. This caused the backend (multer) to receive files without proper MIME type information, resulting in:

1. Images stored with incorrect or missing `mime_type` in the database
2. React's `Message.jsx` component checking `attachment.type.startsWith('image/')` returning false
3. Images falling through to the "other files" rendering branch (showing as download links)

## Fix Applied

### 1. Added Content-Type Header to Multipart Upload

**File:** `mobile/lib/data/services/file_upload_service.dart`

```dart
// BEFORE: Missing content-type
final multipartFile = http.MultipartFile(
  'file',
  fileStream,
  fileSize,
  filename: fileName,
);

// AFTER: Includes content-type for proper MIME detection
MediaType? contentType;
if (mimeType.contains('/')) {
  final parts = mimeType.split('/');
  contentType = MediaType(parts[0], parts.length > 1 ? parts[1] : 'octet-stream');
}

final multipartFile = http.MultipartFile(
  'file',
  fileStream,
  fileSize,
  filename: fileName,
  contentType: contentType,  // Critical for image preview!
);
```

### 2. Added http_parser Dependency

**File:** `mobile/pubspec.yaml`

```yaml
dependencies:
  http_parser: ^4.0.2  # For MediaType class
```

### 3. Import Statement

**File:** `mobile/lib/data/services/file_upload_service.dart`

```dart
import 'package:http_parser/http_parser.dart';
```

## Data Flow

### React Upload (Working):
1. FormData with `files` field → Browser automatically adds Content-Type
2. Backend multer detects MIME type correctly
3. Stored as `mime_type: 'image/jpeg'` in database
4. Retrieved and displayed as image in Message.jsx

### Flutter Upload (Before Fix):
1. MultipartFile without contentType → Server receives `application/octet-stream`
2. Backend stores incorrect MIME type
3. Retrieved with wrong `mime_type`
4. React can't detect it as an image

### Flutter Upload (After Fix):
1. MultipartFile with `contentType: MediaType('image', 'jpeg')`
2. Server receives correct MIME type
3. Stored correctly in database
4. Displayed as inline image in both React and Flutter

## Testing

1. Rebuild Flutter app: `cd mobile && flutter build ios`
2. Upload an image from the Flutter iOS app
3. Verify the image displays inline in:
   - The Flutter app itself
   - The React web app when viewing the same thread

## Date
November 30, 2025
