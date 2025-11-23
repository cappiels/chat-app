# Inline Image Display & Preview Modal - Implementation Plan

## Overview
Display uploaded images inline in chat messages with click-to-preview functionality (like Slack/iMessage).

## Current State
- ✅ Files upload to DigitalOcean Spaces successfully
- ✅ File URLs returned from upload API
- ❌ Images not displayed inline in messages
- ❌ No preview modal on click

---

## React Frontend Implementation

### 1. Inline Image Display in Messages

**File**: `frontend/src/components/chat/Message.jsx`

**Changes Needed**:
```jsx
// After message content, check for attachments
{message.attachments && message.attachments.length > 0 && (
  <div className="mt-2 space-y-2">
    {message.attachments.map((attachment, index) => {
      // Check if attachment is an image
      const isImage = attachment.type?.startsWith('image/');
      
      if (isImage) {
        return (
          <img 
            key={index}
            src={attachment.url}
            alt={attachment.name}
            className="max-w-xs rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => openImagePreview(attachment.url, attachment.name)}
            loading="lazy"
          />
        );
      } else {
        // Non-image attachments: show file link
        return (
          <a 
            key={index}
            href={attachment.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-blue-600 hover:underline"
          >
            <FileIcon /> {attachment.name} ({formatFileSize(attachment.size)})
          </a>
        );
      }
    })}
  </div>
)}
```

### 2. Image Preview Modal

**File**: Create `frontend/src/components/chat/ImagePreviewModal.jsx`

**Implementation**:
```jsx
import React from 'react';
import { X, Download, ZoomIn, ZoomOut } from 'lucide-react';

const ImagePreviewModal = ({ imageUrl, imageName, isOpen, onClose }) => {
  const [zoom, setZoom] = useState(100);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="relative max-w-7xl max-h-screen p-4">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white hover:bg-white/20 rounded-full p-2"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Zoom controls */}
        <div className="absolute top-4 left-4 flex gap-2">
          <button onClick={() => setZoom(z => Math.min(z + 25, 200))}>
            <ZoomIn className="w-5 h-5 text-white" />
          </button>
          <button onClick={() => setZoom(z => Math.max(z - 25, 50))}>
            <ZoomOut className="w-5 h-5 text-white" />
          </button>
          <span className="text-white">{zoom}%</span>
        </div>

        {/* Download button */}
        <a
          href={imageUrl}
          download={imageName}
          className="absolute bottom-4 right-4 text-white hover:bg-white/20 rounded-full p-2"
        >
          <Download className="w-5 h-5" />
        </a>

        {/* Image */}
        <img
          src={imageUrl}
          alt={imageName}
          className="max-w-full max-h-screen object-contain"
          style={{ transform: `scale(${zoom / 100})` }}
          onClick={(e) => e.stopPropagation()}
        />

        {/* Image name */}
        <div className="absolute bottom-4 left-4 text-white text-sm bg-black/50 px-3 py-1 rounded">
          {imageName}
        </div>
      </div>
    </div>
  );
};
```

### 3. State Management for Modal

**File**: `frontend/src/components/chat/MessageList.jsx` or `ChatScreen.jsx`

**Add State**:
```jsx
const [previewImage, setPreviewImage] = useState(null);

const openImagePreview = (url, name) => {
  setPreviewImage({ url, name });
};

const closeImagePreview = () => {
  setPreviewImage(null);
};

// In render:
<ImagePreviewModal
  imageUrl={previewImage?.url}
  imageName={previewImage?.name}
  isOpen={!!previewImage}
  onClose={closeImagePreview}
/>
```

### 4. Image Grid for Multiple Images

**For messages with multiple images** (like group photos):
```jsx
<div className="grid grid-cols-2 gap-2 mt-2">
  {imageAttachments.map((img, i) => (
    <img 
      key={i}
      src={img.url}
      className="w-full h-32 object-cover rounded-lg cursor-pointer"
      onClick={() => openImagePreview(img.url, img.name)}
    />
  ))}
</div>
```

---

## Flutter iOS Implementation

### 1. Inline Image Display

**File**: `mobile/lib/presentation/widgets/chat/message_bubble.dart`

**Changes Needed**:
```dart
// After text content, check for attachments
if (message.attachments != null && message.attachments!.isNotEmpty) {
  ...Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: message.attachments!.map((attachment) {
      final isImage = attachment.type?.startsWith('image/') ?? false;
      
      if (isImage) {
        return GestureDetector(
          onTap: () => _openImagePreview(context, attachment.url, attachment.name),
          child: Container(
            constraints: BoxConstraints(maxWidth: 300),
            margin: EdgeInsets.only(top: 8),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: CachedNetworkImage(
                imageUrl: attachment.url,
                fit: BoxFit.cover,
                placeholder: (context, url) => Container(
                  height: 200,
                  color: Colors.grey[200],
                  child: Center(child: CircularProgressIndicator()),
                ),
                errorWidget: (context, url, error) => Icon(Icons.error),
              ),
            ),
          ),
        );
      } else {
        // Non-image: show file link
        return InkWell(
          onTap: () => _openFile(attachment.url),
          child: Container(
            padding: EdgeInsets.all(12),
            margin: EdgeInsets.only(top: 8),
            decoration: BoxDecoration(
              color: Colors.grey[100],
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              children: [
                Icon(Icons.insert_drive_file),
                SizedBox(width: 8),
                Expanded(child: Text(attachment.name)),
                Text(_formatFileSize(attachment.size)),
              ],
            ),
          ),
        );
      }
    }).toList(),
  ),
}
```

