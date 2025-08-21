// Immediate cache breaker - forces refresh if version mismatch detected
const CURRENT_VERSION = '1.8.5'; // This will be updated by bumpv.sh

class CacheBreaker {
  constructor() {
    this.init();
  }

  init() {
    console.log('🔍 Cache breaker checking version...');
    
    // Get stored version
    const storedVersion = localStorage.getItem('appVersion');
    console.log('💾 Stored version:', storedVersion);
    console.log('📦 Current version:', CURRENT_VERSION);
    
    // If versions don't match, force immediate refresh
    if (storedVersion && storedVersion !== CURRENT_VERSION) {
      console.log('🚨 Version mismatch detected! Forcing cache clear and refresh...');
      this.forceRefresh();
      return;
    }
    
    // Update stored version to current
    localStorage.setItem('appVersion', CURRENT_VERSION);
    console.log('✅ Version check passed');
  }

  forceRefresh() {
    // Clear all possible caches
    try {
      // Clear localStorage except for auth data
      const authData = localStorage.getItem('firebase:authUser');
      const userPrefs = localStorage.getItem('userPreferences');
      localStorage.clear();
      if (authData) localStorage.setItem('firebase:authUser', authData);
      if (userPrefs) localStorage.setItem('userPreferences', userPrefs);
      localStorage.setItem('appVersion', CURRENT_VERSION);
      
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
          Updating ChatFlow...
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
