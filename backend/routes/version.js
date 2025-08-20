const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Get version from package.json or git commit
const getAppVersion = () => {
  try {
    // Prioritize package.json version for cache busting
    const packagePath = path.join(__dirname, '../package.json');
    const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    if (packageData.version) {
      return packageData.version;
    }
    
    // Fall back to git commit hash if no package version
    const { execSync } = require('child_process');
    const gitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
    return gitHash;
  } catch (error) {
    // Last resort fallback
    return 'development';
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
