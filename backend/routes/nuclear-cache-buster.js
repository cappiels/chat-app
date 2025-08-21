const express = require('express');
const router = express.Router();

/**
 * Nuclear cache buster - forces immediate cache invalidation
 * This endpoint returns JavaScript that runs immediately to clear caches
 * and reload the page with cache-busting parameters
 */
router.get('/', (req, res) => {
  // Set aggressive no-cache headers
  res.set({
    'Content-Type': 'application/javascript',
    'Cache-Control': 'no-cache, no-store, must-revalidate, private, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0',
    'X-Cache-Control': 'no-cache',
    'X-Accel-Expires': '0'
  });

  // JavaScript code that immediately clears caches and forces refresh
  const nukeCacheScript = `
(function() {
  console.log('💥 NUCLEAR CACHE BUSTER ACTIVATED');
  
  // Clear all localStorage except auth
  try {
    const authData = localStorage.getItem('firebase:authUser');
    const userPrefs = localStorage.getItem('userPreferences');
    localStorage.clear();
    if (authData) localStorage.setItem('firebase:authUser', authData);
    if (userPrefs) localStorage.setItem('userPreferences', userPrefs);
    localStorage.setItem('appVersion', '1.7.8');
    localStorage.setItem('cacheNuked', Date.now());
  } catch(e) {}
  
  // Clear sessionStorage
  try {
    sessionStorage.clear();
  } catch(e) {}
  
  // Clear service workers
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      registrations.forEach(registration => registration.unregister());
    });
  }
  
  // Clear browser caches
  if ('caches' in window) {
    caches.keys().then(names => {
      names.forEach(name => caches.delete(name));
    });
  }
  
  // Show update message
  const banner = document.createElement('div');
  banner.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%); color: white; padding: 16px; text-align: center; font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 14px; font-weight: 500; z-index: 999999;';
  banner.innerHTML = '<div>🚀 <strong>Updating to latest version...</strong> New features loading!</div>';
  document.body.appendChild(banner);
  
  // Force refresh with aggressive cache busting after short delay
  setTimeout(() => {
    const timestamp = Date.now();
    const url = window.location.href.split('?')[0] + '?v=' + timestamp + '&cache_bust=' + timestamp + '&force_refresh=1';
    window.location.replace(url);
  }, 1000);
  
})();
`;

  console.log(`💥 Nuclear cache buster served to ${req.ip}`);
  res.send(nukeCacheScript);
});

module.exports = router;
