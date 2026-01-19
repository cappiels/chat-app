import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SubscriptionProvider } from './contexts/SubscriptionContext';
import AppShell from './components/layout/AppShell';
import ChatInterface from './components/ChatInterface';
import InviteAcceptance from './components/InviteAcceptance';
import HomePage from './components/HomePage';
import MainScreen from './components/MainScreen';
import TaskDetailScreen from './components/tasks/TaskDetailScreen';
import chatContextManager from './utils/chatContext';

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

// App Router component using contexts
const AppRouter = () => {
  const { user, loading, signInWithGoogle, handleSignOut } = useAuth();
  const [selectedWorkspace, setSelectedWorkspace] = useState(null);

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
              <MainScreen 
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

        {/* Task detail route */}
        <Route
          path="/task/:taskId"
          element={
            user ? (
              <TaskDetailScreen
                onSelectWorkspace={setSelectedWorkspace}
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
};

// Main App component with context providers
function App() {
  return (
    <AuthProvider>
      <SubscriptionProvider>
        <AppRouter />
      </SubscriptionProvider>
    </AuthProvider>
  );
}

export default App;
