/**
 * MentionDropdown Component
 * Displays filtered workspace members for @mention autocomplete
 */

import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { Users } from 'lucide-react';

const MentionDropdown = ({ members, onSelect, onClose, selectedIndex, position }) => {
  const dropdownRef = useRef(null);
  const itemRefs = useRef([]);

  // Scroll selected item into view
  useEffect(() => {
    if (itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex].scrollIntoView({
        block: 'nearest',
        behavior: 'smooth'
      });
    }
  }, [selectedIndex]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  if (members.length === 0) {
    return null;
  }

  return (
    <div
      ref={dropdownRef}
      className="absolute z-50 w-72 max-h-64 overflow-y-auto bg-white rounded-lg border border-gray-200 shadow-xl"
      style={{
        bottom: position?.bottom || '100%',
        left: position?.left || 0,
        marginBottom: '8px'
      }}
    >
      <div className="px-3 py-2 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Users className="w-4 h-4" />
          <span>Mention someone</span>
        </div>
      </div>

      <div className="py-1">
        {members.map((member, index) => (
          <button
            key={member.id}
            ref={(el) => (itemRefs.current[index] = el)}
            onClick={() => onSelect(member)}
            className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
              index === selectedIndex
                ? 'bg-blue-50 text-blue-700'
                : 'hover:bg-gray-50'
            }`}
          >
            {/* Avatar */}
            {member.profile_picture_url ? (
              <img
                src={member.profile_picture_url}
                alt={member.display_name}
                className="w-8 h-8 rounded-full border border-gray-200"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-semibold">
                {member.display_name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
            )}

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 truncate">
                {member.display_name}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {member.email}
              </p>
            </div>
          </button>
        ))}
      </div>

      <div className="px-3 py-2 border-t border-gray-100 bg-gray-50">
        <p className="text-xs text-gray-500">
          <kbd className="px-1 py-0.5 bg-gray-200 rounded text-gray-700 font-mono">Tab</kbd> or <kbd className="px-1 py-0.5 bg-gray-200 rounded text-gray-700 font-mono">Enter</kbd> to select
        </p>
      </div>
    </div>
  );
};

MentionDropdown.propTypes = {
  members: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    display_name: PropTypes.string,
    email: PropTypes.string,
    profile_picture_url: PropTypes.string
  })).isRequired,
  onSelect: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  selectedIndex: PropTypes.number,
  position: PropTypes.shape({
    bottom: PropTypes.string,
    left: PropTypes.number
  })
};

MentionDropdown.defaultProps = {
  selectedIndex: 0,
  position: null
};

export default MentionDropdown;
