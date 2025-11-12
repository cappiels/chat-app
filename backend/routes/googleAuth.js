/**
 * Google OAuth Authentication Routes
 * Handles OAuth flow for Google Calendar & Tasks API access
 */

const express = require('express');
const { google } = require('googleapis');
const router = express.Router();

// OAuth2 client configuration
const oauth2Client = new google.auth.OAuth2(
  process.env.GMAIL_OAUTH_CLIENT_ID,
  process.env.GMAIL_OAUTH_CLIENT_SECRET,
  `${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth/google/callback`
);

// Required scopes for Calendar and Tasks access
const SCOPES = [
  'https://www.googleapis.com/auth/calendar', // Google Calendar access
  'https://www.googleapis.com/auth/tasks',    // Google Tasks access
  'https://www.googleapis.com/auth/userinfo.email', // User email for identification
  'https://www.googleapis.com/auth/userinfo.profile' // User profile for display
];

/**
 * GET /api/auth/google/authorize
 * Generate authorization URL for Google OAuth
 */
router.get('/authorize', (req, res) => {
  try {
    const { workspaceId, userId } = req.query;
    
    if (!workspaceId || !userId) {
      return res.status(400).json({
        error: 'Missing required parameters: workspaceId and userId'
      });
    }

    // Generate authorization URL with state parameter for security
    const state = Buffer.from(JSON.stringify({
      workspaceId,
      userId,
      timestamp: Date.now()
    })).toString('base64');

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline', // Request refresh token
      scope: SCOPES,
      state: state,
      prompt: 'consent', // Force consent screen to ensure refresh token
      include_granted_scopes: true
    });

    console.log(`🔑 Generated Google OAuth URL for user ${userId} in workspace ${workspaceId}`);

    res.json({
      authUrl,
      scopes: SCOPES,
      state
    });

  } catch (error) {
    console.error('❌ Error generating OAuth URL:', error);
    res.status(500).json({
      error: 'Failed to generate authorization URL',
      details: error.message
    });
  }
});

/**
 * GET /api/auth/google/callback
 * Handle OAuth callback and exchange code for tokens
 */
router.get('/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;

    // Handle OAuth errors
    if (error) {
      console.error('❌ OAuth error:', error);
      return res.redirect(`${process.env.FRONTEND_URL}/?error=oauth_denied`);
    }

    if (!code || !state) {
      return res.redirect(`${process.env.FRONTEND_URL}/?error=missing_parameters`);
    }

    // Decode and validate state parameter
    let stateData;
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    } catch (e) {
      console.error('❌ Invalid state parameter:', e);
      return res.redirect(`${process.env.FRONTEND_URL}/?error=invalid_state`);
    }

    const { workspaceId, userId, timestamp } = stateData;

    // Check state timestamp (prevent replay attacks)
    if (Date.now() - timestamp > 600000) { // 10 minutes
      console.error('❌ State parameter expired');
      return res.redirect(`${process.env.FRONTEND_URL}/?error=state_expired`);
    }

    // Exchange authorization code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user info to verify identity
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();

    const googleUserData = {
      google_id: userInfo.data.id,
      email: userInfo.data.email,
      name: userInfo.data.name,
      picture: userInfo.data.picture
    };

    console.log(`✅ OAuth successful for ${googleUserData.email}`);

    // Store credentials securely in database
    await storeUserCredentials(userId, workspaceId, tokens, googleUserData);

    // Redirect back to frontend with success
    res.redirect(
      `${process.env.FRONTEND_URL}/workspace/${workspaceId}?google_sync=connected`
    );

  } catch (error) {
    console.error('❌ OAuth callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/?error=oauth_failed`);
  }
});

/**
 * GET /api/auth/google/status/:workspaceId/:userId
 * Check Google OAuth connection status
 */
router.get('/status/:workspaceId/:userId', async (req, res) => {
  try {
    const { workspaceId, userId } = req.params;

    // Check if user has valid Google credentials
    const credentials = await getUserCredentials(userId, workspaceId);

    if (!credentials) {
      return res.json({
        connected: false,
        scopes: []
      });
    }

    // Test if credentials are still valid
    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_OAUTH_CLIENT_ID,
      process.env.GMAIL_OAUTH_CLIENT_SECRET
    );

    oauth2Client.setCredentials({
      refresh_token: credentials.refresh_token,
      access_token: credentials.access_token
    });

    try {
      // Quick test call to verify credentials
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
      await calendar.calendarList.list({ maxResults: 1 });

      res.json({
        connected: true,
        scopes: credentials.scopes || SCOPES,
        email: credentials.google_email,
        name: credentials.google_name,
        picture: credentials.google_picture,
        connected_at: credentials.created_at
      });

    } catch (authError) {
      // Credentials are invalid or expired
      console.warn(`⚠️ Invalid Google credentials for user ${userId}:`, authError.message);
      
      res.json({
        connected: false,
        error: 'credentials_invalid',
        scopes: []
      });
    }

  } catch (error) {
    console.error('❌ Error checking OAuth status:', error);
    res.status(500).json({
      error: 'Failed to check authentication status',
      details: error.message
    });
  }
});

/**
 * DELETE /api/auth/google/revoke/:workspaceId/:userId
 * Revoke Google OAuth access
 */
