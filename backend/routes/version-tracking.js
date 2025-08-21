const express = require('express');
const router = express.Router();

// In-memory store for version tracking (you could move this to database later)
const versionStats = new Map();
const userVersions = new Map(); // Track individual users

/**
 * POST /api/version-tracking/report
 * Users report their current version
 */
router.post('/report', (req, res) => {
  const { version, userId, userAgent, timestamp } = req.body;
  const clientIP = req.ip || req.connection.remoteAddress;
  
  // Create unique identifier (IP + UserAgent hash for anonymous users)
  const identifier = userId || `${clientIP}-${Buffer.from(userAgent || '').toString('base64').substring(0, 8)}`;
  
  // Update user version tracking
  userVersions.set(identifier, {
    version: version,
    lastSeen: new Date().toISOString(),
    userAgent: userAgent,
    ip: clientIP,
    userId: userId || null
  });
  
  // Update version statistics
  if (versionStats.has(version)) {
    versionStats.set(version, versionStats.get(version) + 1);
  } else {
    versionStats.set(version, 1);
  }
  
  console.log(`📊 Version tracking: User ${identifier} reported version ${version}`);
  
  res.json({ 
    success: true,
    tracked: true,
    version: version
  });
});

/**
 * GET /api/version-tracking/stats
 * Get version distribution statistics
 */
router.get('/stats', (req, res) => {
  // Clean up old entries (remove users not seen in last 24 hours)
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  for (const [identifier, data] of userVersions.entries()) {
    if (new Date(data.lastSeen) < twentyFourHoursAgo) {
      userVersions.delete(identifier);
    }
  }
  
  // Recalculate version stats
  versionStats.clear();
  for (const [identifier, data] of userVersions.entries()) {
    const version = data.version;
    versionStats.set(version, (versionStats.get(version) || 0) + 1);
  }
  
  // Convert to arrays for easier consumption
  const versionDistribution = Array.from(versionStats.entries()).map(([version, count]) => ({
    version,
    count,
    percentage: ((count / userVersions.size) * 100).toFixed(1)
  })).sort((a, b) => b.count - a.count);
  
  const userList = Array.from(userVersions.entries()).map(([identifier, data]) => ({
    identifier: identifier.startsWith('user-') ? identifier : `anonymous-${identifier}`,
    version: data.version,
    lastSeen: data.lastSeen,
    userAgent: data.userAgent ? data.userAgent.substring(0, 50) + '...' : 'unknown'
  })).sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen));
  
  res.json({
    totalUsers: userVersions.size,
    versionDistribution,
    outdatedUsers: versionDistribution.filter(v => v.version < '1.8.3').reduce((sum, v) => sum + v.count, 0),
    recentUsers: userList.slice(0, 20), // Show most recent 20 users
    lastUpdated: new Date().toISOString()
  });
});

/**
 * GET /api/version-tracking/dashboard
 * Simple HTML dashboard to view version stats
 */
router.get('/dashboard', (req, res) => {
  res.set('Content-Type', 'text/html');
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Version Tracking Dashboard</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
    .container { max-width: 1200px; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { border-bottom: 2px solid #007bff; padding-bottom: 20px; margin-bottom: 30px; }
    .stat-card { background: #f8f9fa; padding: 20px; margin: 15px 0; border-radius: 6px; border-left: 4px solid #007bff; }
    .version-item { padding: 12px; margin: 8px 0; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; }
    .version-current { background: #d4edda; border-left: 4px solid #28a745; }
    .version-outdated { background: #f8d7da; border-left: 4px solid #dc3545; }
    .user-list { max-height: 400px; overflow-y: auto; }
    .user-item { padding: 10px; border-bottom: 1px solid #eee; font-size: 0.9em; }
    .refresh-btn { background: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; }
    .refresh-btn:hover { background: #0056b3; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚀 ChatFlow Version Tracking Dashboard</h1>
      <button class="refresh-btn" onclick="window.location.reload()">🔄 Refresh Data</button>
    </div>
    
    <div id="stats-container">Loading...</div>
  </div>

  <script>
    async function loadStats() {
      try {
        const response = await fetch('/api/version-tracking/stats');
        const data = await response.json();
        
        const container = document.getElementById('stats-container');
        container.innerHTML = \`
          <div class="stat-card">
            <h3>📊 Overview</h3>
            <p><strong>Total Active Users:</strong> \${data.totalUsers}</p>
            <p><strong>Users on Outdated Versions:</strong> \${data.outdatedUsers} (\${((data.outdatedUsers/data.totalUsers)*100).toFixed(1)}%)</p>
            <p><strong>Last Updated:</strong> \${new Date(data.lastUpdated).toLocaleString()}</p>
          </div>
          
          <div class="stat-card">
            <h3>📈 Version Distribution</h3>
            \${data.versionDistribution.map(v => \`
              <div class="version-item \${v.version >= '1.8.3' ? 'version-current' : 'version-outdated'}">
                <span><strong>v\${v.version}</strong></span>
                <span>\${v.count} users (\${v.percentage}%)</span>
              </div>
            \`).join('')}
          </div>
          
          <div class="stat-card">
            <h3>👥 Recent User Activity</h3>
            <div class="user-list">
              \${data.recentUsers.map(user => \`
                <div class="user-item">
                  <strong>\${user.identifier}</strong> - v\${user.version} - 
                  <small>\${new Date(user.lastSeen).toLocaleString()}</small><br>
                  <small style="color: #666;">\${user.userAgent}</small>
                </div>
              \`).join('')}
            </div>
          </div>
        \`;
      } catch (error) {
        document.getElementById('stats-container').innerHTML = \`
          <div class="stat-card" style="border-left-color: #dc3545;">
            <h3>❌ Error Loading Stats</h3>
            <p>Could not load version tracking data: \${error.message}</p>
          </div>
        \`;
      }
    }
    
    loadStats();
    
    // Auto-refresh every 30 seconds
    setInterval(loadStats, 30000);
  </script>
</body>
</html>
  `);
});

module.exports = router;
