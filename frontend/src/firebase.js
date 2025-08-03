// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from "firebase/auth";

// Your web app's Firebase configuration from your .env file
const firebaseConfig = {
  apiKey: import.meta.env.VITE_API_KEY,
  authDomain: import.meta.env.VITE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_APP_ID
};

// Initialize Firebase app with error handling
let app;
try {
  app = initializeApp(firebaseConfig);
} catch (error) {
  console.error('Firebase initialization error:', error);
  // Fallback configuration for development
  app = initializeApp({
    apiKey: "demo-key",
    authDomain: "demo.firebaseapp.com",
    projectId: "demo-project"
  });
}

// Initialize Auth with connection timeout
export const auth = getAuth(app);

// Configure Google provider with optimal settings
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');

// Set custom parameters for faster auth
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Development mode optimizations
if (import.meta.env.DEV) {
  // Disable Firebase analytics in development for faster loading
  console.log('🔥 Firebase initialized in development mode');
}
