const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Get version from package.json or git commit
const getAppVersion = () => {
  try {
    // Try to get git commit hash first
    const { execSync } = require('child_process');
    const gitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
    return gitHash;
  } catch (error) {
    // Fallback to package.json version
    try {
      const packagePath = path.join(__dirname, '../package.json');
      const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      return packageData.version || 'unknown';
    } catch (err) {
      return 'development';
    }
  }
};

/**
 * GET /api/version
 * Get current app version for cache invalidation
 */
router.get('/', (req, res) => {
  try {
    const version = getAppVersion();
    const timestamp = new Date().toISOString();
    
    res.json({
      version,
      timestamp,
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    console.error('Version check error:', error);
    res.status(500).json({
      error: 'Unable to get version information'
    });
  }
});

module.exports = router;