router.delete('/revoke/:workspaceId/:userId', async (req, res) => {
  try {
    const { workspaceId, userId } = req.params;

    // Get current credentials
    const credentials = await getUserCredentials(userId, workspaceId);

    if (credentials && credentials.access_token) {
      // Revoke tokens with Google
      const oauth2Client = new google.auth.OAuth2(
        process.env.GMAIL_OAUTH_CLIENT_ID,
        process.env.GMAIL_OAUTH_CLIENT_SECRET
      );

      try {
        await oauth2Client.revokeToken(credentials.access_token);
        console.log(`✅ Revoked Google tokens for user ${userId}`);
      } catch (revokeError) {
        console.warn('⚠️ Failed to revoke tokens with Google:', revokeError.message);
        // Continue anyway to delete local credentials
      }
    }

    // Remove credentials from database
    await deleteUserCredentials(userId, workspaceId);

    res.json({
      success: true,
      message: 'Google sync access revoked successfully'
    });

  } catch (error) {
    console.error('❌ Error revoking OAuth access:', error);
    res.status(500).json({
      error: 'Failed to revoke access',
      details: error.message
    });
  }
});

/**
 * POST /api/auth/google/refresh/:workspaceId/:userId
 * Refresh Google access token
 */
router.post('/refresh/:workspaceId/:userId', async (req, res) => {
  try {
    const { workspaceId, userId } = req.params;

    const credentials = await getUserCredentials(userId, workspaceId);
    if (!credentials || !credentials.refresh_token) {
      return res.status(404).json({
        error: 'No refresh token found. Re-authorization required.'
      });
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_OAUTH_CLIENT_ID,
      process.env.GMAIL_OAUTH_CLIENT_SECRET
    );

    oauth2Client.setCredentials({
      refresh_token: credentials.refresh_token
    });

    // Refresh the access token
    const { credentials: newCredentials } = await oauth2Client.refreshAccessToken();

    // Update stored credentials
    await updateUserCredentials(userId, workspaceId, {
      access_token: newCredentials.access_token,
      expiry_date: newCredentials.expiry_date
    });

    console.log(`🔄 Refreshed Google tokens for user ${userId}`);

    res.json({
      success: true,
      expires_at: new Date(newCredentials.expiry_date)
    });

  } catch (error) {
    console.error('❌ Error refreshing tokens:', error);
    res.status(500).json({
      error: 'Failed to refresh access token',
      details: error.message,
      requiresReauth: error.message.includes('invalid_grant')
    });
  }
});

/**
 * Database helper functions
 * These would need to be implemented based on your database schema
 */

async function storeUserCredentials(userId, workspaceId, tokens, googleUserData) {
  // TODO: Implement database storage
  // This should store in user_google_sync_preferences table from migration 023
  
  console.log(`💾 Would store Google credentials for user ${userId}:`, {
    workspace_id: workspaceId,
    google_id: googleUserData.google_id,
    google_email: googleUserData.email,
    google_name: googleUserData.name,
    google_picture: googleUserData.picture,
    access_token: tokens.access_token ? 'present' : 'missing',
    refresh_token: tokens.refresh_token ? 'present' : 'missing',
    expiry_date: tokens.expiry_date,
    scopes: SCOPES
  });

  /*
  Example implementation:
  const query = `
    INSERT INTO user_google_sync_preferences 
    (user_id, workspace_id, google_id, google_email, google_name, google_picture,
     access_token, refresh_token, token_expiry, scopes, is_active)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
    ON CONFLICT (user_id, workspace_id)
    DO UPDATE SET
      google_id = EXCLUDED.google_id,
      google_email = EXCLUDED.google_email,
      google_name = EXCLUDED.google_name,
      google_picture = EXCLUDED.google_picture,
      access_token = EXCLUDED.access_token,
      refresh_token = EXCLUDED.refresh_token,
      token_expiry = EXCLUDED.token_expiry,
      scopes = EXCLUDED.scopes,
      is_active = true,
      updated_at = CURRENT_TIMESTAMP
  `;
  
  await db.query(query, [
    userId, workspaceId, googleUserData.google_id, googleUserData.email,
    googleUserData.name, googleUserData.picture, tokens.access_token,
    tokens.refresh_token, new Date(tokens.expiry_date), JSON.stringify(SCOPES)
  ]);
  */
}

async function getUserCredentials(userId, workspaceId) {
  // TODO: Implement database retrieval
  console.log(`🔍 Would retrieve Google credentials for user ${userId} in workspace ${workspaceId}`);
  
  /*
  Example implementation:
  const query = `
    SELECT * FROM user_google_sync_preferences 
    WHERE user_id = $1 AND workspace_id = $2 AND is_active = true
  `;
  
  const result = await db.query(query, [userId, workspaceId]);
  return result.rows[0] || null;
  */
  
  return null; // Return null until database integration is implemented
}

async function updateUserCredentials(userId, workspaceId, updates) {
  // TODO: Implement database update
  console.log(`🔄 Would update Google credentials for user ${userId}:`, updates);
  
  /*
  Example implementation:
  const query = `
    UPDATE user_google_sync_preferences 
    SET access_token = $3, token_expiry = $4, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = $1 AND workspace_id = $2
  `;
  
  await db.query(query, [userId, workspaceId, updates.access_token, new Date(updates.expiry_date)]);
  */
}

async function deleteUserCredentials(userId, workspaceId) {
  // TODO: Implement database deletion  
  console.log(`🗑️ Would delete Google credentials for user ${userId} in workspace ${workspaceId}`);
  
  /*
  Example implementation:
  const query = `
    UPDATE user_google_sync_preferences 
    SET is_active = false, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = $1 AND workspace_id = $2
  `;
  
  await db.query(query, [userId, workspaceId]);
  */
}

module.exports = router;
