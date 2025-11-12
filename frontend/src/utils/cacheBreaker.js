// Immediate cache breaker - forces refresh if version mismatch detected
// Version will be dynamically fetched from package.json to avoid hardcoding issues

class CacheBreaker {
  constructor() {
    this.currentVersion = null;
    this.init();
  }

  async getCurrentVersion() {
    try {
      // Try to get version from package.json via import
      const packageJson = await import('../../package.json');
      return packageJson.version || '1.0.0';
    } catch (error) {
      console.warn('Could not get package version:', error);
      return '1.0.0';
    }
  }

  async init() {
    // Disable cache breaker in development
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      console.log('🛠️ Cache breaker disabled in development');
      return;
    }
    
    console.log('🔍 Cache breaker checking version...');
    
    // Get current version dynamically
    this.currentVersion = await this.getCurrentVersion();
    
    // Get stored version
    const storedVersion = localStorage.getItem('appVersion');
    const lastCacheClear = localStorage.getItem('lastCacheClear');
    const now = Date.now();
    
    console.log('💾 Stored version:', storedVersion);
    console.log('📦 Current version:', this.currentVersion);
    console.log('🧹 Last cache clear:', lastCacheClear ? new Date(parseInt(lastCacheClear)) : 'never');
    
    // Don't force refresh if cache was cleared recently (within 1 hour)
    if (lastCacheClear) {
      const timeSinceClear = now - parseInt(lastCacheClear);
      const oneHour = 60 * 60 * 1000;
      if (timeSinceClear < oneHour) {
        console.log('⏰ Cache cleared recently, skipping version check');
        localStorage.setItem('appVersion', this.currentVersion);
        return;
      }
    }
    
    // Only force refresh for significant version changes (major/minor, not patch)
    if (storedVersion && storedVersion !== this.currentVersion) {
      const [storedMajor, storedMinor] = storedVersion.split('.');
      const [currentMajor, currentMinor] = this.currentVersion.split('.');
      
      // Only refresh for major or minor version changes
      if (storedMajor !== currentMajor || storedMinor !== currentMinor) {
        console.log('🚨 Major/minor version change detected! Forcing cache clear and refresh...');
        console.log(`📊 Version change: ${storedVersion} → ${this.currentVersion}`);
        this.forceRefresh();
        return;
      } else {
        console.log('📦 Patch version change detected, updating silently...');
        console.log(`📊 Patch update: ${storedVersion} → ${this.currentVersion}`);
      }
    }
    
    // Update stored version to current
    localStorage.setItem('appVersion', this.currentVersion);
    console.log('✅ Version check passed');
  }

  forceRefresh() {
    // Mark when we're clearing cache to prevent loops
    localStorage.setItem('lastCacheClear', Date.now().toString());
    
    // Clear all possible caches
    try {
      // Clear localStorage except for auth data and cache clear timestamp
      const authData = localStorage.getItem('firebase:authUser');
      const userPrefs = localStorage.getItem('userPreferences');
      const cacheClearTime = localStorage.getItem('lastCacheClear');
      
      localStorage.clear();
      
      if (authData) localStorage.setItem('firebase:authUser', authData);
      if (userPrefs) localStorage.setItem('userPreferences', userPrefs);
      if (cacheClearTime) localStorage.setItem('lastCacheClear', cacheClearTime);
      localStorage.setItem('appVersion', this.currentVersion);
      
      // Clear sessionStorage
      sessionStorage.clear();
      
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
    } catch (error) {
      console.warn('Cache clearing error:', error);
    }
    
    // Show loading screen and force refresh
    this.showLoadingAndRefresh();
  }

  showLoadingAndRefresh() {
    // Create loading overlay
    const overlay = document.createElement('div');
    overlay.id = 'cache-refresh-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    overlay.innerHTML = `
      <div style="text-align: center; color: white; padding: 40px;">
        <div style="font-size: 64px; margin-bottom: 24px; animation: bounce 1s infinite;">🚀</div>
        <div style="font-size: 24px; font-weight: 600; margin-bottom: 16px;">
          Updating crew...
        </div>
        <div style="font-size: 16px; opacity: 0.9; margin-bottom: 32px;">
          Loading new features and improvements
        </div>
        <div style="
          width: 50px;
          height: 50px;
          border: 4px solid rgba(255,255,255,0.3);
          border-top: 4px solid white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto;
        "></div>
      </div>
    `;
    
    // Add animations
    const styles = document.createElement('style');
    styles.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      @keyframes bounce {
        0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
        40% { transform: translateY(-20px); }
        60% { transform: translateY(-10px); }
      }
    `;
    document.head.appendChild(styles);
    
    document.body.appendChild(overlay);
    
    // Force refresh after 2 seconds
    setTimeout(() => {
      window.location.href = window.location.href.split('?')[0] + '?v=' + Date.now();
    }, 2000);
  }
}

// Run immediately when module loads
new CacheBreaker();

export default CacheBreaker;
