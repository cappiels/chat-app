const admin = require('firebase-admin');
const { Pool } = require('pg');
require('dotenv').config();

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  // In production, use environment variables
  if (process.env.NODE_ENV === 'production') {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  } else {
    // In development, use the service account file
    try {
      const serviceAccount = require('../serviceAccountKey.json');
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } catch (error) {
      console.error('Service account key file not found. Using environment variables.');
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
    }
  }
}

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

/**
 * Firebase Authentication Middleware
 * Verifies Firebase JWT token and auto-creates/updates user in database
 */
const authenticateUser = async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'No valid authorization token provided' 
      });
    }

    const token = authHeader.split('Bearer ')[1];

    // Verify Firebase token
    const decodedToken = await admin.auth().verifyIdToken(token);
    const { uid, email, name, picture, phone_number, firebase } = decodedToken;

    // Auto-create or update user in database
    const user = await upsertUser({
      id: uid,
      email: email || null,
      display_name: name || email?.split('@')[0] || 'Unknown User',
      profile_picture_url: picture || null,
      phone_number: phone_number || null,
      auth_provider: getAuthProvider(firebase),
    });

    // Attach user info to request
    req.user = user;
    req.firebaseUser = decodedToken;

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ 
        error: 'Token Expired', 
        message: 'Authentication token has expired' 
      });
    }
    
    if (error.code === 'auth/argument-error') {
      return res.status(401).json({ 
        error: 'Invalid Token', 
        message: 'Authentication token is invalid' 
      });
    }

    return res.status(401).json({ 
      error: 'Authentication Failed', 
      message: 'Unable to authenticate user' 
    });
  }
};

/**
 * Optional authentication middleware for public endpoints
 * Sets req.user if token is valid, but doesn't block if missing
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    const { uid, email, name, picture, phone_number, firebase } = decodedToken;

    const user = await upsertUser({
      id: uid,
      email: email || null,
      display_name: name || email?.split('@')[0] || 'Unknown User',
      profile_picture_url: picture || null,
      phone_number: phone_number || null,
      auth_provider: getAuthProvider(firebase),
    });

    req.user = user;
    req.firebaseUser = decodedToken;
  } catch (error) {
    // For optional auth, we don't block on errors
    req.user = null;
  }
  
  next();
};

/**
 * Auto-create or update user in database
 */
const upsertUser = async (userData) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // First, add missing columns to users table if they don't exist
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS profile_picture_url TEXT,
      ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20),
      ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(50) DEFAULT 'email',
      ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
    `);

    // Upsert user
    const upsertQuery = `
      INSERT INTO users (id, email, display_name, profile_picture_url, phone_number, auth_provider, last_login, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET
        email = COALESCE(EXCLUDED.email, users.email),
        display_name = COALESCE(EXCLUDED.display_name, users.display_name),
        profile_picture_url = COALESCE(EXCLUDED.profile_picture_url, users.profile_picture_url),
        phone_number = COALESCE(EXCLUDED.phone_number, users.phone_number),
        auth_provider = EXCLUDED.auth_provider,
        last_login = CURRENT_TIMESTAMP
      RETURNING *;
    `;

    const result = await client.query(upsertQuery, [
      userData.id,
      userData.email,
      userData.display_name,
      userData.profile_picture_url,
      userData.phone_number,
      userData.auth_provider
    ]);

    await client.query('COMMIT');
    return result.rows[0];

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error upserting user:', error);
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Extract auth provider from Firebase token
 */
const getAuthProvider = (firebase) => {
  if (firebase.sign_in_provider === 'google.com') return 'google';
  if (firebase.sign_in_provider === 'apple.com') return 'apple';
  if (firebase.sign_in_provider === 'phone') return 'phone';
  if (firebase.sign_in_provider === 'password') return 'email';
  return firebase.sign_in_provider || 'unknown';
};

/**
 * Workspace membership check middleware
 * Ensures user is a member of the specified workspace
 */
const requireWorkspaceMembership = async (req, res, next) => {
  try {
    const { workspaceId } = req.params;
    const userId = req.user.id;

    if (!workspaceId) {
      return res.status(400).json({ 
        error: 'Bad Request', 
        message: 'Workspace ID is required' 
      });
    }

    // Check if user is a member of the workspace
    const membershipQuery = `
      SELECT wm.role, w.name as workspace_name
      FROM workspace_members wm
      JOIN workspaces w ON w.id = wm.workspace_id
      WHERE wm.workspace_id = $1 AND wm.user_id = $2;
    `;

    const result = await pool.query(membershipQuery, [workspaceId, userId]);

    if (result.rows.length === 0) {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: 'You are not a member of this workspace' 
      });
    }

    req.userWorkspaceRole = result.rows[0].role;
    req.workspaceName = result.rows[0].workspace_name;
    next();

  } catch (error) {
    console.error('Workspace membership check error:', error);
    return res.status(500).json({ 
      error: 'Server Error', 
      message: 'Unable to verify workspace membership' 
    });
  }
};

/**
 * Admin-only middleware for workspace operations
 */
const requireWorkspaceAdmin = async (req, res, next) => {
  if (req.userWorkspaceRole !== 'admin') {
    return res.status(403).json({ 
      error: 'Forbidden', 
      message: 'Admin privileges required for this operation' 
    });
  }
  next();
};

module.exports = {
  authenticateUser,
  optionalAuth,
  requireWorkspaceMembership,
  requireWorkspaceAdmin,
  upsertUser
};
