import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Search, UserPlus, X, Users, Loader2 } from 'lucide-react';
import { adminAPI } from '../../utils/api';
import toast from 'react-hot-toast';

const SITE_ADMIN_EMAIL = 'cappiels@gmail.com';

/**
 * AddMemberDialog - Site admin only
 * Allows searching registered users and adding them directly to a workspace
 */
const AddMemberDialog = ({ workspace, user, isOpen, onClose, onMemberAdded }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedRole, setSelectedRole] = useState('member');
  const [isSearching, setIsSearching] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [addingUserId, setAddingUserId] = useState(null);

  // Check if current user is site admin
  const isSiteAdmin = user?.email === SITE_ADMIN_EMAIL;

  // Debounced search function
  const searchUsers = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await adminAPI.searchUsers(query);
      // Filter out users who are already members of this workspace
      const existingMemberIds = new Set(
        (workspace?.members || []).map(m => m.id)
      );
      const filteredResults = (response.data.users || []).filter(
        u => !existingMemberIds.has(u.id)
      );
      setSearchResults(filteredResults);
    } catch (error) {
      console.error('Error searching users:', error);
      if (error.response?.status === 403) {
        toast.error('Site admin access required');
      } else {
        toast.error('Failed to search users');
      }
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [workspace?.members]);

  // Search effect with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= 2) {
        searchUsers(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, searchUsers]);

  const handleAddMember = async (selectedUser) => {
    setIsAdding(true);
    setAddingUserId(selectedUser.id);

    try {
      await adminAPI.addMemberToWorkspace(workspace.id, selectedUser.id, selectedRole);
      toast.success(`${selectedUser.display_name || selectedUser.email} added to workspace`);
      
      // Remove from search results
      setSearchResults(prev => prev.filter(u => u.id !== selectedUser.id));
      
      // Notify parent component
      onMemberAdded?.({
        id: selectedUser.id,
        email: selectedUser.email,
        display_name: selectedUser.display_name,
        profile_picture_url: selectedUser.profile_picture_url,
        role: selectedRole,
        joined_at: new Date().toISOString()
      });
      
      // Clear search
      setSearchQuery('');
      setSearchResults([]);
      
    } catch (error) {
      console.error('Error adding member:', error);
      if (error.response?.data?.message) {
        toast.error(error.response.data.message);
      } else if (error.response?.status === 409) {
        toast.error('User is already a member of this workspace');
      } else {
        toast.error('Failed to add member');
      }
    } finally {
      setIsAdding(false);
      setAddingUserId(null);
    }
  };

  if (!isOpen) return null;

  // Only site admin can use this feature
  if (!isSiteAdmin) {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60]">
        <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-red-100 rounded-full">
              <X className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-red-700">Access Denied</h3>
          </div>
          <p className="text-gray-600 mb-4">
            Only the site administrator can add members directly from the user list.
          </p>
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60]">
      <div className="bg-white rounded-[20px] border border-blue-200 shadow-[0_25px_50px_-12px_rgba(37,99,235,0.2)] p-6 w-full max-w-lg mx-4 ring-1 ring-blue-100">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-green-500 to-teal-500 rounded-lg">
              <UserPlus className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Add Member</h3>
              <p className="text-sm text-gray-500">Search registered users to add to {workspace?.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Role Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
          <div className="flex gap-3">
            <button
              onClick={() => setSelectedRole('member')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border transition-all ${
                selectedRole === 'member'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <Users className="w-4 h-4" />
              Member
            </button>
            <button
              onClick={() => setSelectedRole('admin')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border transition-all ${
                selectedRole === 'admin'
                  ? 'border-amber-500 bg-amber-50 text-amber-700'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Admin
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative mb-4">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            {isSearching ? (
              <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
            ) : (
              <Search className="w-5 h-5 text-gray-400" />
            )}
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            autoFocus
          />
        </div>

        {/* Search Results */}
        <div className="max-h-80 overflow-y-auto">
          {searchQuery.length < 2 ? (
            <div className="text-center py-8 text-gray-500">
              <Search className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>Type at least 2 characters to search</p>
            </div>
          ) : isSearching ? (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 mx-auto mb-2 text-blue-500 animate-spin" />
              <p className="text-gray-500">Searching...</p>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>No users found matching "{searchQuery}"</p>
              <p className="text-sm mt-1">Make sure the user has registered in the app</p>
            </div>
          ) : (
            <div className="space-y-2">
              {searchResults.map((searchUser) => (
                <div
                  key={searchUser.id}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {searchUser.profile_picture_url ? (
                      <img
                        src={searchUser.profile_picture_url}
                        alt={searchUser.display_name}
                        className="w-10 h-10 rounded-full border-2 border-gray-200"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center border-2 border-gray-200">
                        <span className="text-white font-semibold">
                          {searchUser.display_name?.charAt(0)?.toUpperCase() || 
                           searchUser.email?.charAt(0)?.toUpperCase() || 'U'}
                        </span>
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-gray-900">
                        {searchUser.display_name || 'No name'}
                      </p>
                      <p className="text-sm text-gray-500">{searchUser.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleAddMember(searchUser)}
                    disabled={isAdding}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium transition-all ${
                      isAdding && addingUserId === searchUser.id
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600'
                    }`}
                  >
                    {isAdding && addingUserId === searchUser.id ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4" />
                        Add
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
            <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Added users get instant access - no invitation link needed</span>
          </div>
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors font-medium"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

AddMemberDialog.propTypes = {
  workspace: PropTypes.object,
  user: PropTypes.object,
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onMemberAdded: PropTypes.func,
};

export default AddMemberDialog;
