class VersionManager {
  constructor() {
    this.currentVersion = null;
    this.checkInterval = null;
    this.isChecking = false;
    this.callbacks = [];
    this.apiUrl = import.meta.env.VITE_API_URL || 'https://coral-app-rgki8.ondigitalocean.app/api';
    this.forceRefreshOnMismatch = true;
    this.lastNotifiedVersion = null; // Track last version we showed notification for
    this.bannerShown = false; // Track if banner is currently shown
    
    // Check for version immediately and then periodically
    this.init();
  }

  async init() {
    try {
      // Get current stored version
      const storedVersion = localStorage.getItem('appVersion');
      console.log('💾 Stored version:', storedVersion);
      
      // Set a default current version
      this.currentVersion = storedVersion || '1.0.0';
      
      // Report current version to server for tracking
      await this.reportVersionToServer();
      
      // Check for updates from server immediately
      await this.checkForUpdates();
      
      // Start periodic checking at reasonable intervals
      this.startPeriodicCheck();
      
      console.log('🔄 Version manager initialized, current version:', this.currentVersion);
    } catch (error) {
      console.warn('⚠️ Version manager initialization failed:', error);
      // Even if init fails, still start checking
      this.startPeriodicCheck();
    }
  }

  async reportVersionToServer() {
    try {
      await fetch(`${this.apiUrl}/version-tracking/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          version: this.currentVersion,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
          userId: localStorage.getItem('firebase:authUser:uid') || null
        })
      });
      console.log('📊 Version reported to server:', this.currentVersion);
    } catch (error) {
      console.warn('Failed to report version:', error);
    }
  }

  getPackageVersion() {
    try {
      // Import version from the bundled package.json using ES modules
      import('../../package.json').then(packageJson => {
        return packageJson.version;
      }).catch(error => {
        console.warn('Could not get package version:', error);
        return '1.0.0';
      });
      
      // For now, return a placeholder - the actual version will be detected via server
      return '1.0.0';
    } catch (error) {
      console.warn('Could not get package version:', error);
      return '1.0.0';
    }
  }

  async getCurrentVersion() {
    try {
      console.log('🔍 Checking version from:', this.apiUrl + '/version');
      
      const response = await fetch(`${this.apiUrl}/version?t=${Date.now()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-cache'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      console.log('📦 Server version data:', data);
      
      // Store initial version if not set
      if (!this.currentVersion || this.currentVersion === '1.0.0') {
        this.currentVersion = data.version;
        localStorage.setItem('appVersion', data.version);
        console.log('📱 App version stored:', data.version);
      } else if (data.version !== this.currentVersion) {
        // Only handle new version if versions actually differ
        console.log('🚀 NEW VERSION DETECTED!', {
          old: this.currentVersion,
          new: data.version,
          shouldUpdate: true
        });
        
        console.log('🔔 Calling handleNewVersion...');
        this.handleNewVersion(data.version);
      } else {
        console.log('✅ Version up to date:', data.version);
        // Versions match - no action needed, ignore server instructions
      }
      
      return data;
    } catch (error) {
      console.error('❌ Failed to get current version:', error);
      throw error;
    }
  }

  handleNewVersion(newVersion) {
    console.log('🔔 handleNewVersion called with:', newVersion);
    
    // Prevent loop: don't show notification for same version multiple times
    if (this.lastNotifiedVersion === newVersion) {
      console.log('🚫 Already notified for version:', newVersion);
      return;
    }
    
    // Prevent showing notification if banner is already shown
    if (this.bannerShown) {
      console.log('🚫 Banner already shown, skipping notification');
      return;
    }
    
    // Update stored version
    this.currentVersion = newVersion;
    localStorage.setItem('appVersion', newVersion);
    this.lastNotifiedVersion = newVersion;
    
    // Notify all callbacks
    this.callbacks.forEach(callback => {
      try {
        callback(newVersion);
      } catch (error) {
        console.error('Version callback error:', error);
      }
    });
    
    // Show user notification and refresh
    console.log('🖼️ About to show update notification...');
    this.showUpdateNotification(newVersion);
    
    // Add debug info to window for testing
    window.versionDebug = {
      currentVersion: this.currentVersion,
      newVersion: newVersion,
      bannerShown: true,
      timestamp: new Date().toISOString()
    };
  }

  showUpdateNotification(newVersion) {
    // Mark banner as shown to prevent duplicates
    this.bannerShown = true;
    
    // Create a nice notification banner
    const banner = document.createElement('div');
    banner.id = 'version-update-banner';
    banner.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%);
      color: white;
      padding: 16px;
      text-align: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 500;
      z-index: 10000;
      box-shadow: 0 4px 8px rgba(0,0,0,0.1);
      animation: slideDown 0.3s ease-out;
    `;
    
    banner.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; gap: 16px; max-width: 600px; margin: 0 auto;">
        <div>
          🚀 <strong>New features available!</strong> Real-time messaging updates are ready.
        </div>
        <button id="update-now-btn" style="
          background: rgba(255,255,255,0.2);
          border: 1px solid rgba(255,255,255,0.3);
          color: white;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 500;
          font-size: 13px;
          transition: all 0.2s ease;
        " onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">
          Update Now
        </button>
        <button id="dismiss-update-btn" style="
          background: none;
          border: none;
          color: rgba(255,255,255,0.8);
          cursor: pointer;
          font-size: 18px;
          padding: 4px;
          border-radius: 4px;
        " title="Dismiss">
          ×
        </button>
      </div>
    `;
    
    // Add CSS for animation
    if (!document.getElementById('version-update-styles')) {
      const styles = document.createElement('style');
      styles.id = 'version-update-styles';
      styles.textContent = `
        @keyframes slideDown {
          from { transform: translateY(-100%); }
          to { transform: translateY(0); }
        }
        @keyframes slideUp {
          from { transform: translateY(0); }
          to { transform: translateY(-100%); }
        }
      `;
      document.head.appendChild(styles);
    }
    
    // Remove existing banner if any
    const existing = document.getElementById('version-update-banner');
    if (existing) {
      existing.remove();
    }
    
    // Add to page
    document.body.appendChild(banner);
    
    // Add event listeners
    document.getElementById('update-now-btn').onclick = () => {
      this.refreshApp();
    };
    
    document.getElementById('dismiss-update-btn').onclick = () => {
      banner.style.animation = 'slideUp 0.3s ease-out';
      setTimeout(() => {
        banner.remove();
        this.bannerShown = false; // Reset banner state when dismissed
      }, 300);
    };
    
    // Auto-refresh after 30 seconds if user doesn't act
    setTimeout(() => {
      if (document.getElementById('version-update-banner')) {
        console.log('🔄 Auto-refreshing for version update...');
        this.refreshApp();
      }
    }, 30000);
  }

  refreshApp() {
    console.log('🔄 Refreshing app for new version...');
    
    // Clear all caches
    this.clearAllCaches();
    
    // Show loading indicator
    const loadingOverlay = document.createElement('div');
    loadingOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(255, 255, 255, 0.95);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 20000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    loadingOverlay.innerHTML = `
      <div style="text-align: center; padding: 40px;">
        <div style="font-size: 48px; margin-bottom: 16px;">🚀</div>
        <div style="font-size: 18px; font-weight: 600; color: #2563eb; margin-bottom: 8px;">
          Updating to latest version...
        </div>
        <div style="font-size: 14px; color: #64748b;">
          New real-time features loading
        </div>
        <div style="margin-top: 24px;">
          <div style="
            width: 40px;
            height: 40px;
            border: 3px solid #e2e8f0;
            border-top: 3px solid #2563eb;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto;
          "></div>
        </div>
      </div>
    `;
    
    // Add spin animation
    if (!document.getElementById('loading-styles')) {
      const styles = document.createElement('style');
      styles.id = 'loading-styles';
      styles.textContent = `
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(styles);
    }
    
    document.body.appendChild(loadingOverlay);
    
    // Force refresh after short delay
    setTimeout(() => {
      window.location.reload(true);
    }, 1500);
  }

  clearAllCaches() {
    try {
      // Clear localStorage
      const appVersion = localStorage.getItem('appVersion');
      localStorage.clear();
      if (appVersion) {
        localStorage.setItem('appVersion', this.currentVersion);
      }
      
      // Clear sessionStorage
      sessionStorage.clear();
      
      // Clear service worker cache if available
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
          registrations.forEach(registration => {
            registration.unregister();
          });
        });
      }
      
      // Clear browser cache (best effort)
      if ('caches' in window) {
        caches.keys().then(names => {
          names.forEach(name => {
            caches.delete(name);
          });
        });
      }
      
      console.log('🧹 All caches cleared');
    } catch (error) {
      console.warn('Cache clearing error:', error);
    }
  }

  startPeriodicCheck() {
    // Check every 2 minutes for updates - reasonable frequency
    this.checkInterval = setInterval(() => {
      if (!this.isChecking) {
        console.log('⏰ Periodic version check...');
        this.checkForUpdates();
      }
    }, 120000); // Check every 2 minutes (120000ms)
  }

  async checkForUpdates() {
    if (this.isChecking) return;
    
    this.isChecking = true;
    
    try {
      await this.getCurrentVersion();
    } catch (error) {
      console.warn('Version check failed:', error);
    } finally {
      this.isChecking = false;
    }
  }

  stopPeriodicCheck() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  onVersionChange(callback) {
    if (typeof callback === 'function') {
      this.callbacks.push(callback);
    }
  }

  removeVersionListener(callback) {
    this.callbacks = this.callbacks.filter(cb => cb !== callback);
  }

  getCurrentVersionSync() {
    return this.currentVersion || localStorage.getItem('appVersion');
  }

  destroy() {
    this.stopPeriodicCheck();
    this.callbacks = [];
    
    // Remove any existing banners
    const banner = document.getElementById('version-update-banner');
    if (banner) {
      banner.remove();
    }
  }
}

// Create singleton instance
const versionManager = new VersionManager();

export default versionManager;
