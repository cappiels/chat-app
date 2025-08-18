import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Menu, Search, X, Bell, HelpCircle, User, UserPlus, ChevronDown, Briefcase, Settings } from 'lucide-react';
import { workspaceAPI } from '../../utils/api';
import WorkspaceSettingsDialog from '../WorkspaceSettingsDialog';

const Header = ({ workspace, user, onMenuClick, onSignOut, onInvite, onWorkspaceSwitch, onBackToWorkspaces }) => {
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [workspaces, setWorkspaces] = useState([]);
  const [showWorkspaceSwitcher, setShowWorkspaceSwitcher] = useState(false);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [detailedWorkspace, setDetailedWorkspace] = useState(null);
  const [loadingWorkspaceDetails, setLoadingWorkspaceDetails] = useState(false);

  // Load available workspaces when component mounts or when workspace switcher is opened
  const loadWorkspaces = async () => {
    if (loadingWorkspaces || !onWorkspaceSwitch) return;
    
    try {
      setLoadingWorkspaces(true);
      const response = await workspaceAPI.getWorkspaces();
      setWorkspaces(response.data.workspaces || []);
    } catch (error) {
      console.error('Failed to load workspaces:', error);
    } finally {
      setLoadingWorkspaces(false);
    }
  };

  const handleWorkspaceSelect = (selectedWorkspace) => {
    if (selectedWorkspace.id !== workspace?.id && onWorkspaceSwitch) {
      onWorkspaceSwitch(selectedWorkspace);
    }
    setShowWorkspaceSwitcher(false);
  };

  const handleWorkspaceSwitcherToggle = () => {
    if (!showWorkspaceSwitcher && workspaces.length === 0) {
      loadWorkspaces();
    }
    setShowWorkspaceSwitcher(!showWorkspaceSwitcher);
  };

  const handleWorkspaceDeleted = (workspaceId, archived) => {
    // Go back to workspace selection when current workspace is deleted/archived
    if (onBackToWorkspaces) {
      onBackToWorkspaces();
    } else if (onWorkspaceSwitch) {
      onWorkspaceSwitch(null);
    }
    setShowSettings(false);
  };

  const loadWorkspaceDetails = async () => {
    if (!workspace?.id || loadingWorkspaceDetails) return;
    
    try {
      setLoadingWorkspaceDetails(true);
      const [workspaceResponse, membersResponse] = await Promise.all([
        workspaceAPI.getWorkspace(workspace.id),
        workspaceAPI.getMembers(workspace.id)
      ]);
      
      setDetailedWorkspace({
        ...workspaceResponse.data.workspace,
        members: membersResponse.data.members || []
      });
    } catch (error) {
      console.error('Failed to load workspace details:', error);
      // Still show dialog with basic data as fallback
      setDetailedWorkspace(workspace);
    } finally {
      setLoadingWorkspaceDetails(false);
    }
  };

  const handleOpenSettings = async () => {
    setShowWorkspaceSwitcher(false);
    await loadWorkspaceDetails();
    setShowSettings(true);
  };

  const handleMemberRemoved = (memberId) => {
    // Refresh workspace details after member is removed
    if (detailedWorkspace?.members) {
      setDetailedWorkspace({
        ...detailedWorkspace,
        members: detailedWorkspace.members.filter(m => m.id !== memberId)
      });
    }
  };

  return (
    <header className="app-header">
      <div className="flex items-center gap-3 flex-1">
        {/* Mobile menu button */}
        <button
          onClick={onMenuClick}
          className="btn-icon btn-ghost text-white md:hidden"
          aria-label="Toggle sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Workspace Switcher - Always Visible */}
        <div className="relative">
            <button
              onClick={handleWorkspaceSwitcherToggle}
              className="flex items-center gap-2 px-4 py-2 text-white hover:bg-white/15 rounded-lg transition-all bg-white/10 border-2 border-white/40 backdrop-blur-sm"
              title="Switch workspace • Click to see all workspaces"
              style={{ minWidth: '150px', backgroundColor: 'rgba(255,255,255,0.15)' }}
            >
              <Briefcase className="w-5 h-5" />
              <span className="font-semibold truncate max-w-32">
                {workspace?.name || 'ChatFlow'}
              </span>
              <ChevronDown className="w-4 h-4 transition-transform" />
            </button>
            
            {/* Workspace Dropdown */}
            {showWorkspaceSwitcher && (
              <div className="absolute left-0 top-full mt-2 w-72 bg-white rounded-xl shadow-xl border border-border-strong z-50 animate-slide-up">
                <div className="p-4 border-b border-border bg-gradient-to-r from-blue-50 to-purple-50 rounded-t-xl">
                  <h3 className="text-sm font-semibold text-primary">Switch Workspace</h3>
                  <p className="text-xs text-tertiary mt-1">Choose a workspace to switch to</p>
                </div>
                <div className="py-1 max-h-64 overflow-y-auto">
                  {loadingWorkspaces ? (
                    <div className="p-3 text-center text-sm text-tertiary">
                      Loading workspaces...
                    </div>
                  ) : workspaces.length === 0 ? (
                    <div className="p-3 text-center text-sm text-tertiary">
                      No other workspaces found
                    </div>
                  ) : (
                    workspaces.map((ws) => (
                      <button
                        key={ws.id}
                        onClick={() => handleWorkspaceSelect(ws)}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-surface transition flex items-center gap-3 ${
                          ws.id === workspace?.id ? 'bg-surface text-accent' : 'text-primary'
                        }`}
                      >
                        <Briefcase className="w-4 h-4 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{ws.name}</div>
                          <div className="text-xs text-tertiary truncate">
                            {ws.member_count} members
                          </div>
                        </div>
                        {ws.id === workspace?.id && (
                          <div className="w-2 h-2 bg-accent rounded-full"></div>
                        )}
                      </button>
                    ))
                  )}
                </div>
                <div className="border-t border-border p-2 bg-gray-50/50">
                  <button
                    onClick={handleOpenSettings}
                    className="w-full text-left px-3 py-3 text-sm hover:bg-surface transition flex items-center gap-3 rounded-lg"
                  >
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Settings className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <div className="font-medium">Workspace Settings</div>
                      <div className="text-xs text-tertiary">Manage settings, members & permissions</div>
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      setShowWorkspaceSwitcher(false);
                      if (onBackToWorkspaces) {
                        onBackToWorkspaces();
                      }
                    }}
                    className="w-full text-left px-3 py-3 text-sm hover:bg-surface transition text-accent rounded-lg flex items-center gap-3"
                  >
                    <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Briefcase className="w-4 h-4 text-purple-600" />
                    </div>
                    <div>
                      <div className="font-medium">View All Workspaces</div>
                      <div className="text-xs text-tertiary">Browse and create workspaces</div>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>

        {/* Workspace name on mobile */}
        <div className="md:hidden">
          <h1 className="text-white font-semibold text-lg truncate">
            {workspace?.name || 'ChatFlow'}
          </h1>
        </div>

        {/* Search bar */}
        <div className="search-container">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder={`Search ${workspace?.name || 'ChatFlow'}`}
              className="search-input"
            />
            {searchQuery && searchFocused && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="w-4 h-4 text-tertiary" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Right side actions */}
      <div className="flex items-center gap-2">
        {/* Mobile search button */}
        <button className="btn-icon btn-ghost text-white md:hidden">
          <Search className="w-5 h-5" />
        </button>

        {/* Notifications */}
        <button className="btn-icon btn-ghost text-white relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-accent rounded-full" />
        </button>

        {/* Invite users */}
        {onInvite && (
          <button 
            onClick={onInvite}
            className="btn-icon btn-ghost text-white flex items-center gap-2 px-3 py-2 hover:bg-white/10 rounded-lg transition-colors"
            title="Invite people to workspace"
          >
            <UserPlus className="w-4 h-4" />
            <span className="hidden sm:inline text-sm font-medium">Invite</span>
          </button>
        )}

        {/* Help */}
        <button className="btn-icon btn-ghost text-white hidden md:flex">
          <HelpCircle className="w-5 h-5" />
        </button>

        {/* User menu */}
        <div className="relative group">
          <button className="flex items-center gap-2 p-1 rounded hover:bg-white/10 transition">
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName}
                className="w-8 h-8 rounded"
              />
            ) : (
              <div className="w-8 h-8 bg-purple-600 rounded flex items-center justify-center">
                <span className="text-white text-sm font-semibold">
                  {user?.displayName?.charAt(0) || 'U'}
                </span>
              </div>
            )}
          </button>
          
          {/* Dropdown menu */}
          <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
            <div className="p-3 border-b border-gray-200">
              <p className="font-semibold text-gray-900 truncate">{user?.displayName}</p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
            <div className="py-1">
              <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                Profile
              </button>
              <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                Preferences
              </button>
              <hr className="my-1 border-gray-200" />
              <button
                onClick={onSignOut}
                className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Workspace Settings Dialog */}
      <WorkspaceSettingsDialog
        workspace={detailedWorkspace || workspace}
        user={user}
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onWorkspaceDeleted={handleWorkspaceDeleted}
        onMemberRemoved={handleMemberRemoved}
      />
    </header>
  );
};

Header.propTypes = {
  workspace: PropTypes.object,
  user: PropTypes.object,
  onMenuClick: PropTypes.func.isRequired,
  onSignOut: PropTypes.func.isRequired,
  onInvite: PropTypes.func,
  onWorkspaceSwitch: PropTypes.func,
  onBackToWorkspaces: PropTypes.func,
};

export default Header;
