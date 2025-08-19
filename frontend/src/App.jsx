import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { auth, googleProvider } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import toast, { Toaster } from 'react-hot-toast';
import ChatInterface from './components/ChatInterface';
import InviteAcceptance from './components/InviteAcceptance';
import HomePage from './components/HomePage';
import WorkspaceScreen from './components/WorkspaceScreen';
import { workspaceAPI } from './utils/api';

// Main App component with Router
function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedWorkspace, setSelectedWorkspace] = useState(null);
  
  useEffect(() => {
    let isMounted = true;
    let unsubscribe = null;
    
    // Fast auth initialization - prioritize speed over extensive logging
    const initializeAuth = () => {
      try {
        // 1. Check if user is already available (fastest path)
        const currentUser = auth.currentUser;
        if (currentUser && isMounted) {
          console.log('🔐 Fast path: Found existing user session');
          setUser(currentUser);
          setLoading(false);
          return;
        }
        
        // 2. Check localStorage for cached auth state
        try {
          const cachedAuth = localStorage.getItem('firebase:authUser:' + auth.app.options.apiKey + ':[DEFAULT]');
          if (cachedAuth && cachedAuth !== 'null') {
            console.log('🔐 Found cached auth state, initializing...');
            // Don't wait for Firebase validation, show UI immediately
            setLoading(false);
          }
        } catch (e) {
          console.warn('Could not check cached auth:', e);
        }
        
        // 3. Set up auth listener with minimal delay
        unsubscribe = onAuthStateChanged(auth, 
          (user) => {
            if (!isMounted) return;
            console.log('🔐 Auth state resolved:', user ? 'signed in' : 'signed out');
            setUser(user);
            setLoading(false);
          },
          (error) => {
            console.error('❌ Auth error:', error);
            if (!isMounted) return;
            setLoading(false);
            toast.error('Authentication error. Please refresh the page.');
          }
        );
        
        // 4. Fallback timeout - much shorter now
        setTimeout(() => {
          if (isMounted && loading) {
            console.warn('⚠️ Auth taking too long, proceeding without user');
            setLoading(false);
          }
        }, 3000); // Only 3 seconds max wait
        
      } catch (error) {
        console.error('❌ Auth initialization failed:', error);
        if (isMounted) {
          setLoading(false);
          toast.error('Failed to initialize authentication.');
        }
      }
    };

    // Start immediately - no delays
    initializeAuth();

    return () => {
      isMounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const signInWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      setUser(result.user);
      toast.success(`Welcome, ${result.user.displayName}! 🎉`);
    } catch (error) {
      console.error("Error signing in with Google", error);
      toast.error("Failed to sign in. Please try again.");
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setSelectedWorkspace(null);
      toast.success("Signed out successfully");
    } catch (error) {
      console.error("Error signing out", error);
      toast.error("Failed to sign out");
    }
  };

  const handleWorkspaceSwitch = (workspace) => {
    setSelectedWorkspace(workspace);
  };

  const handleBackToWorkspaces = () => {
    setSelectedWorkspace(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="text-center"
        >
          <div className="loading-dots mb-4">
            <div className="loading-dot bg-blue-500"></div>
            <div className="loading-dot bg-blue-600"></div>
            <div className="loading-dot bg-blue-700"></div>
          </div>
          <p className="text-gray-600 dark:text-gray-400 font-medium">Loading ChatFlow...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen">
        <Routes>
          {/* Invitation acceptance route - works without authentication initially */}
          <Route path="/invite/:token" element={<InviteAcceptance />} />
          
          {/* Main home page */}
          <Route 
            path="/" 
            element={
              !user ? (
                <HomePage onSignIn={signInWithGoogle} />
              ) : selectedWorkspace ? (
                <ChatInterface 
                  user={user} 
                  workspace={selectedWorkspace} 
                  onSignOut={handleSignOut}
                  onWorkspaceSwitch={handleWorkspaceSwitch}
                  onBackToWorkspaces={handleBackToWorkspaces}
                />
              ) : (
                <WorkspaceScreen 
                  user={user} 
                  onSignOut={handleSignOut} 
                  onSelectWorkspace={setSelectedWorkspace}
                />
              )
            } 
          />

          {/* Workspace route */}
          <Route 
            path="/workspace/:workspaceId" 
            element={
              user ? (
                <ChatInterface 
                  user={user} 
                  workspace={selectedWorkspace} 
                  onSignOut={handleSignOut}
                  onWorkspaceSwitch={handleWorkspaceSwitch}
                  onBackToWorkspaces={handleBackToWorkspaces}
                />
              ) : (
                <Navigate to="/" replace />
              )
            } 
          />

          {/* Logout route */}
          <Route path="/logout" element={<Navigate to="/" replace />} />
          
          {/* Catch all - redirect to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        {/* Toast notifications */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            className: 'glass',
            style: {
              background: 'rgba(255, 255, 255, 0.9)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
            }
          }}
        />
      </div>
    </Router>
  );
}

export default App;
