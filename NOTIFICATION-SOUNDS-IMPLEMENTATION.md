# Notification Sounds Implementation

This document outlines the comprehensive notification sound system implemented for the chat application. The system provides different audio cues for various messaging events, enhancing user experience and engagement.

## Architecture Overview

The notification sound system consists of three main components:

1. **SoundManager** (`frontend/src/utils/soundManager.js`) - Core audio management
2. **NotificationManager** (`frontend/src/utils/notifications.js`) - Desktop notifications with sound integration  
3. **SoundSettingsDialog** (`frontend/src/components/SoundSettingsDialog.jsx`) - User interface for sound preferences

## Features

### Sound Types

The system supports the following notification sounds:

- **Message Sent** - When user sends a message
- **Message Received** - When receiving a message in current thread
- **Mention Received** - When someone mentions the user (@username, @everyone, @here)
- **Direct Message** - When receiving a personal/direct message
- **Different Thread** - When receiving a message in a different thread
- **Different Workspace** - When receiving a message in a different workspace
- **Typing Indicator** - When someone starts typing (disabled by default)
- **Connection Status** - When socket connection changes (connect/disconnect)

### Audio Technology

- **Web Audio API** - Primary audio engine for better performance and mobile support
- **HTML5 Audio Fallback** - Automatic fallback for unsupported browsers
- **Generated Sounds** - All sounds are procedurally generated (no external audio files required)
- **Mobile Optimized** - Handles mobile audio context restrictions properly

### User Controls

- **Master Volume** - Global volume control (0-100%)
- **Individual Sound Types** - Enable/disable specific sound categories
- **Desktop Notifications** - Toggle browser notifications
- **Notification Types** - Control which types of messages trigger notifications

## Implementation Details

### Sound Generation

Each sound type uses a unique frequency pattern:

```javascript
// Example: Message sent sound
{
  type: 'generated',
  pattern: [
    { frequency: 800, duration: 0.1, volume: 0.3 },
    { frequency: 1000, duration: 0.1, volume: 0.2 }
  ]
}
```

### Mobile Support

The system handles mobile audio restrictions:

1. **User Gesture Requirement** - Audio context is enabled on first user interaction
2. **Resume Audio Context** - Automatically resumes suspended audio contexts
3. **Fallback Audio** - Uses HTML5 Audio API when Web Audio API is unavailable

### Integration Points

#### Message Sending
```javascript
// In MessageComposer.jsx
notificationManager.playMessageSentSound();
```

#### Message Receiving
```javascript
// In AppLayout.jsx
notificationManager.showMessageNotification(
  messageForNotification, 
  notificationType, 
  currentThread?.id, 
  workspace?.id
);
```

#### Connection Status
```javascript
// In AppLayout.jsx
notificationManager.playConnectionSound(connected);
```

## User Interface

### Settings Access

Users can access sound settings through:
1. **User Menu** → "Sound & Notifications"
2. Located in the header dropdown menu

### Settings Categories

1. **Master Controls**
   - Enable/disable all sounds
   - Master volume slider
   - Desktop notifications toggle

2. **Notification Types**
   - Mentions
   - Direct messages
   - All messages

3. **Individual Sound Settings**
   - Toggle each sound type
   - Test individual sounds
   - Hover-to-show test buttons

## Configuration

### Default Settings

```javascript
const defaultSettings = {
  notifications: {
    mentions: true,
    directMessages: true,
    allMessages: false,
    soundEnabled: true,
    desktopNotifications: true
  },
  sounds: {
    enabled: true,
    volume: 0.7,
    sounds: {
      messageSent: true,
      messageReceived: true,
      mentionReceived: true,
      directMessage: true,
      differentThread: true,
      differentWorkspace: true,
      typing: false,
      connectionChange: true
    }
  }
}
```

### Storage

- Settings are stored in `localStorage`
- Automatic save/load on component mount
- Separate storage keys:
  - `notificationSettings` - Desktop notification preferences
  - `soundSettings` - Audio preferences

## Best Practices

### Performance

