import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Mail, 
  UserPlus, 
  Copy, 
  Check, 
  Shield, 
  Users,
  Crown,
  ExternalLink,
  Send
} from 'lucide-react';
import toast from 'react-hot-toast';
import { workspaceAPI } from '../utils/api';

const InviteDialog = ({ workspace, isOpen, onClose, onInviteSuccess }) => {
  const [inviteMethod, setInviteMethod] = useState('email'); // 'email' or 'link'
  const [emails, setEmails] = useState(['']);
  const [role, setRole] = useState('member');
  const [isLoading, setIsLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [pendingInvites, setPendingInvites] = useState([]);

  // Add email input
  const addEmailInput = () => {
    setEmails([...emails, '']);
  };

  // Remove email input
  const removeEmailInput = (index) => {
    if (emails.length > 1) {
      setEmails(emails.filter((_, i) => i !== index));
    }
  };

  // Update email at index
  const updateEmail = (index, value) => {
    const newEmails = [...emails];
    newEmails[index] = value;
    setEmails(newEmails);
  };

  // Validate email
  const isValidEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  // Send invitations
  const handleSendInvites = async () => {
    const validEmails = emails.filter(email => email.trim() && isValidEmail(email.trim()));
    
    if (validEmails.length === 0) {
      toast.error('Please enter at least one valid email address');
      return;
    }

    setIsLoading(true);
    const newInvites = [];

    try {
      for (const email of validEmails) {
        const response = await workspaceAPI.inviteUser(workspace.id, {
          email: email.trim(),
          role
        });
        newInvites.push({
          email: email.trim(),
          role,
          status: 'sent',
          timestamp: new Date()
        });
      }

      setPendingInvites([...pendingInvites, ...newInvites]);
      setEmails(['']); // Reset form
      toast.success(`${validEmails.length} invitation${validEmails.length > 1 ? 's' : ''} sent successfully!`);
      
      if (onInviteSuccess) {
        onInviteSuccess(newInvites);
      }
    } catch (error) {
      console.error('Invite error:', error);
      toast.error('Failed to send invitations');
    } finally {
      setIsLoading(false);
    }
  };

  // Generate invite link
  const generateInviteLink = async () => {
    setIsLoading(true);
    try {
      // For now, generate a mock link - in real app this would come from backend
      const mockToken = Math.random().toString(36).substring(2, 15);
      const link = `${window.location.origin}/invite/${mockToken}`;
      setInviteLink(link);
      toast.success('Invite link generated!');
    } catch (error) {
      toast.error('Failed to generate invite link');
    } finally {
      setIsLoading(false);
    }
  };

  // Copy invite link
  const copyInviteLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setLinkCopied(true);
      toast.success('Invite link copied to clipboard!');
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy link');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="bg-white rounded-[20px] border border-blue-200 shadow-[0_25px_50px_-12px_rgba(37,99,235,0.2)] max-w-2xl w-full max-h-[90vh] overflow-hidden ring-1 ring-blue-100"
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: "spring", duration: 0.5 }}
          onClick={(e) => e.stopPropagation()}
          style={{ backgroundColor: 'white' }}
        >
          {/* Header */}
          <div className="border-b border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-primary-50 dark:bg-primary-900/20 rounded-xl">
                  <UserPlus className="w-6 h-6 text-primary-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Invite to {workspace?.name}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Add new members to collaborate in your workspace
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          </div>

          <div className="p-8 overflow-y-auto max-h-[calc(90vh-140px)]">
            {/* Invite Method Toggle */}
            <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1 mb-6">
              <button
                onClick={() => setInviteMethod('email')}
                className={`flex-1 flex items-center justify-center space-x-2 py-2.5 px-4 rounded-lg font-medium transition-all ${
                  inviteMethod === 'email'
                    ? 'bg-white dark:bg-gray-700 text-primary-600 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <Mail className="w-4 h-4" />
                <span>Email Invite</span>
              </button>
              <button
                onClick={() => setInviteMethod('link')}
                className={`flex-1 flex items-center justify-center space-x-2 py-2.5 px-4 rounded-lg font-medium transition-all ${
                  inviteMethod === 'link'
                    ? 'bg-white dark:bg-gray-700 text-primary-600 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <ExternalLink className="w-4 h-4" />
                <span>Invite Link</span>
              </button>
            </div>

            {inviteMethod === 'email' ? (
              <div className="space-y-6">
                {/* Role Selection */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-3">
                    Role
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setRole('member')}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        role === 'member'
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-center space-x-3 mb-2">
                        <Users className="w-5 h-5 text-blue-500" />
                        <span className="font-semibold text-gray-900 dark:text-white">Member</span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Can read and write messages, join channels
                      </p>
                    </button>
                    <button
                      onClick={() => setRole('admin')}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        role === 'admin'
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-center space-x-3 mb-2">
                        <Crown className="w-5 h-5 text-amber-500" />
                        <span className="font-semibold text-gray-900 dark:text-white">Admin</span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Full workspace access and management
                      </p>
                    </button>
                  </div>
                </div>

                {/* Email Inputs */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-3">
                    Email Addresses
                  </label>
                  <div className="space-y-3">
                    {emails.map((email, index) => (
                      <motion.div
                        key={index}
                        className="flex items-center space-x-3"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                      >
                        <div className="flex-1 relative">
                          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                          <input
                            type="email"
                            placeholder="colleague@company.com"
                            value={email}
                            onChange={(e) => updateEmail(index, e.target.value)}
                            className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                          />
                          {email && isValidEmail(email) && (
                            <Check className="absolute right-3 top-1/2 transform -translate-y-1/2 text-green-500 w-4 h-4" />
                          )}
                        </div>
                        {emails.length > 1 && (
                          <button
                            onClick={() => removeEmailInput(index)}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </motion.div>
                    ))}
                  </div>

                  <button
                    onClick={addEmailInput}
                    className="mt-3 flex items-center space-x-2 text-primary-600 hover:text-primary-700 font-medium text-sm"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Add another email</span>
                  </button>
                </div>

                {/* Pending Invites */}
                {pendingInvites.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                      Recent Invitations
                    </h3>
                    <div className="space-y-2">
                      {pendingInvites.slice(-3).map((invite, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                        >
                          <div className="flex items-center space-x-3">
                            <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {invite.email}
                            </span>
                            <span className="text-xs text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-400 px-2 py-1 rounded-full font-medium">
                              invited
                            </span>
                          </div>
                          <span className="text-xs text-gray-500">
                            {invite.timestamp.toLocaleTimeString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                {/* Invite Link Section */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-3">
                    Shareable Invite Link
                  </label>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                    Anyone with this link can join as a {role}. You can revoke this link at any time.
                  </p>

                  {inviteLink ? (
                    <div className="flex items-center space-x-3">
                      <div className="flex-1 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                        <p className="text-sm text-gray-900 dark:text-white font-mono break-all">
                          {inviteLink}
                        </p>
                      </div>
                      <button
                        onClick={copyInviteLink}
                        className="p-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all shadow-md"
                      >
                        {linkCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={generateInviteLink}
                      disabled={isLoading}
                      className="w-full p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all text-gray-600 dark:text-gray-400 hover:text-primary-600"
                    >
                      <ExternalLink className="w-5 h-5 mx-auto mb-2" />
                      <span className="font-medium">Generate Invite Link</span>
                    </button>
                  )}
                </div>

                {/* Role Selection for Link */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-3">
                    Default Role for Link
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 dark:border-gray-700 p-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                <Shield className="w-4 h-4" />
                <span>Invitations expire in 7 days</span>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={onClose}
                  className="px-6 py-3 text-gray-600 hover:text-blue-700 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-lg transition-all font-medium"
                >
                  Cancel
                </button>
                {inviteMethod === 'email' && (
                    <button
                      onClick={handleSendInvites}
                      disabled={isLoading || emails.every(email => !email.trim())}
                      className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium shadow-md flex items-center space-x-2"
                    >
                    {isLoading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    <span>{isLoading ? 'Sending...' : 'Send Invites'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default InviteDialog;
