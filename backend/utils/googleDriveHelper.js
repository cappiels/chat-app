const { google } = require('googleapis');

/**
 * Google Drive Helper for Chat App
 * Handles file uploads, sharing, and management using Service Account
 */
class GoogleDriveHelper {
  constructor() {
    this.auth = null;
    this.drive = null;
    this.sharedDriveId = null;
    this.initializeAuth();
  }

  /**
   * Initialize Google Drive authentication
   */
  initializeAuth() {
    try {
      // Create service account auth from environment variables
      // Handle private key with newlines and remove surrounding quotes if present
      let privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '';
      
      // Remove surrounding quotes if present
      if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
        privateKey = privateKey.slice(1, -1);
      }
      
      // Replace escaped newlines with actual newlines
      privateKey = privateKey.replace(/\\n/g, '\n');

      const credentials = {
        type: process.env.GOOGLE_SERVICE_ACCOUNT_TYPE,
        project_id: process.env.GOOGLE_SERVICE_ACCOUNT_PROJECT_ID,
        private_key_id: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_ID,
        private_key: privateKey,
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL,
        client_id: process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_ID,
        auth_uri: process.env.GOOGLE_SERVICE_ACCOUNT_AUTH_URI,
        token_uri: process.env.GOOGLE_SERVICE_ACCOUNT_TOKEN_URI,
        auth_provider_x509_cert_url: process.env.GOOGLE_SERVICE_ACCOUNT_AUTH_PROVIDER_X509_CERT_URL,
        client_x509_cert_url: process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_X509_CERT_URL,
        universe_domain: process.env.GOOGLE_SERVICE_ACCOUNT_UNIVERSE_DOMAIN
      };

      // Log to verify credentials are loaded (without exposing sensitive data)
      console.log('Google Drive credentials check:', {
        hasType: !!credentials.type,
        hasProjectId: !!credentials.project_id,
        hasPrivateKey: !!credentials.private_key && credentials.private_key.length > 0,
        privateKeyLength: credentials.private_key?.length,
        hasClientEmail: !!credentials.client_email,
        clientEmail: credentials.client_email
      });

      this.auth = new google.auth.GoogleAuth({
        credentials,
        scopes: [
          'https://www.googleapis.com/auth/drive',
          'https://www.googleapis.com/auth/drive.file'
        ],
      });

      this.drive = google.drive({ version: 'v3', auth: this.auth });

      console.log('✅ Google Drive authentication initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Google Drive authentication:', error);
      throw error;
    }
  }

  /**
   * Find or create a Shared Drive by name
   */
  async findOrCreateSharedDrive(driveName = 'Crew Chat') {
    try {
      // Check if we already have the drive ID cached
      if (this.sharedDriveId) {
        return this.sharedDriveId;
      }

      // Search for existing shared drive
      const response = await this.drive.drives.list({
        q: `name='${driveName}'`,
        fields: 'drives(id, name)',
      });

      if (response.data.drives && response.data.drives.length > 0) {
        this.sharedDriveId = response.data.drives[0].id;
        console.log(`✅ Found existing Shared Drive: ${driveName} (${this.sharedDriveId})`);
        return this.sharedDriveId;
      }

      // Note: Creating a Shared Drive requires admin permissions
      // For now, return null and log that manual setup is needed
      console.log(`⚠️  Shared Drive '${driveName}' not found - files will be stored in My Drive`);
      return null;

    } catch (error) {
      console.error('Error finding Shared Drive:', error);
      throw error;
    }
  }

  /**
   * Find or create a folder in Google Drive (supports Shared Drives)
   */
  async findOrCreateFolder(folderName, parentId = null, sharedDriveId = null) {
    try {
      // Build search query
      let query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
      if (parentId) {
        query += ` and '${parentId}' in parents`;
      }

      // Search parameters with Shared Drive support
      let searchParams = {
        q: query,
        fields: 'files(id, name)',
      };

      if (sharedDriveId) {
        searchParams.supportsAllDrives = true;
        searchParams.includeItemsFromAllDrives = true;
        searchParams.corpora = 'drive';
        searchParams.driveId = sharedDriveId;
      }

      // Search for existing folder
      const searchResponse = await this.drive.files.list(searchParams);

      if (searchResponse.data.files && searchResponse.data.files.length > 0) {
        const folder = searchResponse.data.files[0];
        console.log(`✅ Found existing folder: ${folderName} (${folder.id})`);
        return folder;
      }

      // Folder doesn't exist, create it
      const folderMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
      };

      // Set parent folder: parentId takes priority, then sharedDriveId
      if (parentId) {
        folderMetadata.parents = [parentId];
      } else if (sharedDriveId) {
        folderMetadata.parents = [sharedDriveId];
      }

      let createParams = {
        resource: folderMetadata,
        fields: 'id, name',
      };

      if (sharedDriveId) {
        createParams.supportsAllDrives = true;
      }

      const createResponse = await this.drive.files.create(createParams);

      console.log(`✅ Created new folder: ${folderName} (${createResponse.data.id})`);

      return createResponse.data;
    } catch (error) {
      console.error('Error finding/creating folder:', error);
      throw error;
    }
  }

  /**
   * Upload file to Google Drive with proper permissions
   */
  async uploadFile(fileBuffer, fileName, workspaceName, channelName, uploaderEmail) {
    try {
      // Get or create shared drive (may be null if not found)
      const sharedDriveId = await this.findOrCreateSharedDrive();

      // Create folder structure: Workspace/Channel
      const workspaceFolder = await this.findOrCreateFolder(
        workspaceName, 
        sharedDriveId, 
        sharedDriveId
      );

      const channelFolder = await this.findOrCreateFolder(
        channelName,
        workspaceFolder.id,
        sharedDriveId
      );

      // Upload file
      const fileMetadata = {
        name: fileName,
        parents: [channelFolder.id],
      };

      let uploadParams = {
        resource: fileMetadata,
        media: {
          mimeType: 'application/octet-stream',
          body: require('stream').Readable.from(fileBuffer),
        },
        fields: 'id, name, webViewLink, webContentLink, size, mimeType',
      };

      if (sharedDriveId) {
        uploadParams.supportsAllDrives = true;
      }

      const uploadResponse = await this.drive.files.create(uploadParams);
      const fileId = uploadResponse.data.id;

      console.log(`✅ File uploaded successfully: ${fileName} (${fileId}, ${uploadResponse.data.size} bytes)`);

      // Grant writer permission to uploader
      if (uploaderEmail) {
        await this.shareFile(fileId, 'writer', 'user', uploaderEmail);
      }

      // Grant reader permission to anyone with link
      await this.shareFile(fileId, 'reader', 'anyone', null);

      // Generate direct URL for inline display (especially for images)
      const directUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;

      return {
        fileId,
        fileName: uploadResponse.data.name,
        webViewLink: uploadResponse.data.webViewLink,
        webContentLink: uploadResponse.data.webContentLink,
        directUrl: directUrl,  // Direct URL for inline display
        size: uploadResponse.data.size,
        mimeType: uploadResponse.data.mimeType
      };

    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  }

  /**
   * Share a file with specific permissions
   */
  async shareFile(fileId, role = 'reader', type = 'anyone', emailAddress = null) {
    try {
      // Check if file is in a Shared Drive
      let isInSharedDrive = false;
      try {
        const fileInfo = await this.drive.files.get({
          fileId,
          fields: 'parents,driveId',
          supportsAllDrives: true
        });
        isInSharedDrive = !!fileInfo.data.driveId;
      } catch (checkError) {
        console.log('Could not determine if file is in shared drive, assuming regular drive');
      }

      // For Shared Drive files, skip 'anyone' permissions - they inherit from the drive
      if (isInSharedDrive && type === 'anyone') {
        console.log(`⚠️  Skipping anyone permission for Shared Drive file (inherits from drive): ${fileId}`);
        return;
      }

      // For user permissions, email is required
      if (type === 'user' && !emailAddress) {
        console.log(`⚠️  Skipping user permission - no email provided for file: ${fileId}`);
        return;
      }

      const permissionResource = {
        role,
        type,
      };

      if (type === 'anyone') {
        permissionResource.allowFileDiscovery = false;
      }

      if (type === 'user') {
        permissionResource.emailAddress = emailAddress;
      }

      await this.drive.permissions.create({
        fileId,
        resource: permissionResource,
        supportsAllDrives: true,
      });

      console.log(`✅ File shared: ${fileId} (${role} - ${type}${emailAddress ? ': ' + emailAddress : ''})`);

    } catch (error) {
      console.error('Error sharing file:', error);
      throw error;
    }
  }

  /**
   * Create a new Google Doc
   */
  async createGoogleDoc(title, workspaceName, channelName, uploaderEmail) {
    try {
      // Get or create shared drive (may be null if not found)
      const sharedDriveId = await this.findOrCreateSharedDrive();
      
      // Create folder structure
      const workspaceFolder = await this.findOrCreateFolder(workspaceName, sharedDriveId, sharedDriveId);
      const channelFolder = await this.findOrCreateFolder(channelName, workspaceFolder.id, sharedDriveId);

      const fileMetadata = {
        name: title,
        mimeType: 'application/vnd.google-apps.document',
        parents: [channelFolder.id]
      };

      const response = await this.drive.files.create({
        resource: fileMetadata,
        fields: 'id, name, webViewLink',
        supportsAllDrives: true
      });

      console.log(`✅ Google Doc created: ${title} (${response.data.id})`);

      // Grant permissions
      if (uploaderEmail) {
        await this.shareFile(response.data.id, 'writer', 'user', uploaderEmail);
      }
      
      await this.shareFile(response.data.id, 'reader', 'anyone', null);

      return {
        fileId: response.data.id,
        fileName: response.data.name,
        webViewLink: response.data.webViewLink,
        mimeType: 'application/vnd.google-apps.document'
      };
    } catch (error) {
      console.error('Error creating Google Doc:', error);
      throw error;
    }
  }

  /**
   * Create a new Google Sheet
   */
  async createGoogleSheet(title, workspaceName, channelName, uploaderEmail) {
    try {
      // Get or create shared drive (may be null if not found)
      const sharedDriveId = await this.findOrCreateSharedDrive();
      
      // Create folder structure
      const workspaceFolder = await this.findOrCreateFolder(workspaceName, sharedDriveId, sharedDriveId);
      const channelFolder = await this.findOrCreateFolder(channelName, workspaceFolder.id, sharedDriveId);

      const fileMetadata = {
        name: title,
        mimeType: 'application/vnd.google-apps.spreadsheet',
        parents: [channelFolder.id]
      };

      const response = await this.drive.files.create({
        resource: fileMetadata,
        fields: 'id, name, webViewLink',
        supportsAllDrives: true
      });

      console.log(`✅ Google Sheet created: ${title} (${response.data.id})`);

      // Grant permissions
      if (uploaderEmail) {
        await this.shareFile(response.data.id, 'writer', 'user', uploaderEmail);
      }
      
      await this.shareFile(response.data.id, 'reader', 'anyone', null);

      return {
        fileId: response.data.id,
        fileName: response.data.name,
        webViewLink: response.data.webViewLink,
        mimeType: 'application/vnd.google-apps.spreadsheet'
      };
    } catch (error) {
      console.error('Error creating Google Sheet:', error);
      throw error;
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(fileId) {
    try {
      const response = await this.drive.files.get({
        fileId,
        fields: 'id, name, size, mimeType, webViewLink, webContentLink, createdTime, modifiedTime',
        supportsAllDrives: true,
      });

      return response.data;
    } catch (error) {
      console.error('Error getting file metadata:', error);
      throw error;
    }
  }

  /**
   * Delete file from Google Drive
   */
  async deleteFile(fileId) {
    try {
      await this.drive.files.delete({
        fileId,
        supportsAllDrives: true
      });

      console.log(`✅ File deleted successfully: ${fileId}`);
      return true;
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  }

  /**
   * Extract file ID from Google Drive URL
   */
  static extractFileIdFromUrl(url) {
    // Handle different URL formats
    // https://docs.google.com/document/d/FILE_ID/edit
    // https://drive.google.com/file/d/FILE_ID/view
    const patterns = [
      /\/d\/([a-zA-Z0-9-_]+)/,
      /id=([a-zA-Z0-9-_]+)/,
      /\/folders\/([a-zA-Z0-9-_]+)/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Classify attachment type from URL or MIME type
   */
  static classifyAttachment(url, mimeType = null) {
    if (url.includes('docs.google.com/document')) return 'google_doc';
    if (url.includes('docs.google.com/spreadsheets')) return 'google_sheet';
    if (url.includes('docs.google.com/presentation')) return 'google_slides';
    if (url.includes('drive.google.com')) return 'google_drive_file';
    
    if (mimeType) {
      if (mimeType === 'application/vnd.google-apps.document') return 'google_doc';
      if (mimeType === 'application/vnd.google-apps.spreadsheet') return 'google_sheet';
      if (mimeType === 'application/vnd.google-apps.presentation') return 'google_slides';
    }
    
    return 'url';
  }
}

module.exports = new GoogleDriveHelper();
