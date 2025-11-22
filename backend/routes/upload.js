const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const router = express.Router();
const googleDriveHelper = require('../utils/googleDriveHelper');
const spacesHelper = require('../utils/spacesHelper');

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow common file types including Apple's HEIC format
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
      'image/heic', 'image/heif', // Apple's High Efficiency Image formats
      'video/mp4', 'video/webm', 'video/quicktime',
      'audio/mpeg', 'audio/wav', 'audio/webm', 'audio/ogg',
      'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain', 'text/csv',
      'application/zip', 'application/x-zip-compressed'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`), false);
    }
  }
});

// Upload single file (hybrid: Spaces for files, Google Drive as fallback)
router.post('/file', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    // Get workspace and channel names from request body or headers
    const workspaceName = req.body.workspaceName || req.headers['x-workspace-name'] || 'Default Workspace';
    const channelName = req.body.channelName || req.headers['x-channel-name'] || 'Default Channel';
    const uploaderEmail = req.body.uploaderEmail || req.headers['x-uploader-email'] || req.user?.email;

    // Try DigitalOcean Spaces first (preferred for regular file uploads)
    if (spacesHelper.isAvailable()) {
      console.log(`📤 Uploading file to DigitalOcean Spaces: ${req.file.originalname}`);
      console.log(`   Workspace: ${workspaceName}, Channel: ${channelName}`);

      const spacesFile = await spacesHelper.uploadFile(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        workspaceName,
        channelName
      );

      // Return file information
      return res.json({
        id: crypto.randomUUID(),
        name: spacesFile.fileName,
        size: spacesFile.size,
        type: spacesFile.mimeType,
        url: spacesFile.url,
        fileId: spacesFile.fileId,
        source: spacesFile.source
      });
    }

    // Fallback to Google Drive if Spaces not available
    console.log(`📤 Uploading file to Google Drive (Spaces not configured): ${req.file.originalname}`);
    console.log(`   Workspace: ${workspaceName}, Channel: ${channelName}`);

    const driveFile = await googleDriveHelper.uploadFile(
      req.file.buffer,
      req.file.originalname,
      workspaceName,
      channelName,
      uploaderEmail
    );

    // Return file information
    res.json({
      id: crypto.randomUUID(),
      name: driveFile.fileName,
      size: driveFile.size,
      type: driveFile.mimeType,
      url: driveFile.directUrl || driveFile.webViewLink,
      webViewLink: driveFile.webViewLink,
      downloadUrl: driveFile.webContentLink,
      fileId: driveFile.fileId,
      source: 'google_drive'
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      error: 'Upload failed',
      details: error.message 
    });
  }
});

// Upload multiple files (hybrid: Spaces for files, Google Drive as fallback)
router.post('/files', upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    // Get workspace and channel names from request body or headers
    const workspaceName = req.body.workspaceName || req.headers['x-workspace-name'] || 'Default Workspace';
    const channelName = req.body.channelName || req.headers['x-channel-name'] || 'Default Channel';
    const uploaderEmail = req.body.uploaderEmail || req.headers['x-uploader-email'] || req.user?.email;

    // Try DigitalOcean Spaces first (preferred)
    if (spacesHelper.isAvailable()) {
      console.log(`📤 Uploading ${req.files.length} files to DigitalOcean Spaces`);
      console.log(`   Workspace: ${workspaceName}, Channel: ${channelName}`);

      const uploadPromises = req.files.map(async (file) => {
        const spacesFile = await spacesHelper.uploadFile(
          file.buffer,
          file.originalname,
          file.mimetype,
          workspaceName,
          channelName
        );

        return {
          id: crypto.randomUUID(),
          name: spacesFile.fileName,
          size: spacesFile.size,
          type: spacesFile.mimeType,
          url: spacesFile.url,
          fileId: spacesFile.fileId,
          source: spacesFile.source
        };
      });

      const uploads = await Promise.all(uploadPromises);
      return res.json({ files: uploads });
    }

    // Fallback to Google Drive if Spaces not available
    console.log(`📤 Uploading ${req.files.length} files to Google Drive (Spaces not configured)`);
    console.log(`   Workspace: ${workspaceName}, Channel: ${channelName}`);

    const uploadPromises = req.files.map(async (file) => {
      const driveFile = await googleDriveHelper.uploadFile(
        file.buffer,
        file.originalname,
        workspaceName,
        channelName,
        uploaderEmail
      );

      return {
        id: crypto.randomUUID(),
        name: driveFile.fileName,
        size: driveFile.size,
        type: driveFile.mimeType,
        url: driveFile.directUrl || driveFile.webViewLink,
        webViewLink: driveFile.webViewLink,
        downloadUrl: driveFile.webContentLink,
        fileId: driveFile.fileId,
        source: 'google_drive'
      };
    });

    const uploads = await Promise.all(uploadPromises);
    res.json({ files: uploads });

  } catch (error) {
    console.error('Multi-upload error:', error);
    
    // Provide specific error message based on the issue
    let errorMessage = 'Upload failed';
    if (!spacesHelper.isAvailable()) {
      errorMessage = 'File storage not configured. Please contact support.';
    } else {
      errorMessage = error.message || 'Upload failed';
    }
    
    res.status(500).json({ 
      error: errorMessage,
      details: error.message,
      storageAvailable: spacesHelper.isAvailable()
    });
  }
});

// Create Google Doc
router.post('/create-doc', async (req, res) => {
  try {
    const { title, workspaceName, channelName, uploaderEmail } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    console.log(`📝 Creating Google Doc: ${title}`);
    console.log(`   Workspace: ${workspaceName}, Channel: ${channelName}`);

    const doc = await googleDriveHelper.createGoogleDoc(
      title,
      workspaceName || 'Default Workspace',
      channelName || 'Default Channel',
      uploaderEmail
    );

    res.json({
      id: crypto.randomUUID(),
      name: doc.fileName,
      type: doc.mimeType,
      url: doc.webViewLink,
      fileId: doc.fileId,
      source: 'google_drive',
      docType: 'google_doc'
    });

  } catch (error) {
    console.error('Create Doc error:', error);
    res.status(500).json({ 
      error: 'Failed to create Google Doc',
      details: error.message 
    });
  }
});

// Create Google Sheet
router.post('/create-sheet', async (req, res) => {
  try {
    const { title, workspaceName, channelName, uploaderEmail } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    console.log(`📊 Creating Google Sheet: ${title}`);
    console.log(`   Workspace: ${workspaceName}, Channel: ${channelName}`);

    const sheet = await googleDriveHelper.createGoogleSheet(
      title,
      workspaceName || 'Default Workspace',
      channelName || 'Default Channel',
      uploaderEmail
    );

    res.json({
      id: crypto.randomUUID(),
      name: sheet.fileName,
      type: sheet.mimeType,
      url: sheet.webViewLink,
      fileId: sheet.fileId,
      source: 'google_drive',
      docType: 'google_sheet'
    });

  } catch (error) {
    console.error('Create Sheet error:', error);
    res.status(500).json({ 
      error: 'Failed to create Google Sheet',
      details: error.message 
    });
  }
});

// Delete file from Google Drive
router.delete('/file/:fileId', async (req, res) => {
  try {
    const fileId = req.params.fileId;

    console.log(`🗑️  Deleting file from Google Drive: ${fileId}`);

    await googleDriveHelper.deleteFile(fileId);
    res.json({ success: true });

  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ 
      error: 'Delete failed',
      details: error.message 
    });
  }
});

// Get file metadata
router.get('/file/:fileId/metadata', async (req, res) => {
  try {
    const fileId = req.params.fileId;

    const metadata = await googleDriveHelper.getFileMetadata(fileId);
    res.json(metadata);

  } catch (error) {
    console.error('Get metadata error:', error);
    res.status(500).json({ 
      error: 'Failed to get metadata',
      details: error.message 
    });
  }
});

module.exports = router;
