# DigitalOcean Spaces Setup for File Uploads

## Overview
The chat app uses DigitalOcean Spaces (S3-compatible storage) for file attachments including images, videos, audio, and documents.

## Required Environment Variables

Add these to your backend `.env` file and DigitalOcean App Platform environment:

```bash
# DigitalOcean Spaces Configuration
SPACES_ENDPOINT=nyc3.digitaloceanspaces.com
SPACES_BUCKET=your-bucket-name
SPACES_KEY=your-spaces-access-key
SPACES_SECRET=your-spaces-secret-key
SPACES_REGION=nyc3
```

## Setup Instructions

### 1. Create DigitalOcean Space
1. Log into DigitalOcean Dashboard
2. Go to **Spaces** → **Create a Space**
3. Choose region (e.g., NYC3)
4. Enter bucket name (e.g., `chat-app-files`)
5. Set to **Public** (files need to be publicly accessible)
6. Enable CDN for better performance

### 2. Generate Access Keys
1. Go to **API** → **Spaces Keys**
2. Click **Generate New Key**
3. Name it `chat-app-uploads`
4. Copy the **Key** and **Secret** (secret shown only once!)

### 3. Configure Environment Variables

#### Local Development (backend/.env):
```bash
SPACES_ENDPOINT=nyc3.digitaloceanspaces.com
SPACES_BUCKET=your-actual-bucket-name
SPACES_KEY=your-actual-access-key
SPACES_SECRET=your-actual-secret-key
SPACES_REGION=nyc3
```

#### Production (DigitalOcean App Platform):
1. Go to your App → **Settings** → **Environment Variables**
2. Add each variable with the values above

### 4. Test Upload Functionality
Once deployed, test with:
```bash
curl -X POST https://your-backend-url/api/upload/file \
  -F "file=@test-image.jpg" \
  -H "Content-Type: multipart/form-data"
```

## File Types Supported
- **Images**: JPEG, PNG, GIF, WebP, SVG
- **Videos**: MP4, WebM, QuickTime
- **Audio**: MP3, WAV, WebM, OGG
- **Documents**: PDF, Word, Text, CSV
- **Archives**: ZIP

## File Size Limits
- Maximum file size: 100MB per file
- Maximum files per upload: 10 files

## Security Features
- File type validation
- Size limits
- Unique filename generation
- Public read access (for chat sharing)
- 1-year cache headers for performance

## File URL Structure
Files are stored with this pattern:
```
https://your-bucket.nyc3.digitaloceanspaces.com/chat-uploads/timestamp-hash-filename.ext
```

Example:
```
https://chat-app-files.nyc3.digitaloceanspaces.com/chat-uploads/1703123456789-abc123def456-document.pdf
```

## Pricing (as of 2024)
- **Storage**: $5/month for 250GB
- **Bandwidth**: $0.01/GB outbound
- **CDN**: Included for faster global delivery

## Troubleshooting

### Upload Fails with CORS Error
Add these CORS settings to your Space:
1. Go to Space → **Settings** → **CORS**
2. Add rule:
   ```json
   {
     "AllowedOrigins": ["*"],
     "AllowedMethods": ["GET", "POST", "PUT"],
     "AllowedHeaders": ["*"]
   }
   ```

### Files Not Publicly Accessible
Ensure your Space is set to **Public** in the settings.

### Environment Variables Not Working
Verify all variables are set correctly with no typos. Restart your backend after changes.

## Database Migration
Run this migration on production to add attachment support:
```sql
-- This will be automatically run on deployment
ALTER TABLE messages ADD COLUMN attachments JSONB DEFAULT '[]'::jsonb;
```

## Integration with Chat App

### Frontend Upload Flow:
1. User selects files via + button
2. Files uploaded to `/api/upload/files`
3. Returns file metadata
4. Metadata stored with message
5. Files displayed inline in chat

### Backend Processing:
1. Validates file types and sizes
2. Generates unique filenames
3. Uploads to DigitalOcean Spaces
4. Returns public URLs
5. Stores metadata in database

The system is now ready for production file sharing! 🚀
