import React from 'react';
import { Hash, Plus, Lock, Volume2 } from 'lucide-react';
import PropTypes from 'prop-types';

const ChannelsSidebar = ({ 
  workspace,
  channels = [], 
  currentChannel, 
  onChannelSelect 
}) => {
  return (
    <div className="hidden lg:flex lg:w-1/4 bg-gray-50 border-r border-gray-200 flex-col">
      {/* Workspace Header */}
      <div className="p-4 border-b border-gray-200 bg-white">
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

      {/* Channels List */}
      <div className="flex-1 overflow-y-auto p-3">
        {/* Channels Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3 px-2">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
              Channels
            </h3>
            <button className="p-1 hover:bg-gray-200 rounded">
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
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <Hash className="w-4 h-4" />
                <span className="text-sm font-medium truncate flex-1">{channel.name}</span>
                {channel.unread > 0 && (
                  <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5 min-w-[18px] text-center">
                    {channel.unread}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Direct Messages Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3 px-2">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
              Direct Messages
            </h3>
            <button className="p-1 hover:bg-gray-200 rounded">
              <Plus className="w-4 h-4 text-gray-500" />
            </button>
          </div>
          <div className="space-y-1">
            <button className="w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-left text-gray-700 hover:bg-gray-100 transition-colors">
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-semibold">JD</span>
              </div>
              <span className="text-sm font-medium flex-1">John Doe</span>
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
            </button>
            <button className="w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-left text-gray-700 hover:bg-gray-100 transition-colors">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-semibold">SK</span>
              </div>
              <span className="text-sm font-medium flex-1">Sarah Kim</span>
              <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

ChannelsSidebar.propTypes = {
  workspace: PropTypes.object,
  channels: PropTypes.array,
  currentChannel: PropTypes.object,
  onChannelSelect: PropTypes.func,
};

export default ChannelsSidebar;
