import React from 'react';
import PropTypes from 'prop-types';

/**
 * A component that displays the list of channels and direct messages
 * for the currently active workspace.
 */
const ChannelList = ({ workspace, channels, onSelectChannel }) => {
  return (
    <div className="channel-list">
      <div className="channel-list-header">
        <h1 className="workspace-name">{workspace?.name || 'Workspace'}</h1>
      </div>
      <div className="channel-groups">
        <div className="channel-group">
          <h2 className="channel-group-title">Channels</h2>
          {channels.filter(c => c.type === 'channel').map(channel => (
            <button 
              key={channel.id} 
              className="channel-link"
              onClick={() => onSelectChannel(channel)}
            >
              # {channel.name}
            </button>
          ))}
        </div>
        <div className="channel-group">
          <h2 className="channel-group-title">Direct Messages</h2>
          {/* Placeholder for DM list */}
        </div>
      </div>
    </div>
  );
};

ChannelList.propTypes = {
  workspace: PropTypes.shape({
    name: PropTypes.string,
  }),
  channels: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    type: PropTypes.string.isRequired,
  })).isRequired,
  onSelectChannel: PropTypes.func.isRequired,
};

export default ChannelList;
