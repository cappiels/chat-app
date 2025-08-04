import React from 'react';
import { Hash, Plus, Home, MessageSquare, BookOpen, Bell, Users, Settings } from 'lucide-react';
import PropTypes from 'prop-types';

const AppSidebar = ({ 
  workspace, 
  channels = [], 
  currentChannel, 
  onChannelSelect, 
  activeSection = 'chat',
  onSectionChange,
  onSignOut 
}) => {
  const navigationItems = [
    {
      id: 'home',
      label: 'Home',
      icon: Home,
      active: activeSection === 'home'
    },
    {
      id: 'chat',
      label: 'Messages',
      icon: MessageSquare,
      active: activeSection === 'chat'
    },
    {
      id: 'knowledge',
      label: 'Knowledge',
      icon: BookOpen,
      active: activeSection === 'knowledge'
    },
    {
      id: 'activity',
      label: 'Activity',
      icon: Bell,
      active: activeSection === 'activity'
    }
  ];

  return (
    <div className="hidden lg:flex w-80 bg-white border-r border-gray-200 flex-col">
      {/* Workspace Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
            <span className="text-white font-bold text-lg">
              {workspace?.name?.charAt(0)?.toUpperCase() || 'W'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-gray-900 truncate">
              {workspace?.name || 'Workspace'}
            </h2>
            <p className="text-sm text-gray-500">
              {workspace?.member_count || 0} members
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <div className="p-3 border-b border-gray-200">
        <div className="space-y-1">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => onSectionChange?.(item.id)}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                  item.active
                    ? "bg-purple-100 text-purple-900"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-sm font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Channels Section (only show for chat) */}
      {activeSection === 'chat' && (
        <div className="flex-1 overflow-y-auto p-3">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
                Channels
              </h3>
              <button className="p-1 hover:bg-gray-100 rounded">
                <Plus className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="space-y-1">
              {channels.map((channel) => (
                <button
                  key={channel.id}
                  onClick={() => onChannelSelect?.(channel)}
                  className={`w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-left transition-colors ${
                    currentChannel?.id === channel.id
                      ? "bg-purple-100 text-purple-900"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <Hash className="w-4 h-4" />
                  <span className="text-sm font-medium truncate">{channel.name}</span>
                  {channel.unread > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-xs rounded-full px-2 py-0.5 min-w-[18px] text-center">
                      {channel.unread}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Direct Messages Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
                Direct Messages
              </h3>
              <button className="p-1 hover:bg-gray-100 rounded">
                <Plus className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="space-y-1">
              <button className="w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-left text-gray-600 hover:bg-gray-100 transition-colors">
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-semibold">JD</span>
                </div>
                <span className="text-sm font-medium">John Doe</span>
                <div className="ml-auto w-2 h-2 bg-green-400 rounded-full"></div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer Actions */}
      <div className="p-3 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-semibold">
                {workspace?.user_name?.charAt(0)?.toUpperCase() || 'U'}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 truncate">
                {workspace?.user_name || 'User'}
              </p>
              <p className="text-xs text-gray-500">Online</p>
            </div>
          </div>
          <button
            onClick={onSignOut}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <Settings className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>
    </div>
  );
};

AppSidebar.propTypes = {
  workspace: PropTypes.object,
  channels: PropTypes.array,
  currentChannel: PropTypes.object,
  onChannelSelect: PropTypes.func,
  activeSection: PropTypes.string,
  onSectionChange: PropTypes.func,
  onSignOut: PropTypes.func.isRequired,
};

export default AppSidebar;