### 2. Image Preview Modal (Full Screen)

**File**: Create `mobile/lib/presentation/widgets/chat/image_preview_modal.dart`

**Implementation**:
```dart
import 'package:flutter/material.dart';
import 'package:photo_view/photo_view.dart';
import 'package:cached_network_image/cached_network_image.dart';

class ImagePreviewModal extends StatelessWidget {
  final String imageUrl;
  final String imageName;

  const ImagePreviewModal({
    required this.imageUrl,
    required this.imageName,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        iconTheme: IconThemeData(color: Colors.white),
        title: Text(
          imageName,
          style: TextStyle(color: Colors.white, fontSize: 14),
          overflow: TextOverflow.ellipsis,
        ),
        actions: [
          IconButton(
            icon: Icon(Icons.download),
            onPressed: () => _downloadImage(imageUrl, imageName),
          ),
        ],
      ),
      body: Center(
        child: PhotoView(
          imageProvider: CachedNetworkImageProvider(imageUrl),
          minScale: PhotoViewComputedScale.contained,
          maxScale: PhotoViewComputedScale.covered * 3,
          backgroundDecoration: BoxDecoration(color: Colors.black),
          loadingBuilder: (context, event) => Center(
            child: CircularProgressIndicator(
              value: event == null ? 0 : event.cumulativeBytesLoaded / event.expectedTotalBytes!,
            ),
          ),
          errorBuilder: (context, error, stackTrace) => Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.error, color: Colors.white, size: 48),
                SizedBox(height: 16),
                Text('Failed to load image', style: TextStyle(color: Colors.white)),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _downloadImage(String url, String filename) {
    // TODO: Implement download
    // Use url_launcher or download to device
  }
}
```

### 3. Open Preview Function

**In `message_bubble.dart`**:
```dart
void _openImagePreview(BuildContext context, String url, String name) {
  Navigator.of(context).push(
    MaterialPageRoute(
      fullscreenDialog: true,
      builder: (context) => ImagePreviewModal(
        imageUrl: url,
        imageName: name,
      ),
    ),
  );
}
```

### 4. Multiple Image Grid (iOS)

**For multiple images**:
```dart
GridView.builder(
  shrinkWrap: true,
  physics: NeverScrollableScrollPhysics(),
  gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
    crossAxisCount: 2,
    crossAxisSpacing: 8,
    mainAxisSpacing: 8,
    childAspectRatio: 1,
  ),
  itemCount: imageAttachments.length,
  itemBuilder: (context, index) {
    final attachment = imageAttachments[index];
    return GestureDetector(
      onTap: () => _openImagePreview(context, attachment.url, attachment.name),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: CachedNetworkImage(
          imageUrl: attachment.url,
          fit: BoxFit.cover,
          placeholder: (context, url) => Container(color: Colors.grey[200]),
        ),
      ),
    );
  },
)
```

---

## Implementation Steps

### Phase 1: React Inline Images (2-3 hours)
1. Update `Message.jsx` to detect image attachments
2. Render `<img>` tags for images inline
3. Add click handler to open modal
4. Style images (max-width, rounded corners, hover effect)

### Phase 2: React Preview Modal (2-3 hours)
1. Create `ImagePreviewModal.jsx` component
2. Add zoom in/out functionality
3. Add download button
4. Add keyboard navigation (ESC to close, arrows for multiple images)
5. Integrate with MessageList state

### Phase 3: Flutter Inline Images (3-4 hours)
1. Update `message_bubble.dart` to detect image attachments
2. Use `CachedNetworkImage` for efficient loading
3. Add tap gesture to open preview
4. Handle loading states and errors
5. Grid layout for multiple images

### Phase 4: Flutter Preview Modal (3-4 hours)
1. Create `image_preview_modal.dart`
2. Integrate `photo_view` package for pinch-zoom
3. Add download functionality
4. Swipe gestures for multiple images
5. Handle orientation changes

---

## Key Features to Include

