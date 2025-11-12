import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { 
  Menu, 
  Search, 
  Bell, 
  UserPlus, 
  ChevronDown, 
  Briefcase, 
  Settings, 
  Volume2, 
  User,
  HelpCircle
} from 'lucide-react';
import { workspaceAPI, notificationAPI } from '../../utils/api';
import WorkspaceSettingsDialog from '../WorkspaceSettingsDialog';
import SoundSettingsDialog from '../SoundSettingsDialog';
import ConnectionStatus from '../ui/ConnectionStatus';
import ViewSwitcher from '../ui/ViewSwitcher';
import { getVersionString } from '../../utils/version';

const Header = ({ workspace, user, onMenuClick, onSignOut, onInvite, onWorkspaceSwitch, onBackToWorkspaces, currentChannel, currentView, onViewChange }) => {
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
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);
  const [totalMentions, setTotalMentions] = useState(0);
  const [showSoundSettings, setShowSoundSettings] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Load unread summary when workspace changes
  useEffect(() => {
    const loadUnreadSummary = async () => {
      if (!workspace?.id) return;
      
      try {
        const response = await notificationAPI.getUnreadSummary(workspace.id);
        const summary = response.data.summary;
        setTotalUnreadCount(summary.total_unread || 0);
        setTotalMentions(summary.total_mentions || 0);
      } catch (error) {
        console.error('Failed to load unread summary:', error);
      }
    };

    loadUnreadSummary();
    
    const interval = setInterval(loadUnreadSummary, 30000);
    return () => clearInterval(interval);
  }, [workspace?.id]);

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
    if (detailedWorkspace?.members) {
      setDetailedWorkspace({
        ...detailedWorkspace,
        members: detailedWorkspace.members.filter(m => m.id !== memberId)
      });
    }
  };

  return (
    <div className="flex items-center justify-between h-full w-full px-3 md:px-4">
      {/* Left Section - Workspace Switcher (far left on mobile) */}
      <div className="flex items-center">
        <div className="relative">
          <button
            onClick={handleWorkspaceSwitcherToggle}
            className="flex items-center gap-1 md:gap-2 px-1.5 md:px-3 py-1.5 md:py-2 text-text-primary hover:bg-gray-100 rounded-lg transition-all duration-200"
            title="Switch workspace"
          >
            <Briefcase className="w-4 h-4" />
            <span className="font-medium truncate text-xs md:text-base max-w-[80px] md:max-w-none">
              {workspace?.name || 'crew'}
            </span>
            <ChevronDown className={`w-3 h-3 md:w-4 md:h-4 transition-transform duration-200 ${showWorkspaceSwitcher ? 'rotate-180' : ''}`} />
          </button>
          
          {/* Workspace Dropdown */}
          {showWorkspaceSwitcher && (
            <>
              {/* Overlay */}
              <div 
                className="fixed inset-0 z-dropdown-backdrop" 
                onClick={() => setShowWorkspaceSwitcher(false)}
              />
              
              {/* Dropdown Content */}
              <div className="dropdown absolute top-full left-0 mt-2 w-80">
                <div className="p-4 border-b border-border-primary bg-surface-tertiary">
                  <h3 className="font-semibold text-text-primary">Switch Workspace</h3>
                  <p className="text-xs text-text-tertiary mt-1">Choose a workspace to switch to</p>
                </div>
                
                <div className="max-h-64 overflow-y-auto">
                  {loadingWorkspaces ? (
                    <div className="p-4 text-center text-text-tertiary">
                      <div className="loading-spinner w-4 h-4 mx-auto mb-2"></div>
                      Loading workspaces...
                    </div>
                  ) : workspaces.length === 0 ? (
                    <div className="p-4 text-center text-text-tertiary">
                      No other workspaces found
                    </div>
                  ) : (
                    workspaces.map((ws) => (
                      <button
                        key={ws.id}
                        onClick={() => handleWorkspaceSelect(ws)}
                        className={`dropdown-item w-full ${
                          ws.id === workspace?.id ? 'bg-surface-selected text-accent-600' : ''
                        }`}
                      >
                        <Briefcase className="w-4 h-4" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{ws.name}</div>
                          <div className="text-xs text-text-tertiary truncate">
                            {ws.member_count} members
                          </div>
                        </div>
                        {ws.id === workspace?.id && (
                          <div className="w-2 h-2 bg-accent-500 rounded-full"></div>
                        )}
                      </button>
                    ))
                  )}
                </div>
                
                <div className="border-t border-border-primary p-2 bg-surface-secondary">
                  <button
                    onClick={handleOpenSettings}
                    className="dropdown-item w-full"
                  >
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Settings className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="text-left">
                      <div className="font-medium">Workspace Settings</div>
                      <div className="text-xs text-text-tertiary">Manage settings & members</div>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => {
                      setShowWorkspaceSwitcher(false);
                      if (onBackToWorkspaces) {
                        onBackToWorkspaces();
                      }
                    }}
                    className="dropdown-item w-full"
                  >
                    <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Briefcase className="w-4 h-4 text-purple-600" />
                    </div>
                    <div className="text-left">
                      <div className="font-medium">All Workspaces</div>
                      <div className="text-xs text-text-tertiary">Browse and create</div>
                    </div>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right Section - Compact mobile layout */}
      <div className="flex items-center gap-0.5 md:gap-2">
        {/* Desktop: Full search input */}
        <div className="hidden md:block mr-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-text-tertiary pointer-events-none z-10" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${workspace?.name || 'crew'}`}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-text-primary placeholder-text-tertiary focus:bg-white focus:border-accent-500 focus:ring-2 focus:ring-accent-200 transition-all duration-200 outline-none"
            />
          </div>
        </div>

        {/* Mobile: Search button in right section */}
        <button 
          className="md:hidden btn-icon text-text-secondary hover:bg-gray-100 p-1.5"
          title="Search"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* View Switcher - only show when a channel is selected */}
        {currentChannel && onViewChange && (
          <ViewSwitcher
            currentView={currentView}
            onViewChange={onViewChange}
            variant="header"
            className=""
          />
        )}

        {/* Notifications - compact on mobile */}
        <button 
          className="btn-icon text-text-secondary hover:bg-gray-100 relative p-1.5"
          onClick={() => setShowNotifications(!showNotifications)}
          title={`${totalUnreadCount} unread messages${totalMentions > 0 ? `, ${totalMentions} mentions` : ''}`}
        >
          <Bell className="w-4 h-4 md:w-5 md:h-5" />
          {totalMentions > 0 ? (
            <div className="badge-count absolute -top-1 -right-1 bg-error-500 text-xs">
              {totalMentions}
            </div>
          ) : totalUnreadCount > 0 ? (
            <div className="badge-count absolute -top-1 -right-1 text-xs">
              {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
            </div>
          ) : null}
        </button>

        {/* Invite users - compact on mobile */}
        {onInvite && (
          <button 
            onClick={onInvite}
            className="btn-icon text-text-primary hover:bg-gray-100 p-1.5 md:px-3 md:py-2 md:gap-2"
            title="Invite people to workspace"
          >
            <UserPlus className="w-4 h-4" />
            <span className="hidden md:inline text-sm font-medium ml-1">Invite</span>
          </button>
        )}

        {/* Help - hidden on mobile to save space */}
        <button className="btn-icon text-text-secondary hover:bg-gray-100 hidden lg:flex p-1.5">
          <HelpCircle className="w-5 h-5" />
        </button>

        {/* User menu - compact on mobile */}
        <div className="relative ml-1">
          <button 
            className="flex items-center p-1 rounded-lg hover:bg-gray-100 transition-colors duration-200"
            onClick={() => setShowUserMenu(!showUserMenu)}
          >
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName}
                className="w-7 h-7 md:w-8 md:h-8 rounded-lg border border-gray-200"
              />
            ) : (
              <div className="w-7 h-7 md:w-8 md:h-8 bg-gray-200 rounded-lg flex items-center justify-center border border-gray-300">
                <span className="text-text-primary text-xs md:text-sm font-semibold">
                  {user?.displayName?.charAt(0) || 'U'}
                </span>
              </div>
            )}
          </button>
          
          {/* User Dropdown */}
          {showUserMenu && (
            <>
              {/* Overlay */}
              <div 
                className="fixed inset-0 z-dropdown-backdrop" 
                onClick={() => setShowUserMenu(false)}
              />
              
              {/* Dropdown Content */}
              <div className="dropdown absolute right-0 top-full mt-2 w-64">
                <div className="p-3 border-b border-border-primary">
                  <p className="font-semibold text-text-primary truncate">{user?.displayName}</p>
                  <p className="text-xs text-text-tertiary truncate">{user?.email}</p>
                </div>
                
                <div className="py-1">
                  <button className="dropdown-item w-full">
                    <User className="w-4 h-4" />
                    <span>Profile</span>
                  </button>
                  
                  <button 
                    onClick={() => {
                      setShowUserMenu(false);
                      setShowSoundSettings(true);
                    }}
                    className="dropdown-item w-full"
                  >
                    <Volume2 className="w-4 h-4" />
                    <span>Sound & Notifications</span>
                  </button>
                  
                  <button className="dropdown-item w-full">
                    <Settings className="w-4 h-4" />
                    <span>Preferences</span>
                  </button>
                  
                  <hr className="my-1 border-border-primary" />
                  
                  <button
                    onClick={onSignOut}
                    className="dropdown-item w-full text-error-600 hover:bg-error-50"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            </>
          )}
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

      {/* Sound Settings Dialog */}
      <SoundSettingsDialog
        open={showSoundSettings}
        onClose={() => setShowSoundSettings(false)}
        workspace={workspace}
      />
    </div>
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
  currentChannel: PropTypes.object,
  currentView: PropTypes.string,
  onViewChange: PropTypes.func,
};

export default Header;
