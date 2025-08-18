// Utility functions for performance timing logs

/**
 * Format timing for human readability
 * Shows milliseconds for quick operations, adds seconds for longer ones
 */
export function formatTiming(ms) {
  const rounded = Math.round(ms * 100) / 100; // Round to 2 decimal places
  
  if (ms >= 1000) {
    const seconds = (ms / 1000).toFixed(2);
    return `${rounded}ms (${seconds}s)`;
  } else if (ms >= 100) {
    return `${rounded}ms`;
  } else {
    return `${rounded.toFixed(1)}ms`;
  }
}

/**
 * Log timing with consistent format and emoji
 */
export function logTiming(emoji, message, startTime, endTime = performance.now()) {
  const duration = endTime - startTime;
  console.log(`${emoji} ${message}:`, formatTiming(duration));
  return endTime;
}

/**
 * Log absolute timing from page load
 */
export function logAbsoluteTiming(emoji, message, timestamp = performance.now()) {
  console.log(`${emoji} ${message} at:`, formatTiming(timestamp));
  return timestamp;
}
