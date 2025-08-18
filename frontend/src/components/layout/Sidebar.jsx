import React, { useState, useEffect } from 'react';
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
import { threadAPI } from '../../utils/api';

const Sidebar = ({ workspace, channels, currentChannel, onChannelSelect, onAddChannel, isOpen, onClose }) => {
  const [channelsExpanded, setChannelsExpanded] = useState(true);
  const [directMessagesExpanded, setDirectMessagesExpanded] = useState(true);
  const [directMessages, setDirectMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load direct messages when workspace changes
  useEffect(() => {
    const loadDMs = async () => {
      if (workspace) {
        const dms = await loadWorkspaceDirectMessages(workspace);
        setDirectMessages(dms);
      }
    };
    loadDMs();
  }, [workspace]);

  const loadWorkspaceDirectMessages = async (workspace) => {
    if (!workspace) return [];
    
    try {
      setLoading(true);
      const response = await threadAPI.getThreads(workspace.id);
      const threadsData = response.data;
      
      // Filter direct messages from the threads response
      const dms = threadsData.filter(thread => thread.type === 'dm').map(thread => ({
        id: thread.id,
        name: thread.name || 'Direct Message',
        status: 'online', // Default status - could be enhanced with real presence data
        initials: thread.name ? thread.name.split(' ').map(n => n[0]).join('').toUpperCase() : 'DM',
        unread: thread.unread_count || 0
      }));
      
      return dms;
    } catch (error) {
      console.error('Failed to load direct messages:', error);
      return [];
    } finally {
      setLoading(false);
    }
  };

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      {/* Workspace Header */}
      <div className="p-4 border-b border-slate-200 bg-white/50 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0 shadow-md">
              <span className="text-white font-bold text-sm">
                {workspace?.name?.charAt(0)?.toUpperCase() || 'C'}
              </span>
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold text-slate-800 truncate text-sm">
                {workspace?.name || 'ChatFlow'}
              </h2>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full shadow-sm" />
                <span className="text-xs text-slate-500">
                  {workspace?.member_count || 0} {(workspace?.member_count || 0) === 1 ? 'member' : 'members'}
                </span>
              </div>
            </div>
          </div>
          <button 
            className="md:hidden p-2 hover:bg-slate-200 rounded-lg transition-colors duration-200" 
            onClick={onClose}
          >
            <X className="w-4 h-4 text-slate-600" />
          </button>
        </div>
      </div>

      {/* Channel List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {/* Channels Section */}
        <div className="mb-6">
          <button
            onClick={() => setChannelsExpanded(!channelsExpanded)}
            className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wider hover:text-slate-800 transition-colors duration-200"
          >
            <div className="flex items-center gap-2">
              <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${channelsExpanded ? '' : '-rotate-90'}`} />
              <span>Channels</span>
            </div>
            <button 
              className="p-1 hover:bg-slate-200 rounded transition-colors duration-200" 
              onClick={(e) => {
                e.stopPropagation();
                onAddChannel();
              }}
            >
              <Plus className="w-3 h-3" />
            </button>
          </button>

          {channelsExpanded && (
            <div className="mt-2 space-y-0.5">
              {channels.map((channel) => (
                <button
                  key={channel.id}
                  onClick={() => onChannelSelect(channel)}
                  className={`w-full flex items-center gap-2 px-2 py-2 text-sm rounded-lg transition-all duration-200 ${
                    currentChannel?.id === channel.id 
                      ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-sm' 
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  } ${channel.unread ? 'font-semibold' : ''}`}
                >
                  <Hash className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate flex-1">{channel.name}</span>
                  {channel.unread > 0 && (
                    <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full font-medium shadow-sm">
                      {channel.unread}
                    </span>
                  )}
                </button>
              ))}
              <button 
                className="w-full flex items-center gap-2 px-2 py-2 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-all duration-200" 
                onClick={onAddChannel}
              >
                <Plus className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">Add channels</span>
              </button>
            </div>
          )}
        </div>

        {/* Direct Messages Section */}
        <div className="mb-6">
          <button
            onClick={() => setDirectMessagesExpanded(!directMessagesExpanded)}
            className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wider hover:text-slate-800 transition-colors duration-200"
          >
            <div className="flex items-center gap-2">
              <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${directMessagesExpanded ? '' : '-rotate-90'}`} />
              <span>Direct messages</span>
            </div>
            <button className="p-1 hover:bg-slate-200 rounded transition-colors duration-200" onClick={(e) => e.stopPropagation()}>
              <Plus className="w-3 h-3" />
            </button>
          </button>

          {directMessagesExpanded && (
            <div className="mt-2 space-y-0.5">
              {directMessages.map((dm) => (
                <button
                  key={dm.id}
                  className="w-full flex items-center gap-2 px-2 py-2 text-sm text-slate-700 hover:bg-slate-100 hover:text-slate-900 rounded-lg transition-all duration-200"
                >
                  <div className="relative flex-shrink-0">
                    <div className="w-7 h-7 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center shadow-sm">
                      <span className="text-white text-xs font-medium">{dm.initials}</span>
                    </div>
                    <div className={`w-3 h-3 absolute -bottom-0.5 -right-0.5 border-2 border-white rounded-full ${
                      dm.status === 'online' ? 'bg-green-400' : dm.status === 'away' ? 'bg-yellow-400' : 'bg-slate-400'
                    }`} />
                  </div>
                  <span className="truncate flex-1">{dm.name}</span>
                </button>
              ))}
              <button className="w-full flex items-center gap-2 px-2 py-2 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-all duration-200">
                <Users className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">Browse people</span>
              </button>
            </div>
          )}
        </div>

        {/* Apps Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between px-2 py-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wider">
            <span>Apps</span>
            <button className="p-1 hover:bg-slate-200 rounded transition-colors duration-200">
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom User Section */}
      <div className="p-3 border-t border-slate-200 bg-white/30 backdrop-blur-sm space-y-0.5">
        <button className="w-full flex items-center gap-2 px-2 py-2 text-sm text-slate-700 hover:bg-slate-100 hover:text-slate-900 rounded-lg transition-all duration-200">
          <MessageSquare className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">Threads</span>
        </button>
        <button className="w-full flex items-center gap-2 px-2 py-2 text-sm text-slate-700 hover:bg-slate-100 hover:text-slate-900 rounded-lg transition-all duration-200">
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
  onAddChannel: PropTypes.func,
  isOpen: PropTypes.bool,
  onClose: PropTypes.func,
};

export default Sidebar;
