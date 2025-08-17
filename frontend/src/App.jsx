import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
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
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
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
                  onWorkspaceSwitch={setSelectedWorkspace}
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
                  onWorkspaceSwitch={setSelectedWorkspace}
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
