const AWS = require('aws-sdk');
const crypto = require('crypto');

/**
 * DigitalOcean Spaces Helper for File Uploads
 * S3-compatible object storage for chat attachments
 */
class SpacesHelper {
  constructor() {
    this.s3 = null;
    this.bucket = null;
    this.cdnEndpoint = null;
    this.initializeSpaces();
  }

  /**
   * Initialize DigitalOcean Spaces connection
   */
  initializeSpaces() {
    try {
      // Check if all required environment variables are present
      const required = ['SPACES_ENDPOINT', 'SPACES_BUCKET', 'SPACES_KEY', 'SPACES_SECRET'];
      const missing = required.filter(key => !process.env[key]);
      
      if (missing.length > 0) {
        console.log(`⚠️  DigitalOcean Spaces not configured (missing: ${missing.join(', ')})`);
        console.log('   Files will fall back to Google Drive');
        return;
      }

      // Configure AWS SDK for DigitalOcean Spaces
      this.s3 = new AWS.S3({
        endpoint: new AWS.Endpoint(process.env.SPACES_ENDPOINT),
        accessKeyId: process.env.SPACES_KEY,
        secretAccessKey: process.env.SPACES_SECRET,
        region: process.env.SPACES_REGION || 'nyc3',
        s3ForcePathStyle: false, // Required for Spaces
        signatureVersion: 'v4'
      });

      this.bucket = process.env.SPACES_BUCKET;
      
      // CDN endpoint for faster delivery (if configured)
      this.cdnEndpoint = process.env.SPACES_CDN_ENDPOINT || 
                        `https://${this.bucket}.${process.env.SPACES_ENDPOINT}`;

      console.log('✅ DigitalOcean Spaces initialized successfully');
      console.log(`   Bucket: ${this.bucket}`);
      console.log(`   Endpoint: ${this.cdnEndpoint}`);
      
    } catch (error) {
      console.error('❌ Failed to initialize DigitalOcean Spaces:', error);
      this.s3 = null;
    }
  }

  /**
   * Check if Spaces is configured and available
   */
  isAvailable() {
    return this.s3 !== null;
  }

  /**
   * Upload file to DigitalOcean Spaces
   */
  async uploadFile(fileBuffer, fileName, mimeType, workspaceName = null, channelName = null) {
    try {
      if (!this.isAvailable()) {
        throw new Error('DigitalOcean Spaces not configured');
      }

      // Generate unique filename to prevent conflicts
      const timestamp = Date.now();
      const randomHash = crypto.randomBytes(8).toString('hex');
      const ext = fileName.split('.').pop();
      const baseName = fileName.substring(0, fileName.lastIndexOf('.')) || fileName;
      const uniqueFileName = `${timestamp}-${randomHash}-${baseName}.${ext}`;

      // Organize files by workspace/channel if provided
      let key = 'chat-uploads/';
      if (workspaceName) {
        key += `${this.sanitizePath(workspaceName)}/`;
        if (channelName) {
          key += `${this.sanitizePath(channelName)}/`;
        }
      }
      key += uniqueFileName;

      // Upload parameters
      const params = {
        Bucket: this.bucket,
        Key: key,
        Body: fileBuffer,
        ContentType: mimeType,
        ACL: 'public-read', // Make files publicly accessible
        CacheControl: 'max-age=31536000', // 1 year cache for performance
        Metadata: {
          'original-name': fileName,
          'uploaded-at': new Date().toISOString(),
          ...(workspaceName && { 'workspace': workspaceName }),
          ...(channelName && { 'channel': channelName })
        }
      };

      console.log(`📤 Uploading to Spaces: ${key}`);

      const result = await this.s3.upload(params).promise();

      const fileUrl = `${this.cdnEndpoint}/${key}`;

      console.log(`✅ File uploaded to Spaces: ${fileName} (${fileBuffer.length} bytes)`);
      console.log(`   URL: ${fileUrl}`);

      return {
        fileId: key, // Use Spaces key as ID
        fileName: fileName,
        url: fileUrl,
        size: fileBuffer.length,
        mimeType: mimeType,
        source: 'digitalocean_spaces',
        bucket: this.bucket,
        key: key
      };

    } catch (error) {
      console.error('Error uploading to Spaces:', error);
      throw error;
    }
  }

  /**
   * Delete file from DigitalOcean Spaces
   */
  async deleteFile(key) {
    try {
      if (!this.isAvailable()) {
        throw new Error('DigitalOcean Spaces not configured');
      }

      const params = {
        Bucket: this.bucket,
        Key: key
      };

      await this.s3.deleteObject(params).promise();
      console.log(`✅ File deleted from Spaces: ${key}`);
      
      return true;
    } catch (error) {
      console.error('Error deleting from Spaces:', error);
      throw error;
    }
  }

  /**
   * Get file metadata from Spaces
   */
  async getFileMetadata(key) {
    try {
      if (!this.isAvailable()) {
        throw new Error('DigitalOcean Spaces not configured');
      }

      const params = {
        Bucket: this.bucket,
        Key: key
      };

      const result = await this.s3.headObject(params).promise();

      return {
        size: result.ContentLength,
        mimeType: result.ContentType,
        lastModified: result.LastModified,
        metadata: result.Metadata,
        url: `${this.cdnEndpoint}/${key}`
      };

    } catch (error) {
      console.error('Error getting metadata from Spaces:', error);
      throw error;
    }
  }

  /**
   * Sanitize path component for use in S3 keys
   */
  sanitizePath(str) {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, '-') // Replace non-alphanumeric with dashes
      .replace(/-+/g, '-')            // Collapse multiple dashes
      .replace(/^-|-$/g, '');         // Trim dashes from ends
  }

  /**
   * Generate a signed URL for temporary access (if needed)
   */
  async getSignedUrl(key, expiresIn = 3600) {
    try {
      if (!this.isAvailable()) {
        throw new Error('DigitalOcean Spaces not configured');
      }

      const params = {
        Bucket: this.bucket,
        Key: key,
        Expires: expiresIn
      };

      const url = await this.s3.getSignedUrlPromise('getObject', params);
      return url;

    } catch (error) {
      console.error('Error generating signed URL:', error);
      throw error;
    }
  }
}

module.exports = new SpacesHelper();
