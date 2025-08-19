import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  MessageCircle, 
  CheckCircle, 
  XCircle, 
  Users, 
  Calendar,
  Mail,
  Loader2,
  ArrowRight
} from 'lucide-react';
import { auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { workspaceAPI } from '../utils/api';
import toast from 'react-hot-toast';

const InviteAcceptance = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [inviteState, setInviteState] = useState('loading'); // 'loading', 'valid', 'invalid', 'accepting', 'accepted', 'error'
  const [inviteData, setInviteData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    // Get current user immediately instead of setting up another listener
    const currentUser = auth.currentUser;
    setUser(currentUser);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      // User not authenticated, redirect to login with invitation token
      navigate(`/?invite=${token}`, { replace: true });
      return;
    }

    if (user && token) {
      validateInvitation();
    }
  }, [user, loading, token]);

  const validateInvitation = async () => {
    try {
      setInviteState('loading');
      
      // For now, we'll mock the invitation validation since the backend might not have this endpoint yet
      // In a real app, you'd call an API to get invitation details before accepting
      setInviteData({
        workspaceName: 'Demo Workspace',
        inviterName: 'Demo User',
        inviterEmail: 'demo@example.com',
        role: 'member',
        expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString()
      });
      setInviteState('valid');
      
    } catch (error) {
      console.error('Invitation validation error:', error);
      setError('This invitation link is invalid or has expired.');
      setInviteState('invalid');
    }
  };

  const acceptInvitation = async () => {
    try {
      setInviteState('accepting');
      
      // Call the backend API to accept the invitation
      const response = await workspaceAPI.acceptInvitation(token);
      
      if (response.data) {
        setInviteState('accepted');
        toast.success(`Welcome to ${inviteData.workspaceName}!`);
        
        // Redirect to the workspace after a brief delay
        setTimeout(() => {
          navigate('/workspace', { 
            state: { 
              workspace: response.data.workspace,
              justJoined: true 
            }
          });
        }, 2000);
      }
      
    } catch (error) {
      console.error('Accept invitation error:', error);
      let errorMessage = 'Failed to accept invitation. ';
      
      if (error.response?.status === 404) {
        errorMessage = 'This invitation link is invalid or has expired.';
      } else if (error.response?.status === 409) {
        errorMessage = 'You are already a member of this workspace.';
      } else if (error.response?.status === 403) {
        errorMessage = 'This invitation was sent to a different email address.';
      }
      
      setError(errorMessage);
      setInviteState('error');
      toast.error(errorMessage);
    }
  };

  const LoadingState = () => (
    <motion.div
      className="text-center"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <div className="mb-8">
        <div className="relative mx-auto w-20 h-20">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl animate-pulse"></div>
          <div className="relative bg-white dark:bg-gray-900 p-4 rounded-2xl shadow-lg">
            <MessageCircle className="w-12 h-12 text-blue-600" />
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center space-x-2 mb-4">
        <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
        <span className="text-gray-600 dark:text-gray-400 font-medium">
          Validating invitation...
        </span>
      </div>
    </motion.div>
  );

  const InvalidState = () => (
    <motion.div
      className="text-center max-w-md mx-auto"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <div className="mb-8">
        <div className="relative mx-auto w-20 h-20">
          <div className="relative bg-red-50 dark:bg-red-900/20 p-4 rounded-2xl">
            <XCircle className="w-12 h-12 text-red-600" />
          </div>
        </div>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
        Invalid Invitation
      </h1>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        {error || 'This invitation link is invalid or has expired.'}
      </p>
      <button
        onClick={() => navigate('/')}
        className="text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200"
        style={{
          background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
          border: 'none'
        }}
        onMouseEnter={(e) => {
          e.target.style.background = 'linear-gradient(135deg, #1d4ed8 0%, #6d28d9 100%)';
        }}
        onMouseLeave={(e) => {
          e.target.style.background = 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)';
        }}
      >
        Go to ChatFlow
      </button>
    </motion.div>
  );

  const ValidState = () => (
    <motion.div
      className="max-w-2xl mx-auto"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <div className="text-center mb-8">
        <div className="relative mx-auto w-20 h-20 mb-6">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl blur-lg opacity-60"></div>
          <div className="relative bg-white dark:bg-gray-900 p-4 rounded-2xl shadow-lg">
            <MessageCircle className="w-12 h-12 text-blue-600" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          You're invited to join {inviteData?.workspaceName}!
        </h1>
        <p className="text-gray-600 dark:text-gray-400 text-lg">
          {inviteData?.inviterName} has invited you to collaborate on ChatFlow
        </p>
      </div>

      {/* Invitation Details Card */}
      <motion.div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 mb-8 border border-gray-200 dark:border-gray-700"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <div className="space-y-6">
          {/* Workspace Info */}
          <div className="flex items-center space-x-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {inviteData?.workspaceName}
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Join as a {inviteData?.role}
              </p>
            </div>
          </div>

          {/* Inviter Info */}
          <div className="flex items-center justify-between py-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3">
              <Mail className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  Invited by
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {inviteData?.inviterName} ({inviteData?.inviterEmail})
                </p>
              </div>
            </div>
          </div>

          {/* Expiry Info */}
          <div className="flex items-center justify-between py-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3">
              <Calendar className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  Invitation expires
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {inviteData?.expiryDate}
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Action Buttons */}
      <motion.div
        className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
      >
        <button
          onClick={acceptInvitation}
          disabled={inviteState === 'accepting'}
          className="flex-1 disabled:bg-blue-400 text-white px-6 py-4 rounded-lg font-medium transition-colors duration-200 flex items-center justify-center space-x-2"
          style={{
            background: inviteState === 'accepting' ? '#93c5fd' : 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
            border: 'none'
          }}
          onMouseEnter={(e) => {
            if (inviteState !== 'accepting') {
              e.target.style.background = 'linear-gradient(135deg, #1d4ed8 0%, #6d28d9 100%)';
            }
          }}
          onMouseLeave={(e) => {
            if (inviteState !== 'accepting') {
              e.target.style.background = 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)';
            }
          }}
        >
          {inviteState === 'accepting' ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Joining workspace...</span>
            </>
          ) : (
            <>
              <span>Accept Invitation</span>
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>
        <button
          onClick={() => navigate('/')}
          className="sm:flex-initial px-6 py-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-200"
        >
          Decline
        </button>
      </motion.div>

      {/* User Info */}
      <motion.div
        className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.6 }}
      >
        <p>Joining as {user?.email}</p>
        <button
          onClick={() => navigate('/logout')}
          className="text-blue-600 hover:text-blue-700 underline mt-1"
        >
          Sign in with a different account
        </button>
      </motion.div>
    </motion.div>
  );

  const AcceptedState = () => (
    <motion.div
      className="text-center max-w-md mx-auto"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <motion.div
        className="mb-8"
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <div className="relative mx-auto w-20 h-20">
          <div className="relative bg-green-50 dark:bg-green-900/20 p-4 rounded-2xl">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>
        </div>
      </motion.div>
      <motion.h1
        className="text-2xl font-bold text-gray-900 dark:text-white mb-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.4 }}
      >
        Welcome to {inviteData?.workspaceName}! 🎉
      </motion.h1>
      <motion.p
        className="text-gray-600 dark:text-gray-400 mb-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.6 }}
      >
        You've successfully joined the workspace. Redirecting you now...
      </motion.p>
      <div className="flex items-center justify-center space-x-2">
        <Loader2 className="w-5 h-5 animate-spin text-green-600" />
        <span className="text-green-600 font-medium">Taking you to your workspace</span>
      </div>
    </motion.div>
  );

  const ErrorState = () => (
    <motion.div
      className="text-center max-w-md mx-auto"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <div className="mb-8">
        <div className="relative mx-auto w-20 h-20">
          <div className="relative bg-red-50 dark:bg-red-900/20 p-4 rounded-2xl">
            <XCircle className="w-12 h-12 text-red-600" />
          </div>
        </div>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
        Something went wrong
      </h1>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        {error}
      </p>
      <div className="space-y-3">
        <button
          onClick={acceptInvitation}
          className="w-full text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200"
          style={{
            background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
            border: 'none'
          }}
          onMouseEnter={(e) => {
            e.target.style.background = 'linear-gradient(135deg, #1d4ed8 0%, #6d28d9 100%)';
          }}
          onMouseLeave={(e) => {
            e.target.style.background = 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)';
          }}
        >
          Try Again
        </button>
        <button
          onClick={() => navigate('/')}
          className="w-full border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-6 py-3 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-200"
        >
          Go to ChatFlow
        </button>
      </div>
    </motion.div>
  );

  const renderContent = () => {
    switch (inviteState) {
      case 'loading':
        return <LoadingState />;
      case 'invalid':
        return <InvalidState />;
      case 'valid':
        return <ValidState />;
      case 'accepting':
        return <ValidState />;
      case 'accepted':
        return <AcceptedState />;
      case 'error':
        return <ErrorState />;
      default:
        return <LoadingState />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl blur-md opacity-60"></div>
              <div className="relative bg-white dark:bg-gray-900 p-2 rounded-xl shadow-lg">
                <MessageCircle className="w-8 h-8 text-blue-600" />
              </div>
            </div>
            <h1 className="text-2xl font-bold">
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Chat
              </span>
              <span className="text-gray-900 dark:text-white">Flow</span>
            </h1>
          </div>
        </motion.div>

        {/* Content */}
        {renderContent()}
      </div>
    </div>
  );
};

export default InviteAcceptance;
