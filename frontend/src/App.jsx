import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { auth, googleProvider } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import toast, { Toaster } from 'react-hot-toast';
import AppShell from './components/layout/AppShell';
import ChatInterface from './components/ChatInterface';
import InviteAcceptance from './components/InviteAcceptance';
import HomePage from './components/HomePage';
import WorkspaceScreen from './components/WorkspaceScreen';

// Modern Loading Component
const ModernLoading = () => (
  <div className="app-shell">
    <div className="flex-1 flex items-center justify-center bg-gradient-subtle">
      <div className="text-center p-8">
        <div className="relative mb-6">
          <div className="w-16 h-16 mx-auto">
            <div className="loading-spinner w-16 h-16 border-4 border-accent-200 border-t-accent-500 rounded-full"></div>
          </div>
        </div>
        <h2 className="text-xl font-semibold text-text-primary mb-2">Loading crew</h2>
        <p className="text-text-secondary">Preparing your workspace...</p>
      </div>
    </div>
  </div>
);

// Main App component with modern layout
function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedWorkspace, setSelectedWorkspace] = useState(null);
  
  useEffect(() => {
    let isMounted = true;
    let unsubscribe = null;
    let authResolved = false;
    
    const resolveAuth = (user) => {
      if (authResolved || !isMounted) return;
      authResolved = true;
      setUser(user);
      setLoading(false);
      console.log('🔐 Auth resolved:', user ? 'signed in' : 'signed out');
    };

    unsubscribe = onAuthStateChanged(auth, resolveAuth, (error) => {
      console.error('❌ Auth error:', error);
      resolveAuth(null);
    });

    // Fast timeout for immediate UI response
    const timeoutId = setTimeout(() => {
      if (!authResolved && isMounted) {
        console.log('⚡ Auth timeout: proceeding with current state');
        resolveAuth(auth.currentUser);
      }
    }, 1000);

    return () => {
      isMounted = false;
      authResolved = true;
      clearTimeout(timeoutId);
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
    return <ModernLoading />;
  }

  return (
    <Router>
      <Routes>
        {/* Invitation acceptance route */}
        <Route path="/invite/:token" element={<InviteAcceptance />} />
        
        {/* Main application routes */}
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
        
        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Modern Toast System */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          className: 'animate-fade-in-up',
          style: {
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(226, 232, 240, 0.8)',
            borderRadius: '12px',
            padding: '16px',
            fontSize: '14px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          },
          success: {
            iconTheme: {
              primary: '#22c55e',
              secondary: 'white',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: 'white',
            },
          },
        }}
      />
    </Router>
  );
}

export default App;
