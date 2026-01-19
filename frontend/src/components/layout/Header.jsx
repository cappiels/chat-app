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
  HelpCircle,
  CalendarDays
} from 'lucide-react';
import { workspaceAPI, notificationAPI } from '../../utils/api';
import WorkspaceSettingsDialog from '../WorkspaceSettingsDialog';
import SoundSettingsDialog from '../SoundSettingsDialog';
import ConnectionStatus from '../ui/ConnectionStatus';
import ViewSwitcher from '../ui/ViewSwitcher';
import { getVersionString } from '../../utils/version';
import WorkspaceChannelSwitcher from '../WorkspaceChannelSwitcher';

const Header = ({ workspace, user, onMenuClick, onSignOut, onInvite, onWorkspaceSwitch, onBackToWorkspaces, currentChannel, channels, onChannelSelect, currentView, onViewChange }) => {
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
      {/* Left Section - Workspace/Channel Switcher */}
      <div className="flex items-center gap-2">
        {/* Mobile menu button */}
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 hover:bg-gray-100 rounded-lg"
        >
          <Menu className="w-5 h-5 text-gray-600" />
        </button>

        {/* Workspace-Channel Switcher */}
        <WorkspaceChannelSwitcher
          currentWorkspace={workspace}
          currentChannel={currentChannel}
          workspaces={workspaces}
          onWorkspaceChange={(ws) => {
            if (ws.id !== workspace?.id && onWorkspaceSwitch) {
              onWorkspaceSwitch(ws);
            }
          }}
          onChannelChange={onChannelSelect}
        />

        {/* Quick actions */}
        <div className="hidden md:flex items-center gap-1 ml-2">
          <button
            onClick={handleOpenSettings}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700"
            title="Workspace Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={() => onBackToWorkspaces?.()}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700"
            title="Back to Today"
          >
            <CalendarDays className="w-4 h-4" />
          </button>
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

        {/* Invite users - compact on mobile - ONLY for admins */}
        {onInvite && (workspace?.role === 'admin' || workspace?.user_role === 'admin') && (
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
  channels: PropTypes.array,
  onChannelSelect: PropTypes.func,
  currentView: PropTypes.string,
  onViewChange: PropTypes.func,
};

export default Header;
