const express = require('express');
const multer = require('multer');
const AWS = require('aws-sdk');
const path = require('path');
const crypto = require('crypto');
const router = express.Router();

// Configure DigitalOcean Spaces (S3-compatible)
const spacesEndpoint = new AWS.Endpoint(process.env.SPACES_ENDPOINT || 'nyc3.digitaloceanspaces.com');
const s3 = new AWS.S3({
  endpoint: spacesEndpoint,
  accessKeyId: process.env.SPACES_KEY,
  secretAccessKey: process.env.SPACES_SECRET,
  region: process.env.SPACES_REGION || 'nyc3'
});

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

// Generate unique filename
const generateFileName = (originalName) => {
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString('hex');
  const ext = path.extname(originalName);
  const name = path.basename(originalName, ext).replace(/[^a-zA-Z0-9]/g, '-');
  return `${timestamp}-${random}-${name}${ext}`;
};

// Upload single file
router.post('/file', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const fileName = generateFileName(req.file.originalname);
    const fileKey = `chat-uploads/${fileName}`;

    // Upload to DigitalOcean Spaces
    const uploadParams = {
      Bucket: process.env.SPACES_BUCKET,
      Key: fileKey,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
      ACL: 'public-read', // Make files publicly accessible
      CacheControl: 'max-age=31536000' // 1 year cache
    };

    const result = await s3.upload(uploadParams).promise();

    // Return file information
    res.json({
      id: crypto.randomUUID(),
      name: req.file.originalname,
      size: req.file.size,
      type: req.file.mimetype,
      url: result.Location,
      key: fileKey
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Upload multiple files
router.post('/files', upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    const uploadPromises = req.files.map(async (file) => {
      const fileName = generateFileName(file.originalname);
      const fileKey = `chat-uploads/${fileName}`;

      const uploadParams = {
        Bucket: process.env.SPACES_BUCKET,
        Key: fileKey,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: 'public-read',
        CacheControl: 'max-age=31536000'
      };

      const result = await s3.upload(uploadParams).promise();

      return {
        id: crypto.randomUUID(),
        name: file.originalname,
        size: file.size,
        type: file.mimetype,
        url: result.Location,
        key: fileKey
      };
    });

    const uploads = await Promise.all(uploadPromises);
    res.json({ files: uploads });

  } catch (error) {
    console.error('Multi-upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Delete file
router.delete('/file/:key', async (req, res) => {
  try {
    const fileKey = decodeURIComponent(req.params.key);

    const deleteParams = {
      Bucket: process.env.SPACES_BUCKET,
      Key: fileKey
    };

    await s3.deleteObject(deleteParams).promise();
    res.json({ success: true });

  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Delete failed' });
  }
});

module.exports = router;
