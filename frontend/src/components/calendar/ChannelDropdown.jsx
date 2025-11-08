import React, { useState } from 'react';
import { ChevronDownIcon, HashtagIcon } from '@heroicons/react/24/outline';

// Channel color mapping using our design tokens
const CHANNEL_COLORS = {
  blue: 'bg-channel-blue text-white',
  green: 'bg-channel-green text-white', 
  purple: 'bg-channel-purple text-white',
  orange: 'bg-channel-orange text-white',
  pink: 'bg-channel-pink text-white',
  teal: 'bg-channel-teal text-white',
  indigo: 'bg-channel-indigo text-white',
  red: 'bg-channel-red text-white',
  yellow: 'bg-channel-yellow text-white',
  cyan: 'bg-channel-cyan text-white',
  rose: 'bg-channel-rose text-white',
  violet: 'bg-channel-violet text-white',
};

const CHANNEL_DOT_COLORS = {
  blue: 'bg-channel-blue',
  green: 'bg-channel-green', 
  purple: 'bg-channel-purple',
  orange: 'bg-channel-orange',
  pink: 'bg-channel-pink',
  teal: 'bg-channel-teal',
  indigo: 'bg-channel-indigo',
  red: 'bg-channel-red',
  yellow: 'bg-channel-yellow',
  cyan: 'bg-channel-cyan',
  rose: 'bg-channel-rose',
  violet: 'bg-channel-violet',
};

const ChannelDropdown = ({ 
  channels = [], 
  selectedChannels = [], 
  onChannelSelect = () => {},
  onChannelToggle = () => {},
  multiSelect = true 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Sample channels for demonstration
  const sampleChannels = [
    { id: 1, name: 'general', color: 'blue', isVisible: true },
    { id: 2, name: 'frontend-dev', color: 'green', isVisible: true },
    { id: 3, name: 'backend-dev', color: 'purple', isVisible: false },
    { id: 4, name: 'design-system', color: 'orange', isVisible: true },
    { id: 5, name: 'marketing', color: 'pink', isVisible: true },
    { id: 6, name: 'product-planning', color: 'teal', isVisible: false },
    { id: 7, name: 'customer-support', color: 'indigo', isVisible: true },
    { id: 8, name: 'engineering', color: 'red', isVisible: true },
    { id: 9, name: 'analytics', color: 'yellow', isVisible: false },
    { id: 10, name: 'devops', color: 'cyan', isVisible: true },
  ];

  const displayChannels = channels.length > 0 ? channels : sampleChannels;
  
  const filteredChannels = displayChannels.filter(channel =>
    channel.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedChannelNames = selectedChannels.length > 0 
    ? selectedChannels.map(id => displayChannels.find(c => c.id === id)?.name).join(', ')
    : 'All Channels';

  const visibleSelectedChannels = displayChannels.filter(c => 
    selectedChannels.includes(c.id) && c.isVisible
  );

  return (
    <div className="relative">
      {/* Dropdown Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-surface-elevated border border-border-primary rounded-lg hover:bg-surface-hover transition-colors duration-200 min-w-[200px] justify-between"
      >
        <div className="flex items-center gap-2">
          <div className="flex -space-x-1">
            {visibleSelectedChannels.slice(0, 3).map((channel, index) => (
              <div
                key={channel.id}
                className={`w-3 h-3 rounded-full ring-2 ring-white ${CHANNEL_DOT_COLORS[channel.color]} z-${10 + index}`}
                title={channel.name}
              />
            ))}
            {visibleSelectedChannels.length > 3 && (
              <div className="w-3 h-3 rounded-full bg-gray-400 ring-2 ring-white text-[8px] flex items-center justify-center text-white font-bold z-13">
                +
              </div>
            )}
          </div>
          <span className="text-sm font-medium text-text-primary truncate">
            {multiSelect 
              ? `${visibleSelectedChannels.length} channels selected`
              : selectedChannelNames
            }
          </span>
        </div>
        <ChevronDownIcon className={`w-4 h-4 text-text-tertiary transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Overlay */}
          <div 
            className="fixed inset-0 z-dropdown" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown Content */}
          <div className="absolute top-full left-0 right-0 mt-1 channel-dropdown z-dropdown max-h-80 overflow-hidden">
            {/* Search */}
            <div className="p-3 border-b border-border-primary">
              <input
                type="text"
                placeholder="Search channels..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-surface-secondary border border-border-primary rounded-lg focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 outline-none"
                autoFocus
              />
            </div>

            {/* Channel List */}
            <div className="max-h-60 overflow-y-auto">
              {filteredChannels.length === 0 ? (
                <div className="p-3 text-sm text-text-tertiary text-center">
                  No channels found
                </div>
              ) : (
                filteredChannels.map((channel) => (
                  <div
                    key={channel.id}
                    className={`channel-dropdown-item ${
                      selectedChannels.includes(channel.id) ? 'bg-surface-selected' : ''
                    }`}
                    onClick={() => {
                      if (multiSelect) {
                        onChannelToggle(channel.id);
                      } else {
                        onChannelSelect(channel.id);
                        setIsOpen(false);
                      }
                    }}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      {/* Channel Color Dot */}
                      <div className={`channel-color-dot ${CHANNEL_DOT_COLORS[channel.color]}`} />
                      
                      {/* Channel Icon */}
                      <HashtagIcon className="w-4 h-4 text-text-tertiary" />
                      
                      {/* Channel Name */}
                      <span className="text-sm font-medium">
                        {channel.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Visibility Toggle */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // Handle visibility toggle
                        }}
                        className={`w-2 h-2 rounded-full transition-colors duration-200 ${
                          channel.isVisible ? 'bg-success-500' : 'bg-gray-300'
                        }`}
                        title={channel.isVisible ? 'Visible in calendar' : 'Hidden from calendar'}
                      />
                      
                      {/* Multi-select checkbox */}
                      {multiSelect && (
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                          selectedChannels.includes(channel.id) 
                            ? 'bg-accent-500 border-accent-500' 
                            : 'border-border-secondary'
                        }`}>
                          {selectedChannels.includes(channel.id) && (
                            <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Actions */}
            <div className="p-3 border-t border-border-primary bg-surface-secondary">
              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={() => {
                    // Select all visible channels
                    const visibleChannelIds = displayChannels
                      .filter(c => c.isVisible)
                      .map(c => c.id);
                    onChannelSelect(visibleChannelIds);
                  }}
                  className="text-xs text-accent-600 hover:text-accent-700 font-medium"
                >
                  Select All Visible
                </button>
                
                <button
                  onClick={() => onChannelSelect([])}
                  className="text-xs text-text-tertiary hover:text-text-secondary font-medium"
                >
                  Clear All
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ChannelDropdown;
