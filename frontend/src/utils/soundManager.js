class SoundManager {
  constructor() {
    this.sounds = {};
    this.audioContext = null;
    this.isInitialized = false;
    this.settings = {
      enabled: true,
      volume: 0.7,
      sounds: {
        messageSent: true,
        messageReceived: true,
        mentionReceived: true,
        directMessage: true,
        differentThread: true,
        differentWorkspace: true,
        typing: false, // Usually kept off by default
        connectionChange: true
      }
    };
    
    this.loadSettings();
    this.initializeSounds();
  }

  loadSettings() {
    try {
      const saved = localStorage.getItem('soundSettings');
      if (saved) {
        this.settings = { ...this.settings, ...JSON.parse(saved) };
      }
    } catch (error) {
      console.warn('Failed to load sound settings:', error);
    }
  }

  saveSettings() {
    try {
      localStorage.setItem('soundSettings', JSON.stringify(this.settings));
    } catch (error) {
      console.warn('Failed to save sound settings:', error);
    }
  }

  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    this.saveSettings();
  }

  async initializeSounds() {
    try {
      // Initialize Web Audio API for better mobile support
      if (window.AudioContext || window.webkitAudioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }

      // Pre-generate different notification sounds
      this.sounds = {
        messageSent: this.createMessageSentSound(),
        messageReceived: this.createMessageReceivedSound(),
        mentionReceived: this.createMentionSound(),
        directMessage: this.createDirectMessageSound(),
        differentThread: this.createDifferentThreadSound(),
        differentWorkspace: this.createDifferentWorkspaceSound(),
        typing: this.createTypingSound(),
        connected: this.createConnectionSound(),
        disconnected: this.createDisconnectionSound(),
        error: this.createErrorSound()
      };

      this.isInitialized = true;
      console.log('🔊 Sound Manager initialized');
    } catch (error) {
      console.warn('Failed to initialize sound manager:', error);
      this.isInitialized = false;
    }
  }

  // Enable audio context on user interaction (required for mobile)
  async enableAudioContext() {
    if (!this.audioContext) return false;

    if (this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
        console.log('🔊 Audio context resumed');
        return true;
      } catch (error) {
        console.warn('Failed to resume audio context:', error);
        return false;
      }
    }
    return true;
  }

  // Create different sound patterns for different events
  createMessageSentSound() {
    return {
      type: 'generated',
      pattern: [
        { frequency: 800, duration: 0.1, volume: 0.3 },
        { frequency: 1000, duration: 0.1, volume: 0.2 }
      ]
    };
  }

  createMessageReceivedSound() {
    return {
      type: 'generated',
      pattern: [
        { frequency: 600, duration: 0.15, volume: 0.4 },
        { frequency: 800, duration: 0.1, volume: 0.3 }
      ]
    };
  }

  createMentionSound() {
    return {
      type: 'generated',
      pattern: [
        { frequency: 900, duration: 0.1, volume: 0.5 },
        { frequency: 700, duration: 0.1, volume: 0.4 },
        { frequency: 900, duration: 0.1, volume: 0.5 }
      ]
    };
  }

  createDirectMessageSound() {
    return {
      type: 'generated',
      pattern: [
        { frequency: 500, duration: 0.2, volume: 0.4 },
        { frequency: 700, duration: 0.15, volume: 0.3 },
        { frequency: 900, duration: 0.1, volume: 0.4 }
      ]
    };
  }

  createDifferentThreadSound() {
    return {
      type: 'generated',
      pattern: [
        { frequency: 400, duration: 0.1, volume: 0.3 },
        { frequency: 600, duration: 0.1, volume: 0.25 }
      ]
    };
  }

  createDifferentWorkspaceSound() {
    return {
      type: 'generated',
      pattern: [
        { frequency: 350, duration: 0.15, volume: 0.3 },
        { frequency: 500, duration: 0.15, volume: 0.25 }
      ]
    };
  }

  createTypingSound() {
    return {
      type: 'generated',
      pattern: [
        { frequency: 1200, duration: 0.05, volume: 0.2 }
      ]
    };
  }

  createConnectionSound() {
    return {
      type: 'generated',
      pattern: [
        { frequency: 600, duration: 0.1, volume: 0.3 },
        { frequency: 800, duration: 0.1, volume: 0.3 },
        { frequency: 1000, duration: 0.1, volume: 0.3 }
      ]
    };
  }

  createDisconnectionSound() {
    return {
      type: 'generated',
      pattern: [
        { frequency: 800, duration: 0.1, volume: 0.3 },
        { frequency: 600, duration: 0.1, volume: 0.3 },
        { frequency: 400, duration: 0.15, volume: 0.3 }
      ]
    };
  }

  createErrorSound() {
    return {
      type: 'generated',
      pattern: [
        { frequency: 300, duration: 0.2, volume: 0.4 },
        { frequency: 250, duration: 0.2, volume: 0.4 }
      ]
    };
  }

  async playSound(soundType, options = {}) {
    if (!this.settings.enabled || !this.isInitialized) return;

    // Check if this specific sound type is enabled
    if (this.settings.sounds[soundType] === false) return;

    try {
      // Enable audio context if needed (mobile requirement)
      await this.enableAudioContext();

      if (!this.audioContext) {
        // Fallback to HTML5 Audio for basic support
        this.playFallbackSound(soundType);
        return;
      }

      const sound = this.sounds[soundType];
      if (!sound || !sound.pattern) return;

      // Play the generated sound pattern
      let currentTime = this.audioContext.currentTime;
      
      for (const note of sound.pattern) {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.setValueAtTime(note.frequency, currentTime);
        
        const volume = (note.volume || 0.3) * this.settings.volume;
        gainNode.gain.setValueAtTime(volume, currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, currentTime + note.duration);
        
        oscillator.start(currentTime);
        oscillator.stop(currentTime + note.duration);
        
        currentTime += note.duration + 0.05; // Small gap between notes
      }

      console.log(`🔊 Played sound: ${soundType}`);
    } catch (error) {
      console.warn(`Failed to play sound ${soundType}:`, error);
      this.playFallbackSound(soundType);
    }
  }

  // Fallback for browsers that don't support Web Audio API
  playFallbackSound(soundType) {
    try {
      // Create a data URL for a simple beep
      const audioData = this.generateSimpleBeepDataURL(soundType);
      const audio = new Audio(audioData);
      audio.volume = this.settings.volume * 0.5;
      audio.play().catch(error => {
        console.warn(`Fallback sound failed for ${soundType}:`, error);
      });
    } catch (error) {
      console.warn(`Fallback sound generation failed for ${soundType}:`, error);
    }
  }

  generateSimpleBeepDataURL(soundType) {
    // Generate a simple beep based on sound type
    const frequencies = {
      messageSent: 800,
      messageReceived: 600,
      mentionReceived: 900,
      directMessage: 700,
      differentThread: 500,
      differentWorkspace: 400,
      typing: 1200,
      connected: 800,
      disconnected: 600,
      error: 300
    };

    const freq = frequencies[soundType] || 600;
    const duration = 0.1;
    const sampleRate = 22050;
    const samples = Math.floor(sampleRate * duration);
    
    const buffer = new ArrayBuffer(44 + samples * 2);
    const view = new DataView(buffer);
    
    // WAV header
    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + samples * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, samples * 2, true);

    // Generate sine wave
    for (let i = 0; i < samples; i++) {
      const sample = Math.sin(2 * Math.PI * freq * i / sampleRate) * 0.3;
      view.setInt16(44 + i * 2, sample * 32767, true);
    }

    const blob = new Blob([buffer], { type: 'audio/wav' });
    return URL.createObjectURL(blob);
  }

  // Sound event methods
  playMessageSent() {
    this.playSound('messageSent');
  }

  playMessageReceived(context = {}) {
    const { isMention, isDirect, isDifferentThread, isDifferentWorkspace } = context;
    
    if (isMention) {
      this.playSound('mentionReceived');
    } else if (isDirect) {
      this.playSound('directMessage');
    } else if (isDifferentWorkspace) {
      this.playSound('differentWorkspace');
    } else if (isDifferentThread) {
      this.playSound('differentThread');
    } else {
      this.playSound('messageReceived');
    }
  }

  playTyping() {
    this.playSound('typing');
  }

  playConnectionChange(connected) {
    this.playSound(connected ? 'connected' : 'disconnected');
  }

  playError() {
    this.playSound('error');
  }

  // Settings management
  getSettings() {
    return { ...this.settings };
  }

  isEnabled() {
    return this.settings.enabled;
  }

  setEnabled(enabled) {
    this.settings.enabled = enabled;
    this.saveSettings();
  }

  setVolume(volume) {
    this.settings.volume = Math.max(0, Math.min(1, volume));
    this.saveSettings();
  }

  setSoundEnabled(soundType, enabled) {
    if (this.settings.sounds.hasOwnProperty(soundType)) {
      this.settings.sounds[soundType] = enabled;
      this.saveSettings();
    }
  }

  // Test sounds
  testSound(soundType) {
    console.log(`🧪 Testing sound: ${soundType}`);
    this.playSound(soundType);
  }

  testAllSounds() {
    console.log('🧪 Testing all sounds...');
    const soundTypes = Object.keys(this.sounds);
    
    soundTypes.forEach((soundType, index) => {
      setTimeout(() => {
        this.testSound(soundType);
      }, index * 500); // Space out test sounds
    });
  }
}

// Export singleton instance
const soundManager = new SoundManager();
export default soundManager;
