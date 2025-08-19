// Fast Firebase configuration - optimized for instant loading
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence } from "firebase/auth";

// Validate environment variables
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

// Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_API_KEY,
  authDomain: import.meta.env.VITE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_APP_ID
};

// Initialize Firebase app
const app = initializeApp(firebaseConfig);

// Initialize Auth with optimized settings
export const auth = getAuth(app);

// Configure Google provider for fastest authentication
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');

// Optimize provider for speed
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

// Set up auth persistence for instant loading on refresh
try {
  setPersistence(auth, browserLocalPersistence);
} catch (error) {
  console.warn('Failed to set auth persistence:', error);
}

if (import.meta.env.DEV) {
  console.log('🔥 Firebase initialized');
}

export default app;