1. **Singleton Pattern** - Both managers use singleton instances to prevent conflicts
2. **Lazy Loading** - Audio contexts are created only when needed
3. **Memory Management** - Properly cleanup audio nodes and event listeners
4. **Debouncing** - Prevent rapid-fire sound triggering

### UX Design

1. **Subtle Sounds** - Low volume, brief duration to avoid annoyance
2. **Distinct Patterns** - Each sound type has unique frequency patterns
3. **User Control** - Granular control over all sound types
4. **Testing Capability** - Test buttons for each sound type
5. **Reset Option** - "Reset to Defaults" functionality

### Accessibility

1. **Volume Control** - Master volume slider
2. **Complete Disable** - Option to turn off all sounds
3. **Visual Indicators** - Settings UI shows current state clearly
4. **Keyboard Navigation** - All controls are keyboard accessible

## Browser Compatibility

### Supported Features

- **Chrome/Edge** - Full Web Audio API support
- **Firefox** - Full Web Audio API support  
- **Safari** - Full Web Audio API support with mobile restrictions
- **Mobile Browsers** - Fallback to HTML5 Audio when needed

### Mobile Considerations

1. **iOS Safari** - Requires user gesture before playing audio
2. **Android Chrome** - May suspend audio context in background tabs
3. **Touch Devices** - Audio context enabled on first tap/interaction

## Testing

### Manual Testing Checklist

1. **Sound Generation**
   - [ ] All sound types play correctly
   - [ ] Volume control works
   - [ ] Master enable/disable works

2. **Message Events**
   - [ ] Send message plays sent sound
   - [ ] Receive message plays appropriate sound
   - [ ] Mentions play mention sound
   - [ ] Different threads play different sound

3. **Connection Events**
   - [ ] Connect/disconnect sounds play
   - [ ] Network interruption triggers disconnect sound

4. **Settings Persistence**
   - [ ] Settings save to localStorage
   - [ ] Settings load on page refresh
   - [ ] Reset to defaults works

5. **Mobile Testing**
   - [ ] Sounds work on iOS Safari
   - [ ] Sounds work on Android Chrome
   - [ ] Audio context resumes after background

### Testing Script

```javascript
// Test all sounds in browser console
import soundManager from './src/utils/soundManager.js';
soundManager.testAllSounds();

// Test specific sound
soundManager.testSound('messageSent');

// Check settings
console.log(soundManager.getSettings());
```

## Troubleshooting

### Common Issues

1. **No Sound on Mobile**
   - Ensure user has interacted with page first
   - Check if audio context is suspended
   - Verify volume is not zero

2. **Sounds Don't Play**
   - Check master enable setting
   - Verify individual sound type is enabled
   - Check browser audio permissions

3. **Settings Don't Persist**
   - Check localStorage is enabled
   - Verify no browser storage restrictions
   - Check for JavaScript errors

### Debug Commands

```javascript
// Check audio context state
console.log(soundManager.audioContext?.state);

// Check current settings
console.log(notificationManager.getAllSettings());

// Force enable audio context
await soundManager.enableAudioContext();
```

## Future Enhancements

### Planned Features

1. **Custom Sound Upload** - Allow users to upload custom notification sounds
2. **Per-Workspace Settings** - Different sound settings for different workspaces
3. **Per-Thread Settings** - Individual sound preferences for specific threads
4. **Sound Themes** - Predefined sound packages (professional, casual, game-like)
5. **Quiet Hours** - Time-based sound scheduling
6. **Visual Indicators** - Screen flash or other visual cues when sounds are disabled

### Technical Improvements

1. **Web Workers** - Move audio processing to background thread
2. **Audio Compression** - Optimize generated sounds for bandwidth
3. **Advanced Patterns** - More complex sound generation algorithms
4. **Spatial Audio** - 3D positioned audio for different message types

## Security Considerations

1. **No External Files** - All sounds are generated, preventing malicious audio files
2. **Volume Limits** - Maximum volume is capped to prevent hearing damage
3. **User Control** - Users have complete control over all audio features
4. **Privacy** - No audio data is transmitted or stored externally

---

This implementation provides a comprehensive, user-friendly notification sound system that enhances the chat experience while maintaining performance and accessibility standards.
