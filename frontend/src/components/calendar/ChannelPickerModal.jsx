import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { Building2, Hash, Check } from 'lucide-react';

/**
 * Modal to select a single channel when multiple are selected
 * Used for task/event creation which requires a specific channel
 */
const ChannelPickerModal = ({
  isOpen,
  onClose,
  selectedChannels,
  workspaces,
  onChannelSelected,
  title = 'Select a Channel',
  description = 'Please select which channel to create the task in:'
}) => {
  const [selectedChannel, setSelectedChannel] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (selectedChannel) {
      onChannelSelected(selectedChannel);
      onClose();
    }
  };

  // Group channels by workspace
  const channelsByWorkspace = {};
  selectedChannels.forEach(channelData => {
    const wsId = channelData.workspaceId;
    if (!channelsByWorkspace[wsId]) {
      channelsByWorkspace[wsId] = [];
    }
    channelsByWorkspace[wsId].push(channelData);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-primary">
          <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-surface-hover rounded-lg transition-colors"
          >
            <XMarkIcon className="w-5 h-5 text-text-tertiary" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-sm text-text-secondary mb-4">{description}</p>

          <div className="space-y-4 max-h-80 overflow-y-auto">
            {Object.entries(channelsByWorkspace).map(([wsId, channels]) => {
              const workspace = workspaces.find(ws => ws.id === wsId);

              return (
                <div key={wsId} className="border border-border-primary rounded-lg overflow-hidden">
                  {/* Workspace Header */}
                  <div className="flex items-center gap-2 px-4 py-2 bg-surface-secondary">
                    <Building2 className="w-4 h-4 text-text-tertiary" />
                    <span className="text-sm font-semibold text-text-secondary">
                      {workspace?.name || 'Workspace'}
                    </span>
                  </div>

                  {/* Channels */}
                  <div className="divide-y divide-border-primary">
                    {channels.map((channelData) => (
                      <button
                        key={channelData.channelId}
                        onClick={() => setSelectedChannel(channelData)}
                        className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-hover transition-colors ${
                          selectedChannel?.channelId === channelData.channelId
                            ? 'bg-accent-50'
                            : ''
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                          selectedChannel?.channelId === channelData.channelId
                            ? 'bg-accent-500 border-accent-500'
                            : 'border-gray-300'
                        }`}>
                          {selectedChannel?.channelId === channelData.channelId && (
                            <Check className="w-3 h-3 text-white" />
                          )}
                        </div>
                        <Hash className="w-4 h-4 text-text-tertiary" />
                        <span className="text-sm text-text-primary">
                          {channelData.channel?.name || 'Channel'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border-primary bg-surface-secondary">
          <button
            onClick={onClose}
            className="btn btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedChannel}
            className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
};

ChannelPickerModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  selectedChannels: PropTypes.arrayOf(PropTypes.shape({
    workspaceId: PropTypes.string,
    channelId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    channel: PropTypes.object
  })).isRequired,
  workspaces: PropTypes.array.isRequired,
  onChannelSelected: PropTypes.func.isRequired,
  title: PropTypes.string,
  description: PropTypes.string
};

export default ChannelPickerModal;
