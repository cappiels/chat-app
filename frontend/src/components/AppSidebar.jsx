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
    <div className="hidden lg:flex w-20 bg-white border-r border-gray-200 flex-col">
      {/* Workspace Icon */}
      <div className="p-3 border-b border-gray-200 flex justify-center">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
          <span className="text-white font-bold text-lg">
            {workspace?.name?.charAt(0)?.toUpperCase() || 'W'}
          </span>
        </div>
      </div>

      {/* Navigation Icons */}
      <div className="flex-1 p-2">
        <div className="space-y-2">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => onSectionChange?.(item.id)}
                className={`w-full flex flex-col items-center justify-center p-3 rounded-lg transition-colors ${
                  item.active
                    ? "bg-purple-100 text-purple-900"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
                title={item.label}
              >
                <Icon className="w-6 h-6 mb-1" />
                <span className="text-xs font-medium truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* User Avatar */}
      <div className="p-3 border-t border-gray-200 flex justify-center">
        <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center">
          <span className="text-white text-sm font-semibold">
            {workspace?.user_name?.charAt(0)?.toUpperCase() || 'U'}
          </span>
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
