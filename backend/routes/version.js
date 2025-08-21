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
    
    // Force cache invalidation headers
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate, private, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
      'X-Cache-Control': 'no-cache',
      'X-Accel-Expires': '0'
    });
    
    // Check if this is an old version requesting
    const userAgent = req.get('User-Agent') || '';
    
    const response = {
      version,
      timestamp,
      environment: process.env.NODE_ENV || 'development',
      // Only force refresh if there's an actual version mismatch
      forceRefresh: false,
      cacheBreaker: Date.now(),
      refreshUrl: req.get('Referer') ? req.get('Referer').split('?')[0] + '?v=' + Date.now() : undefined
    };
    
    // Don't add cache clearing instructions unless there's a version mismatch
    // This will be handled by the frontend version comparison logic
    
    console.log(`📦 Version check from ${req.ip}: current=${version}, sending refresh=${response.forceRefresh}`);
    
    res.json(response);
  } catch (error) {
    console.error('Version check error:', error);
    res.status(500).json({
      error: 'Unable to get version information'
    });
  }
});

module.exports = router;