### Both Platforms:
- ✅ Lazy loading images (don't load until scrolled into view)
- ✅ Loading placeholders/spinners
- ✅ Error handling for failed image loads
- ✅ Download button in preview
- ✅ Zoom in/out in preview
- ✅ Image name/size display
- ✅ Close on background click/tap

### React Specific:
- ✅ Keyboard shortcuts (ESC to close, arrows for navigation)
- ✅ Responsive sizing (mobile vs desktop)
- ✅ Gallery mode for multiple images

### Flutter Specific:
- ✅ Pinch-to-zoom gesture
- ✅ Swipe gestures for navigation
- ✅ Hero animation from thumbnail to preview
- ✅ Share button (iOS share sheet)

---

## File Type Detection

### Identifying Images:
```javascript
// React
const isImage = attachment.type?.startsWith('image/');
const isVideo = attachment.type?.startsWith('video/');
const isPDF = attachment.type === 'application/pdf';

// Flutter
final isImage = attachment.type?.startsWith('image/') ?? false;
final isVideo = attachment.type?.startsWith('video/') ?? false;
```

### Supported Image Formats:
- JPEG/JPG
- PNG
- GIF (animated)
- WebP
- SVG
- HEIC/HEIF (Apple photos)

---

## Database Schema

### Current `attachments` field in messages table:
```json
[
  {
    "id": "uuid",
    "name": "screenshot.png",
    "size": 95324,
    "type": "image/png",
    "url": "https://chitchat.nyc3.digitaloceanspaces.com/...",
    "fileId": "chat-uploads/...",
    "source": "digitalocean_spaces"
  }
]
```

**Already has everything needed!** No schema changes required.

---

## Optimization Considerations

### 1. Thumbnail Generation (Future)
Create thumbnails on upload for faster loading:
- Small: 150x150px for inline display
- Medium: 800x800px for preview
- Original: Full resolution for download

### 2. Progressive Loading
- Show low-res placeholder first
- Load full resolution after

### 3. Caching
- React: Use browser cache + lazy loading
- Flutter: `CachedNetworkImage` handles this automatically

### 4. Gallery Mode
For messages with 2+ images:
- Grid layout inline
- Swipe between images in preview
- Show current image number (1/5, 2/5, etc.)

---

## Example Code Snippets

### React: Open Preview Function
```javascript
const [previewImage, setPreviewImage] = useState(null);

const openImagePreview = (url, name) => {
  setPreviewImage({ url, name });
  document.body.style.overflow = 'hidden'; // Prevent background scroll
};

const closeImagePreview = () => {
  setPreviewImage(null);
  document.body.style.overflow = 'auto';
};

// Keyboard handler
useEffect(() => {
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') closeImagePreview();
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, []);
```

### Flutter: Hero Animation
```dart
// In message bubble (thumbnail)
Hero(
  tag: 'image_${attachment.id}',
  child: CachedNetworkImage(imageUrl: attachment.url),
)

// In preview modal (full screen)
Hero(
  tag: 'image_${attachment.id}',
  child: PhotoView(imageProvider: CachedNetworkImageProvider(url)),
)
```

---

## Dependencies Needed

### React:
- ✅ Already have lucide-react for icons
- **Optional**: `react-image-gallery` for advanced gallery features

### Flutter:
- ✅ Already have `photo_view: ^0.14.0`
- ✅ Already have `cached_network_image: ^3.4.0`
- **Optional**: `flutter_cache_manager` for advanced caching

---

## File Locations to Modify

### React:
1. `frontend/src/components/chat/Message.jsx` - Add inline image rendering
2. `frontend/src/components/chat/ImagePreviewModal.jsx` - NEW FILE for modal
3. `frontend/src/components/chat/MessageList.jsx` - Add modal state management

### Flutter:
1. `mobile/lib/presentation/widgets/chat/message_bubble.dart` - Add inline images
2. `mobile/lib/presentation/widgets/chat/image_preview_modal.dart` - NEW FILE (or use existing `image_viewer.dart`)
3. `mobile/lib/data/models/message.dart` - Ensure attachment model is complete

---

## Testing Checklist

### Both Platforms:
- [ ] Upload image, verify displays inline
- [ ] Click image, verify modal opens
- [ ] Zoom in/out works
- [ ] Download button works
- [ ] Close modal (button, background click, ESC key)
- [ ] Multiple images in one message
- [ ] Mix of images and files (PDFs, docs)
- [ ] Very large images (>10MB)
- [ ] Portrait vs landscape images
- [ ] GIF animations play correctly

### React Specific:
- [ ] Responsive on mobile browser
- [ ] Keyboard shortcuts work
- [ ] Background scroll disabled when modal open

### Flutter Specific:
- [ ] Pinch-to-zoom gesture
- [ ] Hero animation smooth
- [ ] Swipe between multiple images
- [ ] Share button functional

---

## Estimated Timeline

### React Implementation:
- Inline images: 2-3 hours
- Preview modal: 2-3 hours
- Polish & testing: 1-2 hours
**Total**: 5-8 hours

### Flutter Implementation:
- Inline images: 3-4 hours
- Preview modal: 3-4 hours
- Polish & testing: 2-3 hours
**Total**: 8-11 hours

### Both Platforms: 13-19 hours total

---

## Priority Order

1. **React inline images** - Most users on web
2. **React preview modal** - Complete web experience
3. **Flutter inline images** - Mobile parity
4. **Flutter preview modal** - Complete mobile experience

---

## Notes

- Image URLs from Spaces are already public and accessible
- No authentication needed for viewing (ACL: public-read)
- Consider lazy loading for message lists with many images
- Add loading skeletons for better UX
- Handle network errors gracefully (show broken image icon)
