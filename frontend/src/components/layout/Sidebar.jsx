import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { 
  ChevronDown, 
  Plus, 
  Hash, 
  Lock, 
  MessageSquare,
  Users,
  MoreVertical,
  X
} from 'lucide-react';

const Sidebar = ({ workspace, channels, currentChannel, onChannelSelect, isOpen, onClose }) => {
  const [channelsExpanded, setChannelsExpanded] = useState(true);
  const [directMessagesExpanded, setDirectMessagesExpanded] = useState(true);

  // Mock direct messages
  const directMessages = [
    { id: 'dm1', name: 'Sarah Chen', status: 'online', initials: 'SC' },
    { id: 'dm2', name: 'Mike Johnson', status: 'away', initials: 'MJ' },
    { id: 'dm3', name: 'Lisa Park', status: 'offline', initials: 'LP' },
  ];

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      {/* Workspace Header */}
      <div className="workspace-header flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-9 h-9 bg-blue rounded flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold">
              {workspace?.name?.charAt(0)?.toUpperCase() || 'C'}
            </span>
          </div>
          <div className="min-w-0">
            <h2 className="workspace-name truncate">
              {workspace?.name || 'ChatFlow'}
            </h2>
            <div className="flex items-center gap-1">
              <div className="presence-indicator" />
              <span className="text-xs text-tertiary">
                {workspace?.member_count || 0} {(workspace?.member_count || 0) === 1 ? 'member' : 'members'}
              </span>
            </div>
          </div>
        </div>
        <button className="btn-icon btn-ghost md:hidden" onClick={onClose}>
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Channel List */}
      <div className="flex-1 overflow-y-auto p-3">
        {/* Channels Section */}
        <div className="mb-4">
          <button
            onClick={() => setChannelsExpanded(!channelsExpanded)}
            className="section-header w-full"
          >
            <div className="flex items-center gap-1">
              <ChevronDown className={`w-4 h-4 transition-transform ${channelsExpanded ? '' : '-rotate-90'}`} />
              <span>Channels</span>
            </div>
            <button className="btn-icon btn-ghost p-1" onClick={(e) => e.stopPropagation()}>
              <Plus className="w-4 h-4" />
            </button>
          </button>

          {channelsExpanded && (
            <div className="mt-1">
              {channels.map((channel) => (
                <button
                  key={channel.id}
                  onClick={() => onChannelSelect(channel)}
                  className={`channel-item ${currentChannel?.id === channel.id ? 'active' : ''} ${channel.unread ? 'unread' : ''}`}
                >
                  <Hash className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate flex-1">{channel.name}</span>
                  {channel.unread > 0 && (
                    <span className="badge">{channel.unread}</span>
                  )}
                </button>
              ))}
              <button className="channel-item text-tertiary">
                <Plus className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">Add channels</span>
              </button>
            </div>
          )}
        </div>

        {/* Direct Messages Section */}
        <div className="mb-4">
          <button
            onClick={() => setDirectMessagesExpanded(!directMessagesExpanded)}
            className="section-header w-full"
          >
            <div className="flex items-center gap-1">
              <ChevronDown className={`w-4 h-4 transition-transform ${directMessagesExpanded ? '' : '-rotate-90'}`} />
              <span>Direct messages</span>
            </div>
            <button className="btn-icon btn-ghost p-1" onClick={(e) => e.stopPropagation()}>
              <Plus className="w-4 h-4" />
            </button>
          </button>

          {directMessagesExpanded && (
            <div className="mt-1">
              {directMessages.map((dm) => (
                <button
                  key={dm.id}
                  className="channel-item"
                >
                  <div className="relative flex-shrink-0">
                    <div className="w-7 h-7 bg-maroon rounded flex items-center justify-center">
                      <span className="text-white text-xs font-medium">{dm.initials}</span>
                    </div>
                    <div className={`presence-indicator absolute -bottom-0.5 -right-0.5 border-2 border-surface ${dm.status === 'online' ? '' : dm.status === 'away' ? 'away' : 'offline'}`} />
                  </div>
                  <span className="truncate flex-1">{dm.name}</span>
                </button>
              ))}
              <button className="channel-item text-tertiary">
                <Users className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">Browse people</span>
              </button>
            </div>
          )}
        </div>

        {/* Apps Section */}
        <div className="mb-4">
          <div className="section-header">
            <span>Apps</span>
            <button className="btn-icon btn-ghost p-1">
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom User Section */}
      <div className="p-3 border-t border-border">
        <button className="channel-item">
          <MessageSquare className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">Threads</span>
        </button>
        <button className="channel-item">
          <Users className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">People & user groups</span>
        </button>
      </div>
    </aside>
  );
};

Sidebar.propTypes = {
  workspace: PropTypes.object,
  channels: PropTypes.array.isRequired,
  currentChannel: PropTypes.object,
  onChannelSelect: PropTypes.func.isRequired,
  isOpen: PropTypes.bool,
  onClose: PropTypes.func,
};

export default Sidebar;
