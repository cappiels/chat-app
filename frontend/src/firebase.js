import { logAbsoluteTiming, logTiming } from './utils/timing.js';

const scriptStart = performance.now();
logAbsoluteTiming('🔥', 'firebase.js: Script execution started');

// src/firebase.js
const firebaseImportStart = performance.now();
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
logTiming('📦', 'firebase.js: Firebase imports completed', firebaseImportStart);

const envValidationStart = performance.now();
logAbsoluteTiming('🧪', 'firebase.js: Starting environment validation');

// Validate environment variables first
const requiredEnvVars = [
  'VITE_API_KEY',
  'VITE_AUTH_DOMAIN', 
  'VITE_PROJECT_ID',
  'VITE_STORAGE_BUCKET',
  'VITE_MESSAGING_SENDER_ID',
  'VITE_APP_ID'
];

const missingEnvVars = requiredEnvVars.filter(varName => !import.meta.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing Firebase environment variables:', missingEnvVars);
  throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
}

logTiming('✅', 'firebase.js: Environment validation completed', envValidationStart);

const configStart = performance.now();
// Your web app's Firebase configuration from your .env file
const firebaseConfig = {
  apiKey: import.meta.env.VITE_API_KEY,
  authDomain: import.meta.env.VITE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_APP_ID
};
logTiming('⚙️', 'firebase.js: Config object created', configStart);

console.log('🔥 Initializing Firebase with config:', {
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain,
  hasApiKey: !!firebaseConfig.apiKey
});

// Initialize Firebase app with proper error handling
const appInitStart = performance.now();
let app;
try {
  app = initializeApp(firebaseConfig);
  logTiming('✅', 'firebase.js: Firebase app initialized successfully', appInitStart);
} catch (error) {
  const appInitError = performance.now();
  console.error('❌ Firebase initialization failed:', error);
  logTiming('❌', 'firebase.js: Firebase initialization failed after', appInitStart, appInitError);
  throw error; // Don't fall back to demo config - this masks real issues
}

// Initialize Auth
const authInitStart = performance.now();
export const auth = getAuth(app);
logTiming('🔐', 'firebase.js: Auth object created', authInitStart);

// Configure Google provider with optimal settings for speed
const providerSetupStart = performance.now();
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');

// Optimize for faster authentication
googleProvider.setCustomParameters({
  prompt: 'select_account',
  // Add these for better performance
  hd: undefined, // Remove hosted domain restriction if any
});
logTiming('🌐', 'firebase.js: Google provider configured', providerSetupStart);

// Set up auth state persistence for faster subsequent loads
const persistenceStart = performance.now();
import { setPersistence, browserLocalPersistence } from 'firebase/auth';
setPersistence(auth, browserLocalPersistence).catch(error => {
  console.warn('Failed to set auth persistence:', error);
});
logTiming('💾', 'firebase.js: Auth persistence configured', persistenceStart);

// Development mode logging
if (import.meta.env.DEV) {
  console.log('🔥 Firebase initialized in development mode');
  console.log('Auth domain:', firebaseConfig.authDomain);
  console.log('Project ID:', firebaseConfig.projectId);
}

// Export a promise that resolves when Firebase is fully ready
export const firebaseReady = new Promise((resolve) => {
  // Firebase is ready immediately after initialization
  resolve(true);
});

logTiming('⏱️', 'firebase.js: Total script execution time', scriptStart);
